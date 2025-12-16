import type { LanguageModelV2Prompt } from '@ai-sdk/provider';

import { createTestServer } from '@ai-sdk/provider-utils/test';
import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '../provider';

const TEST_PROMPT: LanguageModelV2Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];

const provider = createOpenRouter({
  baseURL: 'https://test.openrouter.ai/api/v1',
  apiKey: 'test-api-key',
});

const server = createTestServer({
  'https://test.openrouter.ai/api/v1/chat/completions': {},
});

describe('HTTP 200 Error Response Handling', () => {
  describe('doGenerate', () => {
    it('should throw APICallError for HTTP 200 responses with error payloads', async () => {
      // OpenRouter sometimes returns HTTP 200 with an error object instead of choices
      // This can occur for various server errors (e.g., internal errors, processing failures)
      server.urls[
        'https://test.openrouter.ai/api/v1/chat/completions'
      ].response = {
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
      ].response = {
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
      expect(result.usage.totalTokens).toBe(18);
    });
  });
});
