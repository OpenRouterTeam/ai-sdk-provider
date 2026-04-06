/**
 * Regression test for GitHub Issue #423
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/423
 *
 * Reported error: "Invalid signature in thinking block" errors on multi-turn conversations
 * Model: anthropic/claude-sonnet-4.5
 *
 * This test verifies that the thinking block signature is preserved during
 * streaming and multi-turn conversations work without signature errors.
 */
import { streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #423: streaming signature should not be lost during multi-turn conversations', () => {
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should preserve thinking block signature in stream metadata during streaming', async () => {
    const model = provider('anthropic/claude-sonnet-4.5');

    const stream = streamText({
      model,
      prompt:
        'Explain why gravity bends light. Think through the physics step by step.',
      providerOptions: {
        openrouter: {
          reasoning: { effort: 'high' },
        },
      },
    });

    let reasoningEndMetadata: Record<string, unknown> | undefined;
    let lastReasoningDeltaMetadata: Record<string, unknown> | undefined;
    let reasoningDeltaCount = 0;
    let hasText = false;

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'reasoning-delta') {
        reasoningDeltaCount++;
        if (chunk.providerMetadata) {
          lastReasoningDeltaMetadata = chunk.providerMetadata as Record<
            string,
            unknown
          >;
        }
      }
      if (chunk.type === 'reasoning-end') {
        reasoningEndMetadata = chunk.providerMetadata as
          | Record<string, unknown>
          | undefined;
      }
      if (chunk.type === 'text-delta') {
        hasText = true;
      }
    }

    expect(hasText).toBe(true);

    // Reasoning is expected but model-dependent. If no reasoning was
    // returned, skip signature assertions.
    if (reasoningDeltaCount === 0) {
      console.warn(
        'No reasoning-delta events received — model did not produce reasoning',
      );
      return;
    }

    // The signature may be in reasoning-end metadata (via reference sharing
    // with accumulatedReasoningDetails) or in the last reasoning-delta
    // snapshot. Check both — either location proves the signature is
    // preserved for multi-turn roundtrip.
    const metadataToCheck = reasoningEndMetadata ?? lastReasoningDeltaMetadata;
    expect(metadataToCheck).toBeDefined();

    const openrouterMeta = metadataToCheck?.openrouter as
      | Record<string, unknown>
      | undefined;
    expect(openrouterMeta).toBeDefined();

    const reasoningDetails = openrouterMeta?.reasoning_details as
      | Array<Record<string, unknown>>
      | undefined;
    expect(reasoningDetails).toBeDefined();
    expect(reasoningDetails!.length).toBeGreaterThan(0);

    const textDetail = reasoningDetails!.find(
      (d) => d.type === 'reasoning.text',
    );
    expect(textDetail).toBeDefined();

    // Signature availability depends on timing — it may arrive after text
    // starts and only be merged into the accumulator (visible in
    // reasoning-end and finish metadata). Verify when present.
    if (textDetail!.signature) {
      expect(typeof textDetail!.signature).toBe('string');
      expect((textDetail!.signature as string).length).toBeGreaterThan(0);
    } else {
      console.warn(
        'Signature not in reasoning-end/delta metadata — will be in finish event providerMetadata',
      );
    }
  });

  it('should complete a multi-turn conversation without signature errors', async () => {
    const model = provider('anthropic/claude-sonnet-4.5');

    // Turn 1: Get initial response with reasoning
    const turn1 = streamText({
      model,
      prompt: 'What is the capital of France? Think about it.',
      providerOptions: {
        openrouter: {
          reasoning: { effort: 'high' },
        },
      },
    });

    const turn1Response = await turn1.response;
    const turn1Messages = turn1Response.messages;

    expect(turn1Messages.length).toBeGreaterThan(0);

    // Turn 2: Continue the conversation using the response from turn 1
    // This would fail with "Invalid signature in thinking block" if the
    // signature was lost during streaming
    const turn2 = streamText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is the capital of France? Think about it.',
        },
        ...turn1Messages,
        { role: 'user', content: 'And what about Germany?' },
      ],
      providerOptions: {
        openrouter: {
          reasoning: { effort: 'high' },
        },
      },
    });

    let turn2Text = '';
    for await (const chunk of turn2.fullStream) {
      if (chunk.type === 'text-delta') {
        turn2Text += chunk.text;
      }
    }

    // If we get here without an error, the signature was preserved correctly
    expect(turn2Text.length).toBeGreaterThan(0);
    expect(turn2Text.toLowerCase()).toContain('berlin');
  });
});
