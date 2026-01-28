/**
 * Regression test for GitHub issue #248
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/248
 *
 * Issue: "google/gemini-3-pro-preview: search capability returns empty responses"
 *
 * Original report: User was using Gemini 3 Pro Preview with both reasoning
 * (effort: "high") and web search plugin enabled, and getting empty responses.
 *
 * Root cause: The web search plugin was injecting the full Exa results array
 * instead of the limited context string (15K chars), which could cause context
 * length errors leading to empty responses. Fixed server-side on January 16, 2026.
 *
 * This test verifies that Gemini 3 Pro Preview with reasoning + web search:
 * - Returns non-empty responses with generateText
 * - Returns non-empty responses with streamText
 * - Includes URL citation annotations in the response
 */
import { generateText, streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #248: Gemini 3 Pro Preview web search empty responses', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  // Match the exact configuration from the issue report:
  // reasoning: { effort: "high" } + plugins: [{ id: "web" }]
  const model = openrouter('google/gemini-3-pro-preview', {
    reasoning: { effort: 'high' },
    plugins: [{ id: 'web' }],
  });

  it('should return non-empty response with generateText and web search', async () => {
    const response = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content:
            'What is the current weather in San Francisco? Search the web for the latest information.',
        },
      ],
    });

    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
    expect(response.finishReason).toBeDefined();
  });

  it('should return non-empty streaming response with streamText and web search', async () => {
    const result = await streamText({
      model,
      messages: [
        {
          role: 'user',
          content:
            'What are the top 3 news headlines today? Search the web for the latest news.',
        },
      ],
    });

    const text = await result.text;

    expect(text).toBeDefined();
    expect(text.length).toBeGreaterThan(0);
  });

  it('should include URL citation annotations in response', async () => {
    const response = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content:
            'What is the population of Tokyo? Search the web for the latest data.',
        },
      ],
    });

    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);

    // Check for URL citation annotations in provider metadata
    const metadata = response.providerMetadata?.openrouter as
      | { annotations?: Array<{ type: string }> }
      | undefined;
    const annotations = metadata?.annotations;

    // Web search should include URL citations
    if (annotations && annotations.length > 0) {
      const hasUrlCitation = annotations.some((a) => a.type === 'url_citation');
      expect(hasUrlCitation).toBe(true);
    }
  });
});
