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

    expect(sources.length).toBe(2);

    await writeFile(
      new URL('./output.ignore.json', import.meta.url),
      JSON.stringify(sources, null, 2),
    );
  });
});
