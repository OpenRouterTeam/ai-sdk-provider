/**
 * Reproduction test for Issue #423 / #439
 * Tests the full round-trip of reasoning signatures through:
 *   streaming → streamText → toUIMessageStream → readUIMessageStream
 *   → JSON serialize/deserialize → convertToModelMessages → second streamText
 *
 * This catches bugs where the signature is lost or corrupted during the round-trip,
 * causing "Invalid signature in thinking block" errors on multi-turn conversations.
 */
import type { LanguageModelV3Prompt } from '@ai-sdk/provider';
import type { UIMessage } from 'ai';

import { createTestServer } from '@ai-sdk/test-server';
import { convertToModelMessages, readUIMessageStream, streamText } from 'ai';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createOpenRouter } from '../provider';
import { ReasoningDetailType } from '../schemas/reasoning-details';
import { convertToOpenRouterChatMessages } from './convert-to-openrouter-chat-messages';

vi.mock('@/src/version', () => ({
  VERSION: '0.0.0-test',
}));

const FAKE_SIGNATURE =
  'erX9OCAqSEO90HsfvNlBn5J3BQ9cEI/Hg2wHFo5iA8w3L+aBcDeFgHiJkLmNoPqRsTuVwXyZ';

describe('Issue #423/#439: reasoning signature round-trip', () => {
  const server = createTestServer({
    'https://openrouter.ai/api/v1/chat/completions': {
      response: { type: 'json-value', body: {} },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => server.server.reset());
  afterAll(() => server.server.stop());

  const provider = createOpenRouter({
    apiKey: 'test-api-key',
    compatibility: 'strict',
  });

  /**
   * Simulate an Anthropic-like streaming response with reasoning_details and signature.
   * The signature arrives in the LAST reasoning delta (either with text or signature-only).
   */
  function prepareStreamWithSignature(options?: {
    signatureInSeparateDelta?: boolean;
  }) {
    const signatureInSeparateDelta = options?.signatureInSeparateDelta ?? false;

    const chunks: string[] = [
      // First chunk: reasoning starts, NO signature yet
      `data: {"id":"chatcmpl-sig-roundtrip","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.5",` +
        `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"role":"assistant","content":"",` +
        `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":"Let me think about this","index":0,"format":"anthropic-claude-v1"}]},` +
        `"logprobs":null,"finish_reason":null}]}\n\n`,
      // Second chunk: more reasoning text, still no signature
      `data: {"id":"chatcmpl-sig-roundtrip","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.5",` +
        `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
        `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":" step by step.","index":0,"format":"anthropic-claude-v1"}]},` +
        `"logprobs":null,"finish_reason":null}]}\n\n`,
    ];

    if (signatureInSeparateDelta) {
      // Third chunk: last text delta, no signature
      chunks.push(
        `data: {"id":"chatcmpl-sig-roundtrip","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.5",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":" The answer is clear.","index":0,"format":"anthropic-claude-v1"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
      );
      // Fourth chunk: signature-only delta (no text, just signature) — this is how Anthropic actually sends it
      chunks.push(
        `data: {"id":"chatcmpl-sig-roundtrip","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.5",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","index":0,"format":"anthropic-claude-v1","signature":"${FAKE_SIGNATURE}"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
      );
    } else {
      // Third chunk: last reasoning delta WITH signature in same chunk
      chunks.push(
        `data: {"id":"chatcmpl-sig-roundtrip","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.5",` +
          `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{` +
          `"reasoning_details":[{"type":"${ReasoningDetailType.Text}","text":" The answer is clear.","index":0,"format":"anthropic-claude-v1","signature":"${FAKE_SIGNATURE}"}]},` +
          `"logprobs":null,"finish_reason":null}]}\n\n`,
      );
    }

    // Text content starts (reasoning ends)
    chunks.push(
      `data: {"id":"chatcmpl-sig-roundtrip","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.5",` +
        `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{"content":"The answer is 4."},` +
        `"logprobs":null,"finish_reason":null}]}\n\n`,
    );
    // Finish
    chunks.push(
      `data: {"id":"chatcmpl-sig-roundtrip","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.5",` +
        `"system_fingerprint":"fp_test","choices":[{"index":0,"delta":{},` +
        `"logprobs":null,"finish_reason":"stop"}]}\n\n`,
    );
    chunks.push(
      `data: {"id":"chatcmpl-sig-roundtrip","object":"chat.completion.chunk","created":1711357598,"model":"anthropic/claude-sonnet-4.5",` +
        `"system_fingerprint":"fp_test","choices":[],"usage":{"prompt_tokens":100,"completion_tokens":50,"total_tokens":150}}\n\n`,
    );
    chunks.push('data: [DONE]\n\n');

    server.urls['https://openrouter.ai/api/v1/chat/completions']!.response = {
      type: 'stream-chunks',
      chunks,
    };
  }

  describe('toUIMessageStream round-trip (real app path)', () => {
    it('should preserve signature when signature arrives in same delta as last text', async () => {
      prepareStreamWithSignature({ signatureInSeparateDelta: false });

      const model = provider.chat('anthropic/claude-sonnet-4.5', {
        reasoning: { effort: 'high' },
      });

      // Turn 1: Stream a response
      const result = streamText({
        model,
        messages: [{ role: 'user', content: 'What is 2+2?' }],
      });

      // Collect UIMessages via toUIMessageStream (the path real apps use)
      // readUIMessageStream yields incremental snapshots of the same message.
      // A real app (useChat) keeps only the latest snapshot per message ID.
      const uiMessageStream = result.toUIMessageStream();
      const messageMap = new Map<string, UIMessage>();
      for await (const message of readUIMessageStream({
        stream: uiMessageStream,
      })) {
        messageMap.set(message.id, message);
      }
      const finalMessages = Array.from(messageMap.values());

      // Verify UIMessage has reasoning part with signature
      const lastMessage = finalMessages[finalMessages.length - 1];
      expect(lastMessage).toBeDefined();
      expect(lastMessage!.role).toBe('assistant');

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
        (d) => d.type === ReasoningDetailType.Text,
      );
      expect(textDetail).toBeDefined();
      expect(textDetail!.signature).toBe(FAKE_SIGNATURE);

      // Simulate DB storage: JSON serialize → deserialize
      const stored: UIMessage[] = JSON.parse(JSON.stringify(finalMessages));

      // Convert back to model messages
      const modelMessages = await convertToModelMessages(stored);

      // Pass through convertToOpenRouterChatMessages to see what would be sent to API
      const openrouterMessages = convertToOpenRouterChatMessages(
        modelMessages as unknown as LanguageModelV3Prompt,
      );

      // Find the assistant message
      const assistantMsg = openrouterMessages.find(
        (m) => m.role === 'assistant',
      ) as Record<string, unknown> | undefined;
      expect(assistantMsg).toBeDefined();

      // Verify reasoning_details with signature are preserved
      expect(assistantMsg!.reasoning_details).toBeDefined();
      const outReasoningDetails = assistantMsg!.reasoning_details as Array<
        Record<string, unknown>
      >;
      expect(outReasoningDetails.length).toBeGreaterThan(0);

      const outTextDetail = outReasoningDetails.find(
        (d) => d.type === ReasoningDetailType.Text,
      );
      expect(outTextDetail).toBeDefined();
      expect(outTextDetail!.signature).toBe(FAKE_SIGNATURE);

      // Verify reasoning text matches reasoning_details text
      expect(assistantMsg!.reasoning).toBeDefined();
      expect(outTextDetail!.text).toBe(assistantMsg!.reasoning);
    });

    it('should preserve signature when signature arrives in separate delta (Anthropic pattern)', async () => {
      prepareStreamWithSignature({ signatureInSeparateDelta: true });

      const model = provider.chat('anthropic/claude-sonnet-4.5', {
        reasoning: { effort: 'high' },
      });

      const result = streamText({
        model,
        messages: [{ role: 'user', content: 'What is 2+2?' }],
      });

      // readUIMessageStream yields incremental snapshots; keep only the latest per ID
      const uiMessageStream = result.toUIMessageStream();
      const messageMap2 = new Map<string, UIMessage>();
      for await (const message of readUIMessageStream({
        stream: uiMessageStream,
      })) {
        messageMap2.set(message.id, message);
      }
      const finalMessages2 = Array.from(messageMap2.values());

      // Simulate DB storage
      const stored: UIMessage[] = JSON.parse(JSON.stringify(finalMessages2));

      // Convert back and check
      const modelMessages = await convertToModelMessages(stored);
      const openrouterMessages = convertToOpenRouterChatMessages(
        modelMessages as unknown as LanguageModelV3Prompt,
      );

      const assistantMsg = openrouterMessages.find(
        (m) => m.role === 'assistant',
      ) as Record<string, unknown> | undefined;
      expect(assistantMsg).toBeDefined();

      // Verify reasoning_details with signature are preserved
      expect(assistantMsg!.reasoning_details).toBeDefined();
      const outReasoningDetails = assistantMsg!.reasoning_details as Array<
        Record<string, unknown>
      >;

      const outTextDetail = outReasoningDetails.find(
        (d) => d.type === ReasoningDetailType.Text,
      );
      expect(outTextDetail).toBeDefined();
      expect(outTextDetail!.signature).toBe(FAKE_SIGNATURE);

      // Verify reasoning text matches
      expect(assistantMsg!.reasoning).toBeDefined();
      expect(outTextDetail!.text).toBe(assistantMsg!.reasoning);
    });
  });

  describe('response.messages round-trip', () => {
    it('should preserve signature via response.messages path', async () => {
      prepareStreamWithSignature({ signatureInSeparateDelta: true });

      const model = provider.chat('anthropic/claude-sonnet-4.5', {
        reasoning: { effort: 'high' },
      });

      const result = streamText({
        model,
        messages: [{ role: 'user', content: 'What is 2+2?' }],
      });

      // Consume the stream
      const response = await result.response;
      const turn1Messages = response.messages;

      expect(turn1Messages.length).toBeGreaterThan(0);

      // Convert to OpenRouter format to verify
      const openrouterMessages = convertToOpenRouterChatMessages([
        { role: 'user', content: [{ type: 'text', text: 'What is 2+2?' }] },
        ...(turn1Messages as unknown as LanguageModelV3Prompt),
      ]);

      const assistantMsg = openrouterMessages.find(
        (m) => m.role === 'assistant',
      ) as Record<string, unknown> | undefined;
      expect(assistantMsg).toBeDefined();

      // Verify reasoning_details with signature
      expect(assistantMsg!.reasoning_details).toBeDefined();
      const outReasoningDetails = assistantMsg!.reasoning_details as Array<
        Record<string, unknown>
      >;
      const outTextDetail = outReasoningDetails.find(
        (d) => d.type === ReasoningDetailType.Text,
      );
      expect(outTextDetail).toBeDefined();
      expect(outTextDetail!.signature).toBe(FAKE_SIGNATURE);
    });
  });

  describe('multi-turn via UIMessage round-trip', () => {
    it('should send valid reasoning_details with signature in the second turn', async () => {
      prepareStreamWithSignature({ signatureInSeparateDelta: true });

      const model = provider.chat('anthropic/claude-sonnet-4.5', {
        reasoning: { effort: 'high' },
      });

      // Turn 1
      const result = streamText({
        model,
        messages: [{ role: 'user', content: 'What is 2+2?' }],
      });

      // readUIMessageStream yields incremental snapshots; keep only the latest per ID
      const uiMessageStream = result.toUIMessageStream();
      const messageMap3 = new Map<string, UIMessage>();
      for await (const message of readUIMessageStream({
        stream: uiMessageStream,
      })) {
        messageMap3.set(message.id, message);
      }
      const finalMessages3 = Array.from(messageMap3.values());

      // Simulate DB storage
      const stored: UIMessage[] = JSON.parse(JSON.stringify(finalMessages3));

      // Convert stored UIMessages to model messages (what would happen in turn 2)
      const modelMessages = await convertToModelMessages(stored);

      // Add the second user message and convert to OpenRouter format
      const turn2Messages = convertToOpenRouterChatMessages(
        modelMessages as unknown as LanguageModelV3Prompt,
      );

      // Find the assistant message from turn 1 in the turn 2 request
      const assistantMsg = turn2Messages.find((m) => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();

      // The assistant message should have reasoning_details with signature
      const reqReasoningDetails = (
        assistantMsg as unknown as Record<string, unknown>
      ).reasoning_details as Array<Record<string, unknown>> | undefined;
      expect(reqReasoningDetails).toBeDefined();

      const reqTextDetail = reqReasoningDetails!.find(
        (d) => d.type === ReasoningDetailType.Text,
      );
      expect(reqTextDetail).toBeDefined();
      expect(reqTextDetail!.signature).toBe(FAKE_SIGNATURE);

      // Verify reasoning text is also present and matches
      expect(
        (assistantMsg as unknown as Record<string, unknown>).reasoning,
      ).toBeDefined();
      expect(reqTextDetail!.text).toBe(
        (assistantMsg as unknown as Record<string, unknown>).reasoning,
      );
    });
  });
});
