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
    // Matches the exact code pattern from issue #212
    const { textStream } = streamText({
      model,
      prompt: 'What is the weather in San Francisco?',
    });

    // Consume the stream to completion - this is where the original error occurred
    let fullText = '';
    for await (const chunk of textStream) {
      fullText += chunk;
    }

    expect(fullText).toBeDefined();
    expect(fullText.length).toBeGreaterThan(0);
  });

  it('should handle generateText with anthropic/claude-3.5-sonnet:online without errors', async () => {
    // Also test non-streaming to ensure both paths work
    const response = await generateText({
      model,
      prompt: 'What is the population of Tokyo?',
    });

    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
    expect(response.finishReason).toBeDefined();
  });
});
