/**
 * Regression test for GitHub issue #212
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/212
 *
 * Issue: "Anthropic Model Error with Web Search :online Applied"
 *
 * Reported behavior: Using anthropic/claude-sonnet-4.5:online with streamText threw
 * AI_APICallError: Expected 'id' to be a string. The reporter noted that
 * openai/gpt-4o:online worked correctly.
 *
 * This test verifies that anthropic/claude-sonnet-4.5:online works without errors.
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
});
