import type { LanguageModelV4Prompt } from '@ai-sdk/provider';

import { APICallError } from '@ai-sdk/provider';
import { createTestServer } from '@ai-sdk/test-server';
import {
  afterAll,
  afterEach,
  assert,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import { createOpenRouter } from '../provider';

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const provider = createOpenRouter({
  baseURL: 'https://test.openrouter.ai/api/v1',
  apiKey: 'test-api-key',
});

const server = createTestServer({
  'https://test.openrouter.ai/api/v1/chat/completions': {},
});

beforeAll(() => server.server.start());
afterEach(() => server.server.reset());
afterAll(() => server.server.stop());

describe('HTTP 200 Error Response Handling', () => {
  describe('doGenerate', () => {
    it('should throw APICallError for HTTP 200 responses with error payloads', async () => {
      // OpenRouter sometimes returns HTTP 200 with an error object instead of choices
      // This can occur for various server errors (e.g., internal errors, processing failures)
      server.urls[
        'https://test.openrouter.ai/api/v1/chat/completions'
      ]!.response = {
        type: 'json-value',
        body: {
          error: {
            message: 'Internal Server Error',
            code: 500,
          },
          user_id: 'org_abc123',
        },
      };

      const model = provider('anthropic/claude-3.5-sonnet');

      await expect(
        model.doGenerate({
          prompt: TEST_PROMPT,
        }),
      ).rejects.toThrow('Internal Server Error');
    });

    it('should parse successful responses normally when no error present', async () => {
      // Normal successful response without error
      server.urls[
        'https://test.openrouter.ai/api/v1/chat/completions'
      ]!.response = {
        type: 'json-value',
        body: {
          id: 'gen-123',
          model: 'anthropic/claude-3.5-sonnet',
          provider: 'Anthropic',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello! How can I help you?',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 8,
            total_tokens: 18,
          },
        },
      };

      const model = provider('anthropic/claude-3.5-sonnet');

      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result.content).toMatchObject([
        {
          type: 'text',
          text: 'Hello! How can I help you?',
        },
      ]);
      expect(
        (result.usage.inputTokens?.total ?? 0) +
          (result.usage.outputTokens?.total ?? 0),
      ).toBe(18);
    });

    it('should throw APICallError when the choice carries an error next to partial output', async () => {
      const error = {
        code: 502,
        message: 'Provider disconnected mid-stream',
        metadata: { error_type: 'provider_unavailable' },
      };
      server.urls[
        'https://test.openrouter.ai/api/v1/chat/completions'
      ]!.response = {
        type: 'json-value',
        body: {
          id: 'gen-123',
          model: 'anthropic/claude-3.5-sonnet',
          provider: 'Anthropic',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'partial output...',
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: {
                      name: 'get_weather',
                      arguments: '{"city":"Tokyo"}',
                    },
                  },
                ],
              },
              finish_reason: 'error',
              error,
            },
          ],
        },
      };

      const model = provider('anthropic/claude-3.5-sonnet');

      const thrown = await model
        .doGenerate({ prompt: TEST_PROMPT })
        .catch((e: unknown) => e);

      assert(APICallError.isInstance(thrown));
      expect(thrown.message).toBe('Provider disconnected mid-stream');
      expect(thrown.statusCode).toBe(200);
      expect(thrown.isRetryable).toBe(false);
      expect(thrown.data).toMatchObject(error);
      // The partial output stays reachable through the raw body.
      expect(JSON.parse(thrown.responseBody ?? '')).toMatchObject({
        choices: [{ message: { content: 'partial output...' } }],
      });
    });

    it('should parse responses whose choice has a null error', async () => {
      server.urls[
        'https://test.openrouter.ai/api/v1/chat/completions'
      ]!.response = {
        type: 'json-value',
        body: {
          id: 'gen-123',
          model: 'anthropic/claude-3.5-sonnet',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hello!' },
              finish_reason: 'stop',
              error: null,
            },
          ],
        },
      };

      const model = provider('anthropic/claude-3.5-sonnet');

      const result = await model.doGenerate({ prompt: TEST_PROMPT });

      expect(result.content).toMatchObject([{ type: 'text', text: 'Hello!' }]);
      expect(result.finishReason.unified).toBe('stop');
    });
  });
});
