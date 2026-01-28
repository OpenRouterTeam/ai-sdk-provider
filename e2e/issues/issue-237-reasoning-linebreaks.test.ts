/**
 * Regression test for GitHub issue #237
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/237
 *
 * Issue: "Missing line breaks between reasoning sections in `reasoning-delta` stream"
 *
 * Problem: When streaming reasoning content with openai/gpt-5.1, section titles
 * (like `**Exploring mathematical concepts**`) don't have line breaks before them.
 * Example from issue: "intriguing!**Discussing arithmetic and set theory**"
 *
 * Root cause: This is an UPSTREAM issue - the OpenRouter API or OpenAI API does not
 * include line breaks between reasoning sections. The ai-sdk-provider correctly
 * passes through the reasoning text without modification.
 *
 * This test verifies the exact issue pattern: non-whitespace characters immediately
 * followed by bold section markers (**). The test will FAIL while the upstream
 * issue persists, and will PASS once it's fixed.
 */
import { streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #237: Reasoning line breaks in reasoning-delta stream', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  /**
   * This test checks for the exact issue pattern from #237:
   * - Non-whitespace character immediately followed by ** (bold marker)
   * - Example: "intriguing!**Discussing" or "misuse.**Explaining"
   *
   * The test FAILS if this pattern is found (issue still present).
   * The test PASSES if all ** markers are preceded by whitespace/newline (issue fixed).
   *
   * SKIPPED: This is an upstream issue in the OpenRouter/OpenAI API, not in ai-sdk-provider.
   * The ai-sdk-provider correctly passes through reasoning text without modification.
   * Unskip this test to verify when the upstream fix is deployed.
   */
  it.skip('should have line breaks before bold section headers in reasoning (upstream issue)', async () => {
    const model = openrouter('openai/gpt-5.1', {
      usage: { include: true },
    });

    const response = await streamText({
      model,
      messages: [
        {
          role: 'user',
          content:
            'Explain the difference between prime numbers and composite numbers. Think through this step by step.',
        },
      ],
    });

    let reasoning = '';
    const reasoningChunks: string[] = [];

    for await (const chunk of response.fullStream) {
      if (chunk.type === 'reasoning-delta') {
        const delta =
          (chunk as { type: 'reasoning-delta'; text?: string }).text || '';
        reasoningChunks.push(delta);
        reasoning += delta;
      }
    }

    // Verify we received reasoning content
    expect(reasoningChunks.length).toBeGreaterThan(0);
    expect(reasoning.length).toBeGreaterThan(0);

    // Check for the exact issue pattern: non-whitespace followed by **
    // This matches patterns like "intriguing!**" or "misuse.**" or "primes**"
    const issuePattern = /[^\s\n]\*\*/g;
    const matches = reasoning.match(issuePattern);

    if (matches && matches.length > 0) {
      // Find context around each match for better error messages
      const contexts: string[] = [];
      let searchStart = 0;
      for (const match of matches) {
        const idx = reasoning.indexOf(match, searchStart);
        if (idx !== -1) {
          const start = Math.max(0, idx - 15);
          const end = Math.min(reasoning.length, idx + match.length + 25);
          contexts.push(reasoning.substring(start, end).replace(/\n/g, '\\n'));
          searchStart = idx + 1;
        }
      }

      // Fail with detailed information about where the issue occurs
      expect.fail(
        `Found ${matches.length} instance(s) of missing line breaks before bold markers:\n` +
          contexts.map((c, i) => `  ${i + 1}. "...${c}..."`).join('\n') +
          '\n\nThis is the exact issue reported in #237. ' +
          'The upstream API is not including line breaks between reasoning sections.',
      );
    }

    // If we get here, no issues found - the upstream fix has been deployed
  });

  /**
   * Verification test that reasoning-delta streaming works correctly.
   * This test passes regardless of the line break issue - it just verifies
   * that the ai-sdk-provider correctly receives and accumulates reasoning chunks.
   */
  it('should receive reasoning-delta chunks from GPT-5.1', async () => {
    const model = openrouter('openai/gpt-5.1', {
      usage: { include: true },
    });

    const response = await streamText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is 2+2? Think step by step.',
        },
      ],
    });

    let reasoning = '';
    const reasoningChunks: string[] = [];

    for await (const chunk of response.fullStream) {
      if (chunk.type === 'reasoning-delta') {
        const delta =
          (chunk as { type: 'reasoning-delta'; text?: string }).text || '';
        reasoningChunks.push(delta);
        reasoning += delta;
      }
    }

    // Verify the ai-sdk-provider correctly receives reasoning content
    expect(reasoningChunks.length).toBeGreaterThan(0);
    expect(reasoning.length).toBeGreaterThan(0);
  });

  /**
   * Cross-model verification with Claude to ensure reasoning streaming works.
   */
  it('should receive reasoning-delta chunks from Claude', async () => {
    const model = openrouter('anthropic/claude-sonnet-4', {
      usage: { include: true },
    });

    const response = await streamText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is 2+2? Think step by step.',
        },
      ],
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'medium',
          },
        },
      },
    });

    let reasoning = '';
    const reasoningChunks: string[] = [];

    for await (const chunk of response.fullStream) {
      if (chunk.type === 'reasoning-delta') {
        const delta =
          (chunk as { type: 'reasoning-delta'; text?: string }).text || '';
        reasoningChunks.push(delta);
        reasoning += delta;
      }
    }

    // Verify the ai-sdk-provider correctly receives reasoning content
    expect(reasoningChunks.length).toBeGreaterThan(0);
    expect(reasoning.length).toBeGreaterThan(0);
  });
});
