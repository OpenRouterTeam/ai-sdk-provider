/**
 * Regression test for GitHub Issue #418 — Gemini corrupted thought signature
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/418
 *
 * Reported error: Multi-turn conversations with Gemini extended thinking
 * intermittently fail with "Corrupted thought signature" (INVALID_ARGUMENT 400).
 * Google internally signs thought tokens — unlike Anthropic, the SDK `signature`
 * field is NOT used. Any modification during roundtripping (DB storage, JSON
 * serialization, field reordering, encoding changes) can corrupt the internal
 * signing, and Google rejects with INVALID_ARGUMENT.
 *
 * The fix: add google-gemini-v1 to the signature-required format check. Since
 * Gemini reasoning.text entries never have an SDK `signature` field, they are
 * always stripped on roundtrip. This is intentional defensive behavior — the
 * SDK cannot verify whether the text survived roundtripping intact.
 */
import type { UIMessage } from 'ai';

import { convertToModelMessages, readUIMessageStream, streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #418: Gemini multi-turn should succeed when thought signatures are stripped', () => {
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should handle multi-turn when Gemini thought signatures are stripped from UIMessages', async () => {
    const model = provider.chat('google/gemini-2.5-flash', {
      reasoning: { effort: 'low' },
    });

    // Turn 1: Get a real response with reasoning from Gemini
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
    // This is the exact scenario from issue #418: an app stores messages,
    // the signature field is lost (null fields dropped, ORM strips unknown
    // fields, custom pruning), and the next turn fails with
    // "Corrupted thought signature".
    const stored: UIMessage[] = JSON.parse(JSON.stringify(uiMessages));
    for (const msg of stored) {
      for (const part of msg.parts) {
        if (part.type === 'reasoning' && part.providerMetadata) {
          const openrouter = part.providerMetadata.openrouter;
          if (
            typeof openrouter !== 'object' ||
            openrouter === null ||
            !('reasoning_details' in openrouter)
          ) {
            continue;
          }
          const details = openrouter.reasoning_details;
          if (Array.isArray(details)) {
            for (const detail of details) {
              if (
                typeof detail === 'object' &&
                detail !== null &&
                'signature' in detail
              ) {
                // Simulate signature being lost during serialization
                delete detail.signature;
              }
            }
          }
        }
      }
    }

    // Turn 2: Use the signature-stripped messages for a follow-up.
    // WITHOUT the fix, this would fail with:
    //   "Corrupted thought signature" (INVALID_ARGUMENT 400)
    // WITH the fix, the SDK strips the signatureless Gemini reasoning entries
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

  it('should handle multi-turn when Gemini providerMetadata is entirely removed', async () => {
    const model = provider.chat('google/gemini-2.5-flash', {
      reasoning: { effort: 'low' },
    });

    // Turn 1: Get a real response with reasoning
    const turn1 = streamText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is the capital of France? Be brief.',
        },
      ],
    });

    const turn1Response = await turn1.response;
    const turn1Messages = turn1Response.messages;
    expect(turn1Messages.length).toBeGreaterThan(0);

    // Simulate an app that strips ALL providerOptions from assistant messages
    const strippedMessages = JSON.parse(JSON.stringify(turn1Messages));
    for (const msg of strippedMessages) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'reasoning') {
            delete part.providerOptions;
          }
        }
      }
      delete msg.providerOptions;
    }

    // Turn 2: Continue with stripped messages.
    // WITHOUT the fix, reasoning text without reasoning_details could cause
    // "Corrupted thought signature" when Gemini tries to validate the thought.
    // WITH the fix, reasoning is dropped when reasoning_details is absent.
    const turn2 = streamText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is the capital of France? Be brief.',
        },
        ...strippedMessages,
        { role: 'user', content: 'And Germany?' },
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
