/**
 * Regression test for GitHub issue #248
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/248
 *
 * Issue: "google/gemini-3-pro-preview: search capability returns empty responses"
 *
 * Issue thread timeline:
 * - Nov 23, 2025: User reports Gemini 3 Pro Preview with reasoning (effort: "high")
 *   and web search plugin "almost always returning an empty response"
 * - Dec 7, 2025: User reports 502 errors with metadata:
 *   "Malformed function call: call:google_search{query:"602-3973-01 part number"}"
 * - Dec 7, 2025: User tests other models:
 *   - "Anthropic Opus 4.5 search also bugs out, but no error in response"
 *   - "Anthropic Sonnet 4.5 bugs out mid response. Stream cuts and partial response"
 *   - "OpenAI GPT 5.1 search seems to be the only consistent experience"
 * - Jan 27, 2026: User notes "gemini-3-flash-preview works"
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

  describe('google/gemini-3-pro-preview (original issue)', () => {
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

    it('should return non-empty streaming response with streamText', async () => {
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
      // Dec 7 comment: 502 errors with "Malformed function call: call:google_search{query:"602-3973-01 part number"}"
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

  describe('google/gemini-3-flash-preview (Jan 27 comment: "works")', () => {
    const model = openrouter('google/gemini-3-flash-preview');

    it('should return non-empty response with web search', async () => {
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
  });

  describe('anthropic/claude-sonnet-4 (Dec 7 comment: stream cuts, partial response)', () => {
    const model = openrouter('anthropic/claude-sonnet-4');

    it('should return complete streaming response with web search', async () => {
      const result = await streamText({
        model,
        providerOptions: {
          openrouter: {
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
  });

  describe('anthropic/claude-opus-4 (Dec 7 comment: bugs out, no error)', () => {
    const model = openrouter('anthropic/claude-opus-4');

    it('should return non-empty response with web search', async () => {
      const response = await generateText({
        model,
        providerOptions: {
          openrouter: {
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
  });

  describe('openai/gpt-4.1 (Dec 7 comment: "only consistent experience")', () => {
    const model = openrouter('openai/gpt-4.1');

    it('should return non-empty response with web search', async () => {
      const response = await generateText({
        model,
        providerOptions: {
          openrouter: {
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
  });
});
