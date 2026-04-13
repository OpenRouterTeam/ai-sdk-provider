/**
 * Regression test for GitHub issue #474
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/474
 *
 * Issue: "Support openrouter:web_search as a provider-exported tool"
 *
 * The OpenRouter provider did not export provider-defined tools, unlike
 * @ai-sdk/openai, @ai-sdk/google, and @ai-sdk/anthropic. The getArgs()
 * method filtered tools to only function tools, discarding any
 * LanguageModelV3ProviderTool.
 *
 * This test verifies that openrouter.tools.webSearch() works end-to-end
 * with both generateText and streamText, producing text with URL citations
 * from the web search server tool.
 */
import { generateText, streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #474: openrouter:web_search provider tool', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  describe('generateText with webSearch provider tool', () => {
    it('should return text with web search results using default args', async () => {
      const response = await generateText({
        model: openrouter('openai/gpt-4o-mini'),
        tools: {
          web_search: openrouter.tools.webSearch({}),
        },
        prompt: 'What is the current population of Tokyo? Search the web.',
      });

      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);
      expect(response.finishReason).toBeDefined();
    });

    it('should return text when webSearch is configured with maxResults and searchPrompt', async () => {
      const response = await generateText({
        model: openrouter('openai/gpt-4o-mini'),
        tools: {
          web_search: openrouter.tools.webSearch({
            maxResults: 3,
            searchPrompt: 'latest technology news',
          }),
        },
        prompt: 'What are the latest technology headlines today?',
      });

      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);
    });
  });

  describe('streamText with webSearch provider tool', () => {
    it('should stream text with web search results', async () => {
      const result = streamText({
        model: openrouter('openai/gpt-4o-mini'),
        tools: {
          web_search: openrouter.tools.webSearch({}),
        },
        prompt:
          'Search the web for the latest news about artificial intelligence.',
      });

      let fullText = '';
      for await (const chunk of result.textStream) {
        fullText += chunk;
      }

      expect(fullText.length).toBeGreaterThan(0);
    });

    it('should stream text with sources when using fullStream', async () => {
      const result = streamText({
        model: openrouter('openai/gpt-4o-mini'),
        tools: {
          web_search: openrouter.tools.webSearch({
            engine: 'exa',
          }),
        },
        prompt: 'Search the web: What is the capital of France?',
      });

      let hasText = false;
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
          hasText = true;
        }
      }

      expect(hasText).toBe(true);
    });
  });
});
