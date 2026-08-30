import { OpenAIProvider } from './openai.provider';
import {
  AIProviderTransientError,
  AIProviderFatalError,
} from '../errors/ai-errors';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    // Isolate environment
    delete process.env.OPENAI_API_KEY;

    mockCreate = jest.fn();
    provider = new OpenAIProvider();

    // Inject mock client directly into provider instance to guarantee zero real network transport
    (provider as any).client = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('completes request with json_schema structured outputs and returns usage metadata', async () => {
    const mockApiResponse = {
      model: 'gpt-4o-mini',
      choices: [
        {
          message: {
            content: JSON.stringify({ result: 'CLEAR', reason: 'No issue' }),
          },
        },
      ],
      usage: {
        prompt_tokens: 45,
        completion_tokens: 15,
        total_tokens: 60,
      },
    };

    mockCreate.mockResolvedValue(mockApiResponse);

    const result = await provider.complete({
      prompt: 'Check restriction for Acme',
      schema: {
        name: 'test_schema',
        schema: { type: 'object', properties: { result: { type: 'string' } } },
        strict: true,
      },
    });

    expect(result.rawContent).toContain('CLEAR');
    expect(result.parsedContent).toEqual({ result: 'CLEAR', reason: 'No issue' });
    expect(result.modelUsed).toBe('gpt-4o-mini');
    expect(result.usage.totalTokens).toBe(60);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'test_schema',
            description: undefined,
            schema: expect.any(Object),
            strict: true,
          },
        },
      }),
      expect.objectContaining({ timeout: 30000 }),
    );
  });

  it('retries on transient rate-limit (429) errors with fake timers and succeeds', async () => {
    jest.useFakeTimers();

    const rateLimitError = new Error('Simulated 429 Rate limit exceeded from mock double');
    (rateLimitError as any).status = 429;

    const successResponse = {
      model: 'gpt-4o-mini',
      choices: [{ message: { content: '{"status":"ok"}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };

    mockCreate
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce(successResponse);

    const completePromise = provider.complete({
      prompt: 'Test prompt',
      maxRetries: 2,
    });

    // Advance fake timer to fast-forward through backoff delay
    await jest.advanceTimersByTimeAsync(3000);

    const result = await completePromise;

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.rawContent).toBe('{"status":"ok"}');
  });

  it('does not retry on fatal errors (401 invalid API key) and throws AIProviderFatalError immediately', async () => {
    const authError = new Error('Simulated 401 Incorrect API key provided from mock double');
    (authError as any).status = 401;

    mockCreate.mockRejectedValue(authError);

    await expect(
      provider.complete({
        prompt: 'Test prompt',
        maxRetries: 3,
      }),
    ).rejects.toThrow(AIProviderFatalError);

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('throws AIProviderFatalError immediately if client is not initialized', async () => {
    const uninitializedProvider = new OpenAIProvider();
    (uninitializedProvider as any).client = null;

    await expect(
      uninitializedProvider.complete({
        prompt: 'Test prompt',
      }),
    ).rejects.toThrow(AIProviderFatalError);
  });
});
