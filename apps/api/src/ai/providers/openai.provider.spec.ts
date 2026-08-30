import { OpenAIProvider } from './openai.provider';
import {
  AIProviderTransientError,
  AIProviderFatalError,
} from '../errors/ai-errors';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockOpenAIClient: any;

  beforeEach(() => {
    mockOpenAIClient = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };

    provider = new OpenAIProvider();
    (provider as any).client = mockOpenAIClient;
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

    mockOpenAIClient.chat.completions.create.mockResolvedValue(mockApiResponse);

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
    expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith(
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

  it('retries on transient rate-limit (429) errors with backoff and succeeds', async () => {
    const rateLimitError = new Error('Rate limit exceeded');
    (rateLimitError as any).status = 429;

    const successResponse = {
      model: 'gpt-4o-mini',
      choices: [{ message: { content: '{"status":"ok"}' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };

    mockOpenAIClient.chat.completions.create
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce(successResponse);

    const result = await provider.complete({
      prompt: 'Test prompt',
      maxRetries: 2,
    });

    expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledTimes(2);
    expect(result.rawContent).toBe('{"status":"ok"}');
  });

  it('does not retry on fatal errors (401 invalid API key) and throws AIProviderFatalError immediately', async () => {
    const authError = new Error('Incorrect API key provided');
    (authError as any).status = 401;

    mockOpenAIClient.chat.completions.create.mockRejectedValue(authError);

    await expect(
      provider.complete({
        prompt: 'Test prompt',
        maxRetries: 3,
      }),
    ).rejects.toThrow(AIProviderFatalError);

    expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledTimes(1);
  });
});
