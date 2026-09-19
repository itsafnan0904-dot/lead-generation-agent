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

/**
 * AI_PROVIDER_TOKEN
 * Dependency Injection token for the core AI Provider.
 *
 * CRITICAL ARCHITECTURAL SAFEGUARD / CONVENTION:
 * 1. Live verification scripts and production paths MUST NEVER silently mock or substitute
 *    this provider with hardcoded simulated responses when OPENAI_API_KEY is missing.
 * 2. If OPENAI_API_KEY is missing, live execution must fail loudly with AIProviderNotConfiguredError.
 * 3. Provider overriding via `overrideProvider(AI_PROVIDER_TOKEN)` is STRICTLY PROHIBITED outside
 *    of isolated automated unit test suites (`*.spec.ts`).
 * 4. Any test-double provider constructed for unit testing must be named with explicit test markers
 *    (e.g., `mockAIProvider` or `FAKE_AI_PROVIDER_TEST_DOUBLE_ONLY`) to prevent accidental leakage into reports.
 */
export const AI_PROVIDER_TOKEN = 'AI_PROVIDER_TOKEN';
