/**
 * Regression test for GitHub issue #438
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/438
 *
 * Reported error: Gemini reasoning models emit "[REDACTED]" as visible
 * reasoning text for encrypted reasoning details (reasoning.encrypted).
 * Model: google/gemini-3.1-pro-preview
 *
 * This test verifies that encrypted reasoning details do not produce
 * "[REDACTED]" reasoning content, while still being preserved in
 * providerMetadata for multi-turn conversation continuity.
 */
import { generateText, streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #438: Gemini reasoning should not emit [REDACTED]', () => {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should not emit [REDACTED] in streaming reasoning deltas', async () => {
    const model = openrouter('google/gemini-3.1-pro-preview');

    const result = streamText({
      model,
      prompt: 'What is 2+2? Answer briefly.',
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'high',
          },
        },
      },
    });

    const reasoningDeltas: string[] = [];

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'reasoning-delta') {
        reasoningDeltas.push(chunk.text);
      }
    }

    // No reasoning delta should contain [REDACTED]
    const allReasoningText = reasoningDeltas.join('');
    expect(allReasoningText).not.toContain('[REDACTED]');

    // Encrypted reasoning data should still be preserved in providerMetadata
    const providerMetadata = await result.providerMetadata;
    const openrouterMeta = providerMetadata?.openrouter as
      | Record<string, unknown>
      | undefined;
    expect(openrouterMeta).toBeDefined();

    const reasoningDetails = openrouterMeta?.reasoning_details as
      | Array<Record<string, unknown>>
      | undefined;
    expect(reasoningDetails).toBeDefined();
    expect(reasoningDetails?.length).toBeGreaterThan(0);

    const encryptedDetail = reasoningDetails?.find(
      (d) => d.type === 'reasoning.encrypted',
    );
    expect(encryptedDetail).toBeDefined();
    expect(encryptedDetail?.data).toBeDefined();
  });

  it('should not emit [REDACTED] in non-streaming reasoning content', async () => {
    const model = openrouter('google/gemini-3.1-pro-preview');

    const result = await generateText({
      model,
      prompt: 'What is 2+2? Answer briefly.',
      providerOptions: {
        openrouter: {
          reasoning: {
            effort: 'high',
          },
        },
      },
    });

    // Check that no reasoning content part contains [REDACTED]
    const reasoningParts = result.response.messages
      .filter((m) => m.role === 'assistant')
      .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .filter((p: { type: string }) => p.type === 'reasoning');

    for (const part of reasoningParts) {
      const textPart = part as { type: string; text?: string };
      if (textPart.text) {
        expect(textPart.text).not.toContain('[REDACTED]');
      }
    }

    // Encrypted data should still be in response-level providerMetadata
    const openrouterMeta = result.providerMetadata?.openrouter as
      | Record<string, unknown>
      | undefined;
    expect(openrouterMeta).toBeDefined();

    const reasoningDetails = openrouterMeta?.reasoning_details as
      | Array<Record<string, unknown>>
      | undefined;
    expect(reasoningDetails).toBeDefined();
    expect(reasoningDetails?.length).toBeGreaterThan(0);

    const encryptedDetail = reasoningDetails?.find(
      (d) => d.type === 'reasoning.encrypted',
    );
    expect(encryptedDetail).toBeDefined();
    expect(encryptedDetail?.data).toBeDefined();
  });
});
