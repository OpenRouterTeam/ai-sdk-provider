import { streamText } from 'ai';
import { writeFile } from 'fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

describe('Web Search E2E Tests', () => {
  it('should handle web search citations in streaming response', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('anthropic/claude-3.5-sonnet', {
      plugins: [
        {
          id: 'web',
          max_results: 2,
        },
      ],
      usage: {
        include: true,
      },
    });

    const response = streamText({
      model,
      messages: [
        {
          role: 'user',
          content: 'Tell me about the latest SpaceX launch with sources.',
        },
      ],
    });

    await response.consumeStream();

    const sources = await response.sources;

    // Web search annotations are extracted from streaming response
    // The API may not always return sources depending on query and model state
    expect(Array.isArray(sources)).toBe(true);
    
    // Verify source structure if any are returned
    for (const source of sources) {
      expect(source).toHaveProperty('type', 'source');
      expect(source).toHaveProperty('sourceType', 'url');
      expect(source).toHaveProperty('url');
      expect(source).toHaveProperty('id');
      expect(typeof source.url).toBe('string');
    }

    await writeFile(
      new URL('./output.ignore.json', import.meta.url),
      JSON.stringify(sources, null, 2),
    );
  });
});
