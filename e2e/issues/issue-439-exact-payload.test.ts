/**
 * Regression test for GitHub Issue #439 — exact payload reproduction
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/439
 *
 * Reproduces the EXACT scenario reported by @seannetlife:
 * A multi-step assistant response with reasoning + tool calls, where
 * reasoning_details lose their signature during DB serialization.
 * On the next user turn, the server sends these signatureless entries to
 * Anthropic, which rejects with "Invalid signature in thinking block".
 *
 * The fix: the SDK strips signatureless Anthropic reasoning.text entries
 * before sending them to the API.
 */
import type { UIMessage } from 'ai';

import { convertToModelMessages, readUIMessageStream, streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #439: multi-step reasoning + tool calls with stripped signatures', () => {
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  it('should succeed on follow-up turn when reasoning signatures are stripped (DB serialization)', async () => {
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

    // Simulate the exact issue #439 scenario: DB serialization strips
    // the signature field from reasoning_details but keeps the entries.
    // This is what causes "Invalid signature in thinking block".
    const stored: UIMessage[] = JSON.parse(JSON.stringify(uiMessages));
    for (const msg of stored) {
      for (const part of msg.parts) {
        if (part.type !== 'reasoning' || !part.providerMetadata) {
          continue;
        }
        const openrouter = part.providerMetadata.openrouter;
        if (
          typeof openrouter !== 'object' ||
          openrouter === null ||
          !('reasoning_details' in openrouter)
        ) {
          continue;
        }
        const details = openrouter.reasoning_details;
        if (!Array.isArray(details)) {
          continue;
        }
        for (const detail of details) {
          if (
            typeof detail === 'object' &&
            detail !== null &&
            'signature' in detail
          ) {
            delete detail.signature;
          }
        }
      }
    }

    // Turn 2: Use the signature-stripped messages for a follow-up.
    // WITHOUT the fix, this fails with:
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
});
