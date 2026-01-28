/**
 * Regression test for GitHub issue #237
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/237
 *
 * Issue: When streaming reasoning content with openai/gpt-5.1, section titles
 * (like `**Exploring mathematical concepts**`) don't have line breaks before them.
 * Example: "intriguing!**Discussing arithmetic and set theory**"
 */
import { streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #237: Reasoning line breaks in reasoning-delta stream', () => {
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  // SKIPPED: Issue is still reproducible as of 2025-01-28. Unskip to verify if fixed.
  it.skip('should have line breaks before bold section headers', async () => {
    const model = provider('openai/gpt-5.1');

    const stream = streamText({
      model,
      prompt:
        'Think before answering. When does 2+2 not equal 4? Not counting final fields',
    });

    let reasoning = '';

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'reasoning-delta') {
        reasoning += chunk.text;
      }
    }

    expect(reasoning.length).toBeGreaterThan(0);

    // Pattern: non-whitespace immediately followed by ** (bold marker)
    const issuePattern = /[^\s\n]\*\*/g;
    const matches = reasoning.match(issuePattern);

    if (matches && matches.length > 0) {
      const contexts: string[] = [];
      let searchStart = 0;
      for (const match of matches) {
        const idx = reasoning.indexOf(match, searchStart);
        if (idx !== -1) {
          const start = Math.max(0, idx - 20);
          const end = Math.min(reasoning.length, idx + match.length + 30);
          contexts.push(reasoning.substring(start, end).replace(/\n/g, '\\n'));
          searchStart = idx + 1;
        }
      }

      expect.fail(
        `Found ${matches.length} instance(s) of missing line breaks before bold section headers:\n` +
          contexts.map((c, i) => `  ${i + 1}. "...${c}..."`).join('\n'),
      );
    }
  });

  it('should receive reasoning-delta chunks', async () => {
    const model = provider('openai/gpt-5.1');

    const stream = streamText({
      model,
      prompt:
        'Think before answering. When does 2+2 not equal 4? Not counting final fields',
    });

    let reasoning = '';

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'reasoning-delta') {
        reasoning += chunk.text;
      }
    }

    expect(reasoning.length).toBeGreaterThan(0);

    console.log('\n=== REASONING OUTPUT ===\n');
    console.log(reasoning);
    console.log('\n=== END REASONING OUTPUT ===\n');
  });
});
