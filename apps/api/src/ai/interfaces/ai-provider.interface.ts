export interface AISchemaDefinition {
  name: string;
  description?: string;
  schema: Record<string, any>;
  strict?: boolean;
}

export interface AICompletionOptions {
  prompt: string;
  systemPrompt?: string;
  schema?: AISchemaDefinition;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface AIUsageMetadata {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AICompletionResult {
  rawContent: string;
  parsedContent?: any;
  modelUsed: string;
  usage: AIUsageMetadata;
  latencyMs: number;
}

export interface AIProvider {
  /**
   * Generic completion method supporting structured/schema-constrained output,
   * configurable models, timeouts, and transient error retries with exponential backoff.
   */
  complete(options: AICompletionOptions): Promise<AICompletionResult>;
}

export const AI_PROVIDER_TOKEN = 'AI_PROVIDER_TOKEN';
