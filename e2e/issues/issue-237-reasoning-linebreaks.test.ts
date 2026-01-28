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
 * This test uses the EXACT code and prompt from the issue to verify the behavior.
 */
import { streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #237: Reasoning line breaks in reasoning-delta stream', () => {
  /**
   * This test reproduces the EXACT code from issue #237.
   *
   * The issue reports that section titles like "**Exploring mathematical concepts**"
   * don't have line breaks before them, resulting in output like:
   * "intriguing!**Discussing arithmetic and set theory**"
   *
   * The test checks for the exact issue pattern: non-whitespace character
   * immediately followed by ** (bold marker).
   *
   * SKIPPED: This is an upstream issue in the OpenRouter/OpenAI API, not in ai-sdk-provider.
   * The ai-sdk-provider correctly passes through reasoning text without modification.
   * Unskip this test to verify when the upstream fix is deployed.
   */
  it.skip('should have line breaks before bold section headers (exact reproduction from issue)', async () => {
    // EXACT code from issue #237
    const provider = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = provider('openai/gpt-5.1');

    const stream = streamText({
      model,
      // EXACT prompt from issue #237
      prompt:
        'Think before answering. When does 2+2 not equal 4? Not counting final fields',
    });

    let reasoning = '';

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'reasoning-delta') {
        reasoning += chunk.text;
      }
    }

    // Verify we received reasoning content
    expect(reasoning.length).toBeGreaterThan(0);

    // Check for the exact issue pattern from #237:
    // Non-whitespace character immediately followed by ** (bold section header)
    // Example: "intriguing!**Discussing" - no line break before the bold marker
    const issuePattern = /[^\s\n]\*\*/g;
    const matches = reasoning.match(issuePattern);

    if (matches && matches.length > 0) {
      // Find context around each match for better error messages
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

      // Fail with detailed information about where the issue occurs
      expect.fail(
        `Found ${matches.length} instance(s) of missing line breaks before bold section headers:\n` +
          contexts.map((c, i) => `  ${i + 1}. "...${c}..."`).join('\n') +
          '\n\nThis is the exact issue reported in #237: section titles like ' +
          '"**Exploring mathematical concepts**" do not have line breaks before them.',
      );
    }

    // If we get here, all ** markers are preceded by whitespace/newline - issue is fixed
  });

  /**
   * Verification test using the exact code pattern from issue #237.
   * This test passes regardless of the line break issue - it just verifies
   * that the ai-sdk-provider correctly receives and accumulates reasoning chunks.
   */
  it('should receive reasoning-delta chunks using exact issue #237 code pattern', async () => {
    // EXACT code pattern from issue #237
    const provider = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = provider('openai/gpt-5.1');

    const stream = streamText({
      model,
      // EXACT prompt from issue #237
      prompt:
        'Think before answering. When does 2+2 not equal 4? Not counting final fields',
    });

    let reasoning = '';

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'reasoning-delta') {
        reasoning += chunk.text;
      }
    }

    // Verify the ai-sdk-provider correctly receives reasoning content
    expect(reasoning.length).toBeGreaterThan(0);

    // Log the reasoning output for manual inspection
    console.log('\n=== REASONING OUTPUT (Issue #237 reproduction) ===\n');
    console.log(reasoning);
    console.log('\n=== END REASONING OUTPUT ===\n');
  });
});
