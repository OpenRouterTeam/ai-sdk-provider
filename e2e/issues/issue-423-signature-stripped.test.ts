/**
 * Regression test for GitHub Issue #423 / #439 — signature-stripped scenario
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/423
 *
 * This test reproduces the ACTUAL bug: an app stores messages in a database,
 * the signature field is lost during serialization (e.g., null fields dropped,
 * custom pruning strips providerMetadata, or ORM strips unknown fields), and
 * the next turn fails with "Invalid signature in thinking block".
 *
 * The fix: the SDK should strip signatureless Anthropic reasoning.text entries
 * rather than sending them with empty/missing signatures to the API.
 */
import type { UIMessage } from 'ai';

import { convertToModelMessages, readUIMessageStream, streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #423/#439: multi-turn should succeed even when signatures are stripped', () => {
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should handle multi-turn when signatures are stripped from UIMessages (DB serialization)', async () => {
    const model = provider.chat('anthropic/claude-sonnet-4.5', {
      reasoning: { effort: 'low' },
    });

    // Turn 1: Get a real response with reasoning from Claude
    const turn1 = streamText({
      model,
      messages: [{ role: 'user', content: 'What is 2+2? Be brief.' }],
    });

    const uiMessageStream = turn1.toUIMessageStream();
    const uiMessages: UIMessage[] = [];
    for await (const message of readUIMessageStream({
      stream: uiMessageStream,
    })) {
      uiMessages.push(message);
    }

    const assistantMessage = uiMessages.find((m) => m.role === 'assistant');
    expect(assistantMessage).toBeDefined();

    // Simulate DB serialization that STRIPS signatures.
    // This is the exact scenario from issue #423/#439:
    // JSON.parse(JSON.stringify(...)) then delete signature fields.
    const stored: UIMessage[] = JSON.parse(JSON.stringify(uiMessages));
    for (const msg of stored) {
      for (const part of msg.parts) {
        if (part.type === 'reasoning' && part.providerMetadata) {
          const openrouter = part.providerMetadata.openrouter as
            | Record<string, unknown>
            | undefined;
          const details = openrouter?.reasoning_details;
          if (Array.isArray(details)) {
            for (const detail of details) {
              if (
                typeof detail === 'object' &&
                detail !== null &&
                'signature' in detail
              ) {
                // Simulate signature being lost during serialization
                delete (detail as Record<string, unknown>).signature;
              }
            }
          }
        }
      }
    }

    // Turn 2: Use the signature-stripped messages for a follow-up.
    // WITHOUT the fix, this would fail with:
    //   "messages.1.content.0: Invalid `signature` in `thinking` block"
    // WITH the fix, the SDK strips the signatureless reasoning entries
    // and the request succeeds.
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

    // If we get here without an error, the fix is working
    expect(turn2Text.length).toBeGreaterThan(0);
  });

  it('should handle multi-turn when providerMetadata is entirely removed from reasoning parts', async () => {
    const model = provider.chat('anthropic/claude-sonnet-4.5', {
      reasoning: { effort: 'low' },
    });

    // Turn 1: Get a real response with reasoning
    const turn1 = streamText({
      model,
      messages: [
        { role: 'user', content: 'What is the capital of Japan? Be brief.' },
      ],
    });

    const turn1Response = await turn1.response;
    const turn1Messages = turn1Response.messages;
    expect(turn1Messages.length).toBeGreaterThan(0);

    // Simulate an app that strips ALL providerOptions from assistant messages
    // (e.g., custom message pruning for token limits, or a framework that
    // doesn't preserve providerOptions)
    const strippedMessages = JSON.parse(JSON.stringify(turn1Messages));
    for (const msg of strippedMessages) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'reasoning') {
            delete part.providerOptions;
          }
        }
      }
      // Also strip message-level providerOptions
      delete msg.providerOptions;
    }

    // Turn 2: Continue with stripped messages.
    // WITHOUT the fix, reasoning text without reasoning_details would cause
    // the server to construct thinking blocks without valid signatures.
    // WITH the fix, reasoning is dropped when reasoning_details is absent.
    const turn2 = streamText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is the capital of Japan? Be brief.',
        },
        ...strippedMessages,
        { role: 'user', content: 'And South Korea?' },
      ],
    });

    let turn2Text = '';
    for await (const chunk of turn2.fullStream) {
      if (chunk.type === 'text-delta') {
        turn2Text += chunk.text;
      }
    }

    expect(turn2Text.length).toBeGreaterThan(0);
  });
});
