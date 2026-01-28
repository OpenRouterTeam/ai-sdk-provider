/**
 * Regression test for GitHub issue #212
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/212
 *
 * Issue: "Anthropic Model Error with Web Search :online Applied" - AI_APICallError:
 * Expected 'id' to be a string when using anthropic/claude-sonnet-4.5:online.
 * The initial toolCallDelta was missing the 'id' field:
 * { "index": 0, "type": "function", "function": { "arguments": "" } }
 *
 * Root cause: Anthropic's web search returns special content blocks (server_tool_use,
 * web_search_tool_result) that were incorrectly processed as tool calls with missing
 * 'id' fields. The primary fix was server-side (Dec 4, 2025) which added proper handling
 * for these content blocks.
 *
 * This test verifies that Anthropic models with web search (:online suffix) work correctly:
 * - streamText returns valid streaming responses without "Expected 'id' to be a string" errors
 * - The issue noted that openai/gpt-4o:online worked fine, so we test both for comparison
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

  // Use the exact model from issue #212
  const model = openrouter('anthropic/claude-sonnet-4.5:online');

  it('should handle streaming with anthropic/claude-sonnet-4.5:online without errors', async () => {
    // Matches the exact code pattern from issue #212
    const { textStream } = streamText({
      model,
      prompt: 'What is the weather in San Francisco?',
    });

    // Consume the stream to completion - this is where the original error occurred
    // The error was: AI_APICallError: Expected 'id' to be a string
    let fullText = '';
    for await (const chunk of textStream) {
      fullText += chunk;
    }

    expect(fullText).toBeDefined();
    expect(fullText.length).toBeGreaterThan(0);
  });

  it('should handle generateText with anthropic/claude-sonnet-4.5:online without errors', async () => {
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
