/**
 * Regression test for GitHub issue #248
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/248
 *
 * Issue: "google/gemini-3-pro-preview: search capability returns empty responses"
 *
 * Original report: User was using Gemini 3 Pro Preview with providerOptions
 * containing reasoning (effort: "high") and web search plugin, and getting
 * empty responses. A follow-up comment showed 502 errors with "Malformed
 * function call" when the model tried to use google_search.
 *
 * This test verifies that Gemini 3 Pro Preview with reasoning + web search
 * returns non-empty responses using the exact code pattern from the issue.
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

  const model = openrouter('google/gemini-3-pro-preview');

  it('should return non-empty response with generateText using exact issue code pattern', async () => {
    // Exact code pattern from issue #248:
    // https://github.com/OpenRouterTeam/ai-sdk-provider/issues/248
    const response = await generateText({
      model,
      providerOptions: {
        openrouter: {
          reasoning: { effort: 'high' },
          plugins: [{ id: 'web' }],
        },
      },
      messages: [
        {
          role: 'user',
          content: 'What is the current weather in San Francisco?',
        },
      ],
    });

    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
    expect(response.finishReason).toBeDefined();
  });

  it('should return non-empty streaming response with streamText using exact issue code pattern', async () => {
    const result = await streamText({
      model,
      providerOptions: {
        openrouter: {
          reasoning: { effort: 'high' },
          plugins: [{ id: 'web' }],
        },
      },
      messages: [
        {
          role: 'user',
          content: 'What are the top 3 news headlines today?',
        },
      ],
    });

    const text = await result.text;

    expect(text).toBeDefined();
    expect(text.length).toBeGreaterThan(0);
  });

  it('should handle part number search queries without 502 errors', async () => {
    // From Dec 7 comment: user reported 502 errors with "Malformed function call"
    // when searching for part numbers like "602-3973-01 part number"
    const response = await generateText({
      model,
      providerOptions: {
        openrouter: {
          reasoning: { effort: 'high' },
          plugins: [{ id: 'web' }],
        },
      },
      messages: [
        {
          role: 'user',
          content: 'Search for information about part number 602-3973-01',
        },
      ],
    });

    expect(response.text).toBeDefined();
    expect(response.text.length).toBeGreaterThan(0);
    expect(response.finishReason).toBeDefined();
  });
});
