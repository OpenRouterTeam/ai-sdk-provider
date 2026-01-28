/**
 * Regression test for GitHub issue #237
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/237
 *
 * Issue: "Missing line breaks between reasoning sections in `reasoning-delta` stream"
 *
 * Root cause: The issue reported that when streaming reasoning content with
 * openai/gpt-5.1, section titles (like `**Exploring mathematical concepts**`)
 * didn't have line breaks before them, making output messy. Investigation
 * showed the ai-sdk-provider passes reasoning text through without modification.
 * Testing confirms line breaks are now preserved correctly - the issue was
 * either fixed upstream in the OpenRouter API or was specific to early model
 * behavior (model was only 5 days old when reported).
 *
 * This test verifies that:
 * - reasoning-delta chunks are received during streaming
 * - Line breaks are preserved in the accumulated reasoning content
 * - Bold section headers have proper line breaks before them
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

  it('should preserve line breaks in reasoning-delta stream with GPT-5.1', async () => {
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

    // Check for line breaks in reasoning (the original issue was missing line breaks)
    const lineBreakCount = (reasoning.match(/\n/g) || []).length;
    expect(lineBreakCount).toBeGreaterThan(0);

    // Verify bold section headers have proper line breaks before them
    // The issue showed patterns like "intriguing!**Discussing arithmetic**" without line breaks
    // After fix, bold headers should be preceded by line breaks (or be at the start)
    const boldSectionsWithoutLineBreak = reasoning.match(
      /[^\n]\*\*[A-Z][^*]+\*\*/g,
    );

    // If there are bold sections, they should have line breaks before them
    // (allowing for some at the very start of reasoning which won't have preceding newline)
    if (
      boldSectionsWithoutLineBreak &&
      boldSectionsWithoutLineBreak.length > 0
    ) {
      // Check if the first bold section is at the start (acceptable)
      const firstBoldIndex = reasoning.indexOf('**');
      const issuesExcludingStart =
        firstBoldIndex === 0
          ? boldSectionsWithoutLineBreak.length - 1
          : boldSectionsWithoutLineBreak.length;

      // We expect minimal issues (ideally 0, but allow 1 for edge cases)
      expect(issuesExcludingStart).toBeLessThanOrEqual(1);
    }
  });

  it('should preserve line breaks in reasoning-delta stream with Claude', async () => {
    const model = openrouter('anthropic/claude-sonnet-4', {
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

    // Verify we received reasoning content
    expect(reasoningChunks.length).toBeGreaterThan(0);
    expect(reasoning.length).toBeGreaterThan(0);

    // Check for line breaks in reasoning
    const lineBreakCount = (reasoning.match(/\n/g) || []).length;
    expect(lineBreakCount).toBeGreaterThan(0);
  });
});
