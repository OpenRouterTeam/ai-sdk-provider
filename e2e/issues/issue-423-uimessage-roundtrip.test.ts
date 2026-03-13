/**
 * Regression test for GitHub Issue #423 — UIMessage round-trip path
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/423
 *
 * Reported error: "messages.1.content.0: Invalid `signature` in `thinking` block"
 * Model: anthropic/claude-sonnet-4.5
 *
 * This test verifies that the thinking block signature is preserved through
 * the UIMessage round-trip path: streamText → toUIMessageStream → store
 * (JSON serialize/deserialize) → convertToModelMessages → second streamText.
 *
 * The original issue's reproduction uses toUIMessageStream() to collect
 * messages (as a real app would via useChat), stores them, then passes
 * them back via convertToModelMessages(). This is a different code path
 * from using response.messages directly.
 */
import type { UIMessage } from 'ai';

import { convertToModelMessages, readUIMessageStream, streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #423: UIMessage round-trip should preserve thinking block signature', () => {
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should complete multi-turn conversation via toUIMessageStream + convertToModelMessages without signature errors', async () => {
    const model = provider.chat('anthropic/claude-sonnet-4.5', {
      reasoning: { effort: 'low' },
    });

    // Turn 1: stream a response with reasoning
    const result = streamText({
      model,
      messages: [{ role: 'user', content: 'What is 2+2?' }],
    });

    // Collect UIMessages from the stream — this is the path real apps use
    // (e.g. via useChat / readUIMessageStream on the client)
    const uiMessageStream = result.toUIMessageStream();
    const uiMessages: UIMessage[] = [];
    for await (const message of readUIMessageStream({
      stream: uiMessageStream,
    })) {
      uiMessages.push(message);
    }

    // The last message should be the assistant response
    const lastMessage = uiMessages[uiMessages.length - 1];
    expect(lastMessage).toBeDefined();
    expect(lastMessage!.role).toBe('assistant');

    // Verify reasoning part exists with providerMetadata
    const reasoningPart = lastMessage!.parts.find(
      (p) => p.type === 'reasoning',
    );
    expect(reasoningPart).toBeDefined();
    expect(reasoningPart!.providerMetadata).toBeDefined();

    const openrouterMeta = reasoningPart!.providerMetadata?.openrouter as
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

    // Simulate storing in a database: JSON serialize → deserialize
    const stored: UIMessage[] = JSON.parse(JSON.stringify(uiMessages));

    // Turn 2: convert stored UIMessages back to model messages and continue
    // This is the exact path from the issue reproduction code.
    // It would fail with "Invalid signature in thinking block" if the
    // signature was lost during the UIMessage round-trip.
    const turn2 = streamText({
      model,
      messages: [
        ...(await convertToModelMessages(stored)),
        { role: 'user', content: 'Now what is 3+3?' },
      ],
    });

    let turn2Text = '';
    for await (const chunk of turn2.fullStream) {
      if (chunk.type === 'text-delta') {
        turn2Text += chunk.text;
      }
    }

    // If we get here without an error, the signature was preserved correctly
    // through the full UIMessage round-trip
    expect(turn2Text.length).toBeGreaterThan(0);
  });
});
