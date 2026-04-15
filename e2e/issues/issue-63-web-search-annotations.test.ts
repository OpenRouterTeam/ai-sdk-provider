/**
 * Regression test for GitHub issue #63
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/63
 *
 * Issue: "Annotations are not returned for web search results"
 *
 * Reported behavior: When using `:online` models (e.g. openai/gpt-4o-mini:online),
 * the SDK did not return `url_citation` annotations as `sources` in the response.
 * Both `generateText` and `streamText` were affected.
 *
 * This test verifies that `:online` models return sources with url and title
 * metadata via both `generateText` and `streamText`.
 */
import { generateText, streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #63: Annotations not returned for web search results', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  describe('openai/gpt-4o-mini:online via generateText', () => {
    it('should return sources with url and title from url_citation annotations', async () => {
      const response = await generateText({
        model: openrouter('openai/gpt-4o-mini:online'),
        prompt: 'What is the current population of Tokyo? Cite your sources.',
      });

      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);

      expect(response.sources).toBeDefined();
      expect(response.sources.length).toBeGreaterThan(0);

      const urlSources = response.sources.filter((s) => s.sourceType === 'url');
      expect(urlSources.length).toBeGreaterThan(0);

      for (const source of urlSources) {
        expect(source.url).toBeDefined();
        expect(source.url.length).toBeGreaterThan(0);
        expect(source.title).toBeDefined();
      }
    });
  });

  describe('openai/gpt-4o-mini:online via streamText', () => {
    it('should return sources via the streaming annotations path', async () => {
      const result = streamText({
        model: openrouter('openai/gpt-4o-mini:online'),
        prompt: 'What are the latest news headlines today? Cite your sources.',
      });

      await result.consumeStream();

      const sources = await result.sources;
      expect(sources).toBeDefined();
      expect(sources.length).toBeGreaterThan(0);

      const urlSources = sources.filter((s) => s.sourceType === 'url');
      expect(urlSources.length).toBeGreaterThan(0);

      for (const source of urlSources) {
        expect(source.url).toBeDefined();
        expect(source.url.length).toBeGreaterThan(0);
        expect(source.title).toBeDefined();
      }
    });

    it('should accumulate sources correctly via fullStream', async () => {
      const result = streamText({
        model: openrouter('openai/gpt-4o-mini:online'),
        prompt: 'What is the weather forecast for New York City this week?',
      });

      let hasText = false;
      let hasSource = false;
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
          hasText = true;
        }
        if (chunk.type === 'source' && chunk.sourceType === 'url') {
          hasSource = true;
          expect(chunk.url).toBeDefined();
          expect(chunk.url.length).toBeGreaterThan(0);
          expect(chunk.title).toBeDefined();
        }
      }

      expect(hasText).toBe(true);
      expect(hasSource).toBe(true);
    });
  });

  describe('openai/gpt-4o:online (different :online model)', () => {
    it('should also return sources with url and title via generateText', async () => {
      const response = await generateText({
        model: openrouter('openai/gpt-4o:online'),
        prompt:
          'What is the capital of France and its current population? Cite your sources.',
      });

      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);

      expect(response.sources).toBeDefined();
      expect(response.sources.length).toBeGreaterThan(0);

      const urlSources = response.sources.filter((s) => s.sourceType === 'url');
      expect(urlSources.length).toBeGreaterThan(0);

      for (const source of urlSources) {
        expect(source.url).toBeDefined();
        expect(source.url.length).toBeGreaterThan(0);
        expect(source.title).toBeDefined();
      }
    });
  });

  describe('source object field validation', () => {
    it('should include providerMetadata with openrouter-specific fields', async () => {
      const response = await generateText({
        model: openrouter('openai/gpt-4o-mini:online'),
        prompt: 'What is the tallest building in the world? Cite your sources.',
      });

      expect(response.sources.length).toBeGreaterThan(0);

      const urlSources = response.sources.filter((s) => s.sourceType === 'url');
      expect(urlSources.length).toBeGreaterThan(0);

      for (const source of urlSources) {
        expect(source.url).toBeDefined();
        expect(source.title).toBeDefined();
        expect(source.providerMetadata).toBeDefined();
        expect(source.providerMetadata?.openrouter).toBeDefined();
      }
    });
  });

  describe('non-:online model should not return spurious sources', () => {
    it('should return empty sources array for a standard model without web search', async () => {
      const response = await generateText({
        model: openrouter('openai/gpt-4o-mini'),
        prompt: 'What is 2 + 2?',
      });

      expect(response.text).toBeDefined();
      expect(response.text.length).toBeGreaterThan(0);
      expect(response.sources).toBeDefined();
      expect(response.sources.length).toBe(0);
    });
  });
});
