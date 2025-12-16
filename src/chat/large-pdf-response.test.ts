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

describe('Large PDF Response Handling', () => {
  describe('doGenerate', () => {
    it('should handle HTTP 200 responses with error payloads (500 internal errors)', async () => {
      // This is the actual response OpenRouter returns for large PDF failures
      // HTTP 200 status but contains error object instead of choices
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

    it('should parse successful large PDF responses with file annotations', async () => {
      // Successful response with file annotations from FileParserPlugin
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
                content: 'LARGE-M9N3T',
                annotations: [
                  {
                    type: 'file_annotation',
                    file_annotation: {
                      file_id: 'file_abc123',
                      quote: 'extracted text',
                    },
                  },
                ],
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
            total_tokens: 120,
          },
        },
      };

      const model = provider('anthropic/claude-3.5-sonnet', {
        usage: { include: true },
      });

      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(result.content).toMatchObject([
        {
          type: 'text',
          text: 'LARGE-M9N3T',
        },
      ]);
      expect(result.usage.totalTokens).toBe(120);
    });
  });
});
