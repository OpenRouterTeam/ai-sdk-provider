/**
 * Regression test for Issue #423 / #439
 *
 * Tests that convertToOpenRouterChatMessages correctly handles
 * reasoning_details with and without signatures in multi-turn
 * conversations. When signatures are lost during serialization
 * (DB storage, JSON round-trip, custom pruning), the provider
 * must strip signatureless reasoning.text entries to prevent
 * Anthropic's "Invalid signature in thinking block" error.
 */
import { describe, expect, it } from 'vitest';
import { ReasoningDetailType } from '../schemas/reasoning-details';
import { convertToOpenRouterChatMessages } from './convert-to-openrouter-chat-messages';

const FAKE_SIGNATURE =
  'erX9OCAqSEO90HsfvNlBn5J3BQ9cEI/Hg2wHFo5iA8w3L+aBcDeFgHiJkLmNoPqRsTuVwXyZ';

describe('Issue #423/#439: reasoning signature in multi-turn messages', () => {
  it('should preserve reasoning_details when signature is present', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'What is 2+2?' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Let me think step by step.',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Let me think step by step.',
                    signature: FAKE_SIGNATURE,
                    format: 'anthropic-claude-v1',
                    index: 0,
                  },
                ],
              },
            },
          },
          { type: 'text', text: 'The answer is 4.' },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Are you sure?' }],
      },
    ]);

    const assistantMsg = result.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg!.reasoning).toBe('Let me think step by step.');
    expect(assistantMsg!.reasoning_details).toBeDefined();
    expect(assistantMsg!.reasoning_details).toHaveLength(1);
    expect(assistantMsg!.reasoning_details![0]).toMatchObject({
      type: ReasoningDetailType.Text,
      text: 'Let me think step by step.',
      signature: FAKE_SIGNATURE,
    });
  });

  it('should strip reasoning.text entries when signature is missing (the bug scenario)', () => {
    // This simulates what happens when an app stores messages in a DB
    // and the signature field is lost during serialization (e.g., null
    // fields dropped, custom pruning strips signature but keeps reasoning_details)
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'What is 2+2?' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Let me think step by step.',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Let me think step by step.',
                    // No signature — lost during serialization
                    format: 'anthropic-claude-v1',
                    index: 0,
                  },
                ],
              },
            },
          },
          { type: 'text', text: 'The answer is 4.' },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'text', text: 'Are you sure?' }],
      },
    ]);

    const assistantMsg = result.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    // reasoning_details and reasoning should both be stripped
    // because the only reasoning.text entry has no signature
    expect(assistantMsg!.reasoning_details).toBeUndefined();
    expect(assistantMsg!.reasoning).toBeUndefined();
  });

  it('should strip reasoning.text with null signature', () => {
    // Some serialization paths preserve the key but set it to null
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Thinking...',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Thinking...',
                    signature: null,
                    format: 'anthropic-claude-v1',
                    index: 0,
                  },
                ],
              },
            },
          },
          { type: 'text', text: 'Hi there.' },
        ],
      },
    ]);

    const assistantMsg = result.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg!.reasoning_details).toBeUndefined();
    expect(assistantMsg!.reasoning).toBeUndefined();
  });

  it('should keep valid entries and strip signatureless ones in mixed reasoning_details', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Step 1. Step 2.',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Step 1.',
                    signature: FAKE_SIGNATURE,
                    format: 'anthropic-claude-v1',
                    index: 0,
                  },
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Step 2.',
                    // Missing signature — should be stripped
                    format: 'anthropic-claude-v1',
                    index: 1,
                  },
                ],
              },
            },
          },
          { type: 'text', text: 'Done.' },
        ],
      },
    ]);

    const assistantMsg = result.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    // Only the entry with a valid signature should survive
    expect(assistantMsg!.reasoning_details).toHaveLength(1);
    expect(assistantMsg!.reasoning_details![0]).toMatchObject({
      type: ReasoningDetailType.Text,
      text: 'Step 1.',
      signature: FAKE_SIGNATURE,
    });
  });

  it('should preserve non-text detail types (encrypted, summary) without signatures', () => {
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'Hello' }],
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Thinking...',
            providerOptions: {
              openrouter: {
                reasoning_details: [
                  {
                    type: ReasoningDetailType.Encrypted,
                    data: 'encrypted-blob',
                    index: 0,
                  },
                  {
                    type: ReasoningDetailType.Text,
                    text: 'Thinking...',
                    signature: FAKE_SIGNATURE,
                    format: 'anthropic-claude-v1',
                    index: 1,
                  },
                ],
              },
            },
          },
          { type: 'text', text: 'Hi.' },
        ],
      },
    ]);

    const assistantMsg = result.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    // Both entries should be preserved: encrypted doesn't need a signature
    expect(assistantMsg!.reasoning_details).toHaveLength(2);
    expect(assistantMsg!.reasoning_details![0]).toMatchObject({
      type: ReasoningDetailType.Encrypted,
    });
    expect(assistantMsg!.reasoning_details![1]).toMatchObject({
      type: ReasoningDetailType.Text,
      signature: FAKE_SIGNATURE,
    });
  });

  it('should handle message-level reasoning_details without signatures', () => {
    // When reasoning_details are stored at message-level providerOptions
    // (e.g., via the AI SDK providerOptions preservation)
    const result = convertToOpenRouterChatMessages([
      {
        role: 'user',
        content: [{ type: 'text', text: 'What is 2+2?' }],
      },
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'Let me think.' },
          { type: 'text', text: 'The answer is 4.' },
        ],
        providerOptions: {
          openrouter: {
            reasoning_details: [
              {
                type: ReasoningDetailType.Text,
                text: 'Let me think.',
                // No signature
                format: 'anthropic-claude-v1',
                index: 0,
              },
            ],
          },
        },
      },
    ]);

    const assistantMsg = result.find((m) => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg!.reasoning_details).toBeUndefined();
    expect(assistantMsg!.reasoning).toBeUndefined();
  });
});
