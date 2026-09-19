import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import {
  AIProvider,
  AICompletionOptions,
  AICompletionResult,
} from '../interfaces/ai-provider.interface';
import {
  AIProviderTransientError,
  AIProviderFatalError,
  AIProviderNotConfiguredError,
} from '../errors/ai-errors';

@Injectable()
export class OpenAIProvider implements AIProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly client: OpenAI | null = null;
  private readonly defaultModel: string;
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxRetries: number;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.defaultModel = process.env.AI_MODEL || 'gpt-4o-mini';
    this.defaultTimeoutMs = parseInt(process.env.AI_TIMEOUT_MS || '30000', 10);
    this.defaultMaxRetries = parseInt(process.env.AI_MAX_RETRIES || '3', 10);

    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    } else {
      this.logger.warn('OPENAI_API_KEY is not configured in environment.');
    }
  }

  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    if (!this.client) {
      throw new AIProviderNotConfiguredError(
        'OpenAIProvider cannot complete request: OPENAI_API_KEY is missing or unconfigured in environment.',
      );
    }

    const model = options.model || this.defaultModel;
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    const maxRetries = options.maxRetries ?? this.defaultMaxRetries;
    const temperature = options.temperature ?? 0.2;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.prompt });

    const requestPayload: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
      temperature,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    };

    // Enforce Structured Outputs via response_format json_schema if a schema is defined
    if (options.schema) {
      requestPayload.response_format = {
        type: 'json_schema',
        json_schema: {
          name: options.schema.name,
          description: options.schema.description,
          schema: options.schema.schema,
          strict: options.schema.strict ?? true,
        },
      };
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      const startTime = Date.now();
      try {
        const response = await this.client.chat.completions.create(requestPayload, {
          timeout: timeoutMs,
        });

        const latencyMs = Date.now() - startTime;
        const choice = response.choices?.[0];
        const rawContent = choice?.message?.content || '';

        let parsedContent: any = undefined;
        if (options.schema && rawContent) {
          try {
            parsedContent = JSON.parse(rawContent);
          } catch (jsonErr: any) {
            this.logger.warn(`Failed to parse JSON response from structured output: ${jsonErr.message}`);
          }
        }

        const promptTokens = response.usage?.prompt_tokens || 0;
        const completionTokens = response.usage?.completion_tokens || 0;
        const totalTokens = response.usage?.total_tokens || (promptTokens + completionTokens);

        return {
          rawContent,
          parsedContent,
          modelUsed: response.model || model,
          usage: {
            promptTokens,
            completionTokens,
            totalTokens,
          },
          latencyMs,
        };
      } catch (err: any) {
        lastError = err;
        const status = err.status || err.statusCode;
        const isTransient = this.isTransientError(err, status);

        if (!isTransient || attempt >= maxRetries) {
          if (!isTransient) {
            this.logger.error(`Non-retryable OpenAI API error (status ${status}): ${err.message}`);
            throw new AIProviderFatalError(`OpenAI API fatal error: ${err.message}`, status);
          }
          this.logger.error(`OpenAI API request failed after ${attempt} retries: ${err.message}`);
          throw new AIProviderTransientError(`OpenAI API request failed after retries: ${err.message}`, status);
        }

        attempt++;
        // Exponential backoff with jitter: 2^attempt * 500ms + random(0-200ms)
        const delay = Math.pow(2, attempt) * 500 + Math.floor(Math.random() * 200);
        this.logger.warn(
          `Transient OpenAI error on attempt ${attempt}/${maxRetries} (${err.message}). Retrying in ${delay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new AIProviderTransientError(
      `OpenAI API request failed after ${maxRetries} retries: ${lastError?.message || 'Unknown error'}`,
    );
  }

  /**
   * Identifies transient errors suitable for retry (429 rate limit, 5xx server errors, timeouts, network resets).
   */
  private isTransientError(err: any, status?: number): boolean {
    if (status === 429) return true; // Rate limiting
    if (status && status >= 500 && status < 600) return true; // OpenAI 5xx server error
    if (err.name === 'APIConnectionTimeoutError' || err.code === 'ETIMEDOUT') return true;
    if (err.name === 'APIConnectionError' || err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') return true;
    return false;
  }
}
