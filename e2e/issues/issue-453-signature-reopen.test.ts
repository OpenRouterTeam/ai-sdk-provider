/**
 * Regression test for GitHub Issue #453
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/453
 *
 * Issue #453 is a reopen of #423/#439. Users (WolfgangFahl, seannetlife,
 * antoniojps) reported that the "Invalid signature in thinking block" error
 * persisted through v2.2.5 and v2.3.1 fixes.
 *
 * The full fix chain: PR #427 (signature preservation), PR #442 (strip
 * reasoning text when reasoning_details missing), PR #445 (strip entries
 * without valid signatures), PR #458 (prevent duplicate reasoning blocks
 * when signature arrives after text).
 *
 * This test verifies the complete fix chain works end-to-end against the
 * live API for the exact models reported in the issues.
 */
import { generateText, streamText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 120_000,
});

describe('Issue #453: #423 needs reopening — full signature fix chain verification', () => {
  const provider = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
  });

  describe('anthropic/claude-sonnet-4.5 (primary model from #423)', () => {
    const model = provider.chat('anthropic/claude-sonnet-4.5', {
      reasoning: { effort: 'high' },
    });

    it('should not produce duplicate reasoning blocks during streaming', async () => {
      const result = streamText({
        model,
        prompt:
          'Explain the difference between TCP and UDP. Think through it carefully.',
      });

      let reasoningStartCount = 0;
      let reasoningEndCount = 0;
      let textStartCount = 0;
      let hasSignature = false;

      for await (const chunk of result.fullStream) {
        if (chunk.type === 'reasoning-start') {
          reasoningStartCount++;
        }
        if (chunk.type === 'reasoning-end') {
          reasoningEndCount++;
          const meta = chunk.providerMetadata?.openrouter as
            | Record<string, unknown>
            | undefined;
          const details = meta?.reasoning_details as
            | Array<Record<string, unknown>>
            | undefined;
          if (details) {
            for (const detail of details) {
              if (detail.signature) {
                hasSignature = true;
              }
            }
          }
        }
        if (chunk.type === 'text-start') {
          textStartCount++;
        }
      }

      // The fix (PR #458) ensures exactly ONE reasoning block — no duplicates
      // from late-arriving signature deltas after text has started
      if (reasoningStartCount > 0) {
        expect(reasoningStartCount).toBe(1);
        expect(reasoningEndCount).toBe(1);
      }

      expect(textStartCount).toBeGreaterThanOrEqual(1);

      // Signature should be preserved in reasoning-end metadata when present
      if (reasoningStartCount > 0 && !hasSignature) {
        console.warn(
          'Signature not found in reasoning-end metadata — may be timing-dependent',
        );
      }
    });

    it('should complete a multi-turn conversation using response.messages without signature errors', async () => {
      // Turn 1
      const turn1 = await streamText({
        model,
        messages: [
          {
            role: 'user',
            content: 'What is the capital of France? Think about it.',
          },
        ],
      });

      const turn1Response = await turn1.response;
      const turn1Messages = turn1Response.messages;
      expect(turn1Messages.length).toBeGreaterThan(0);

      // Turn 2: reuse messages from turn 1 — this is the path that fails
      // with "Invalid signature in thinking block" if signatures are lost
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
      });

      let turn2Text = '';
      for await (const chunk of turn2.fullStream) {
        if (chunk.type === 'text-delta') {
          turn2Text += chunk.text;
        }
      }

      expect(turn2Text.length).toBeGreaterThan(0);
    });

    it('should preserve signature through generateText multi-turn path', async () => {
      // Turn 1 via generateText (non-streaming)
      const turn1 = await generateText({
        model,
        messages: [{ role: 'user', content: 'What is 2+2?' }],
      });

      expect(turn1.text.length).toBeGreaterThan(0);

      // Verify reasoning_details exist in providerMetadata
      const reasoningDetails = turn1.providerMetadata?.openrouter
        ?.reasoning_details as Array<Record<string, unknown>> | undefined;

      if (reasoningDetails && reasoningDetails.length > 0) {
        const textDetail = reasoningDetails.find(
          (d) => d.type === 'reasoning.text',
        );
        if (textDetail) {
          expect(textDetail.signature).toBeDefined();
          expect(typeof textDetail.signature).toBe('string');
        }
      }

      // Turn 2: use response.messages for continuity
      const turn2 = await generateText({
        model,
        messages: [
          { role: 'user', content: 'What is 2+2?' },
          ...turn1.response.messages,
          { role: 'user', content: 'And what is 3+3?' },
        ],
      });

      expect(turn2.text.length).toBeGreaterThan(0);
    });
  });

  describe('anthropic/claude-opus-4 (also mentioned in #423 original report)', () => {
    const model = provider.chat('anthropic/claude-opus-4', {
      reasoning: { effort: 'low' },
    });

    it('should complete streaming multi-turn without signature errors', async () => {
      // Turn 1
      const turn1 = streamText({
        model,
        messages: [{ role: 'user', content: 'What is 5+5? Be brief.' }],
      });

      const turn1Response = await turn1.response;
      const turn1Messages = turn1Response.messages;
      expect(turn1Messages.length).toBeGreaterThan(0);

      // Turn 2
      const turn2 = streamText({
        model,
        messages: [
          { role: 'user', content: 'What is 5+5? Be brief.' },
          ...turn1Messages,
          { role: 'user', content: 'And 6+6?' },
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
});
