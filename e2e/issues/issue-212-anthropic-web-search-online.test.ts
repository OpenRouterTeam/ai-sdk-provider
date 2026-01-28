/**
 * Regression test for GitHub issue #212
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/212
 *
 * Issue: "Anthropic Model Error with Web Search :online Applied" - AI_APICallError:
 * Expected 'id' to be a string when using Anthropic models with the :online suffix.
 *
 * Root cause: Anthropic's web search returns special content blocks (server_tool_use,
 * web_search_tool_result) that were incorrectly processed as tool calls with missing
 * 'id' fields. The primary fix was server-side (Dec 4, 2025) which added proper handling
 * for these content blocks. Additional SDK improvements were made for web search
 * annotation parsing and optional url_citation schema fields.
 *
 * This test verifies that Anthropic models with web search (:online suffix) work correctly:
 * - streamText returns valid streaming responses without "Expected 'id' to be a string" errors
 * - generateText returns valid non-streaming responses
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

  const model = openrouter('anthropic/claude-3.5-sonnet:online');

  it('should handle streaming with anthropic/claude-3.5-sonnet:online without errors', async () => {
    const result = streamText({
      model,
      messages: [
        {
          role: 'user',
          content:
            'What is the current weather in San Francisco? Keep your answer brief.',
        },
      ],
    });

    await result.consumeStream();

    const text = await result.text;

    expect(text).toBeDefined();
    expect(text.length).toBeGreaterThan(0);

    // Verify sources are available from web search
    const sources = await result.sources;
    // Sources may or may not be present depending on the query, but no error should occur
    if (sources && sources.length > 0) {
      expect(sources[0]).toHaveProperty('url');
    }
  });

  it('should handle generateText with anthropic/claude-3.5-sonnet:online without errors', async () => {
    const response = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is the population of Tokyo? Keep your answer brief.',
        },
      ],
    });

    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
    expect(response.finishReason).toBeDefined();

    // Verify sources are available from web search
    // Sources may or may not be present depending on the query, but no error should occur
    if (response.sources && response.sources.length > 0) {
      expect(response.sources[0]).toHaveProperty('url');
    }
  });
});
