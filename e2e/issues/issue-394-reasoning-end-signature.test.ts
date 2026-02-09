/**
 * Regression test for GitHub PR #394
 * https://github.com/OpenRouterTeam/ai-sdk-provider/pull/394
 *
 * Reported error: Multi-turn conversation failure with Anthropic models when
 * the first turn is a text-only response (no tool calls) with reasoning enabled.
 * The reasoning-end stream event was emitted without providerMetadata, causing
 * the Anthropic signature to be lost. On the next turn, Anthropic rejects with
 * "Invalid signature in thinking block".
 */
import { streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #394: reasoning-end should include accumulated reasoning_details with signature', () => {
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should include reasoning_details with signature in reasoning-end providerMetadata for text-only streaming response', async () => {
    const model = provider('anthropic/claude-sonnet-4');

    const stream = streamText({
      model,
      prompt: 'What is 2+2? Answer briefly.',
      providerOptions: {
        openrouter: {
          reasoning: 'enabled',
        },
      },
    });

    let hasReasoningStart = false;
    let hasReasoningEnd = false;
    let reasoningEndProviderMetadata: Record<string, unknown> | undefined;
    let reasoning = '';

    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'reasoning-start') {
        hasReasoningStart = true;
      }
      if (chunk.type === 'reasoning-delta') {
        reasoning += chunk.text;
      }
      if (chunk.type === 'reasoning-end') {
        hasReasoningEnd = true;
        reasoningEndProviderMetadata = chunk.providerMetadata as
          | Record<string, unknown>
          | undefined;
      }
    }

    expect(hasReasoningStart).toBe(true);
    expect(hasReasoningEnd).toBe(true);
    expect(reasoning.length).toBeGreaterThan(0);

    expect(reasoningEndProviderMetadata).toBeDefined();

    const openrouterMeta = reasoningEndProviderMetadata?.openrouter as
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
    expect(textDetail!.signature).toBeDefined();
    expect(typeof textDetail!.signature).toBe('string');
    expect((textDetail!.signature as string).length).toBeGreaterThan(0);
  });

  it('should produce valid reasoning parts for multi-turn continuation', async () => {
    const model = provider('anthropic/claude-sonnet-4');

    const result = await streamText({
      model,
      prompt: 'What is the capital of France? Answer in one word.',
      providerOptions: {
        openrouter: {
          reasoning: 'enabled',
        },
      },
    });

    const response = await result.response;
    const messages = response.messages;

    expect(messages.length).toBeGreaterThan(0);

    const assistantMessage = messages.find((m) => m.role === 'assistant');
    expect(assistantMessage).toBeDefined();

    const content = assistantMessage?.content;
    if (typeof content === 'string') {
      return;
    }

    const reasoningParts = content?.filter(
      (p: { type: string }) => p.type === 'reasoning',
    );

    if (reasoningParts && reasoningParts.length > 0) {
      for (const part of reasoningParts) {
        if ('providerMetadata' in part) {
          expect(part.providerMetadata).toBeDefined();

          const openrouterMeta = (
            part as { providerMetadata?: Record<string, unknown> }
          ).providerMetadata?.openrouter as Record<string, unknown> | undefined;
          expect(openrouterMeta).toBeDefined();

          const details = openrouterMeta?.reasoning_details as
            | Array<Record<string, unknown>>
            | undefined;
          expect(details).toBeDefined();
        }
      }
    }
  });
});
