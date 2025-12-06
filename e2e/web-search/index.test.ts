import { writeFile } from 'node:fs/promises';
import { streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

// Skip these tests until the date below - upstream provider issues with web search.
// The skip logic: tests are skipped while current date is BEFORE SKIP_UNTIL.
const SKIP_UNTIL = '2025-12-13';
const shouldSkip = new Date() < new Date(SKIP_UNTIL);

describe.skipIf(shouldSkip)('Web Search E2E Tests', () => {
  it('should handle web search citations in streaming response', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: `${process.env.OPENROUTER_API_BASE ?? 'https://openrouter.ai'}/api/v1`,
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

    // API may return more sources than requested max_results
    expect(sources.length).toBeGreaterThanOrEqual(2);

    await writeFile(
      new URL('./output.ignore.json', import.meta.url),
      JSON.stringify(sources, null, 2),
    );
  });
});
