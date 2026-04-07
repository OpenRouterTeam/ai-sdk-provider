/**
 * Regression test for GitHub issue #212
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/212
 *
 * Issue: "Anthropic Model Error with Web Search :online Applied"
 *
 * Reported behavior: Using anthropic/claude-sonnet-4.5:online with streamText threw
 * AI_APICallError: Expected 'id' to be a string. The reporter noted the initial
 * toolCallDelta arrived without an 'id' field:
 *   { "index": 0, "type": "function", "function": { "arguments": "" } }
 * openai/gpt-4o:online worked correctly.
 *
 * Comment from chas-bean (Nov 10): "We are also seeing this issue and it requires
 * us to completely roll-back this feature in our chat application."
 *
 * Comment from robert-j-y (Jan 27): "The web search citation handling was improved
 * in our latest releases, but the specific toolCallDelta ID issue needs testing
 * to confirm."
 *
 * This test verifies that :online models work without errors for both streaming
 * and non-streaming paths, including the fullStream path that exposes tool call
 * events where the original bug manifested.
 */
import { generateText, streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Issue #212: Anthropic Web Search :online Error', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  describe('anthropic/claude-sonnet-4.5:online (exact model from issue)', () => {
    const model = openrouter('anthropic/claude-sonnet-4.5:online');

    it('should handle streaming with anthropic/claude-sonnet-4.5:online without errors', async () => {
      const { textStream } = streamText({
        model,
        prompt: 'What is the weather in San Francisco?',
      });

      let fullText = '';
      for await (const chunk of textStream) {
        fullText += chunk;
      }

      expect(fullText).toBeDefined();
      expect(fullText.length).toBeGreaterThan(0);
    });

    it('should handle generateText with anthropic/claude-sonnet-4.5:online without errors', async () => {
      const response = await generateText({
        model,
        prompt: 'What is the population of Tokyo?',
      });

      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);
      expect(response.finishReason).toBeDefined();
    });

    it('should not throw "Expected id to be a string" on fullStream path', async () => {
      // The original bug manifested when processing tool call deltas in the
      // stream — the toolCallDelta arrived without an 'id' field, causing
      // a parse error. The fullStream path exposes these events directly.
      const result = streamText({
        model,
        prompt: 'What are the latest news headlines today?',
      });

      let hasText = false;
      let hasToolCall = false;

      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
          hasText = true;
        }
        if (chunk.type === 'tool-call') {
          hasToolCall = true;
        }
      }

      // At minimum we should get text content — web search results
      expect(hasText).toBe(true);

      // Tool calls may or may not be present depending on model behavior,
      // but the stream should complete without throwing
      if (hasToolCall) {
        console.log('Tool call events received — web search tool was invoked');
      }
    });
  });

  describe('openai/gpt-4o:online (reported as working in issue)', () => {
    const model = openrouter('openai/gpt-4o:online');

    it('should handle streaming with openai/gpt-4o:online without errors', async () => {
      const result = streamText({
        model,
        prompt: 'What is the current date and latest tech news?',
      });

      let fullText = '';
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
          fullText += chunk.text;
        }
      }

      expect(fullText.length).toBeGreaterThan(0);
    });

    it('should handle generateText with openai/gpt-4o:online without errors', async () => {
      const response = await generateText({
        model,
        prompt: 'What is the population of London?',
      });

      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);
    });
  });
});
