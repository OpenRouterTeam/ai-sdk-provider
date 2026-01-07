import { describe, it, expect } from 'vitest';
import type { OpenResponsesNonStreamingResponse } from '@openrouter/sdk/models';
import {
  extractReasoningDetails,
  extractReasoningDetailsFromOutput,
  hasEncryptedReasoning,
  buildReasoningProviderMetadata,
} from '../../chat/extract-reasoning-details.js';

describe('extractReasoningDetails', () => {
  it('should return undefined for response with no reasoning', () => {
    const response = {
      id: 'resp_123',
      model: 'test/model',
      output: [
        {
          type: 'message' as const,
          content: [{ type: 'output_text', text: 'Hello' }],
        },
      ],
      outputText: 'Hello',
      createdAt: 1234567890,
      status: 'completed' as const,
    } as unknown as OpenResponsesNonStreamingResponse;

    expect(extractReasoningDetails(response)).toBeUndefined();
  });

  it('should extract Claude-format reasoning with signature', () => {
    const response = {
      id: 'resp_123',
      model: 'anthropic/claude-3.5-sonnet',
      output: [
        {
          type: 'reasoning' as const,
          id: 'reasoning_123',
          content: [{ type: 'reasoning_text', text: 'Let me think...' }],
          signature: 'base64-signature',
          format: 'claude',
        },
        {
          type: 'message' as const,
          content: [{ type: 'output_text', text: 'The answer is 42.' }],
        },
      ],
      outputText: 'The answer is 42.',
      createdAt: 1234567890,
      status: 'completed' as const,
    } as unknown as OpenResponsesNonStreamingResponse;

    const details = extractReasoningDetails(response);
    expect(details).toBeDefined();
    expect(details).toHaveLength(1);
    expect(details![0]).toMatchObject({
      type: 'reasoning',
      id: 'reasoning_123',
      content: [{ type: 'reasoning_text', text: 'Let me think...' }],
      signature: 'base64-signature',
      format: 'claude',
    });
  });

  it('should extract Gemini-format reasoning with encryptedContent', () => {
    const response = {
      id: 'resp_456',
      model: 'google/gemini-2.5-flash-preview',
      output: [
        {
          type: 'reasoning' as const,
          id: 'reasoning_456',
          encryptedContent: 'encrypted-opaque-blob',
          format: 'gemini',
        },
        {
          type: 'message' as const,
          content: [{ type: 'output_text', text: 'Processed.' }],
        },
      ],
      outputText: 'Processed.',
      createdAt: 1234567890,
      status: 'completed' as const,
    } as unknown as OpenResponsesNonStreamingResponse;

    const details = extractReasoningDetails(response);
    expect(details).toBeDefined();
    expect(details).toHaveLength(1);
    expect(details![0]).toMatchObject({
      type: 'reasoning',
      id: 'reasoning_456',
      encryptedContent: 'encrypted-opaque-blob',
      format: 'gemini',
    });
  });

  it('should extract reasoning with summary', () => {
    const response = {
      id: 'resp_789',
      model: 'openai/o1',
      output: [
        {
          type: 'reasoning' as const,
          id: 'reasoning_789',
          content: [{ type: 'reasoning_text', text: 'Full thinking...' }],
          summary: [{ type: 'summary_text', text: 'Summary of thinking' }],
        },
        {
          type: 'message' as const,
          content: [{ type: 'output_text', text: 'Result.' }],
        },
      ],
      outputText: 'Result.',
      createdAt: 1234567890,
      status: 'completed' as const,
    } as unknown as OpenResponsesNonStreamingResponse;

    const details = extractReasoningDetails(response);
    expect(details).toBeDefined();
    expect(details![0]).toMatchObject({
      type: 'reasoning',
      id: 'reasoning_789',
      content: [{ type: 'reasoning_text', text: 'Full thinking...' }],
      summary: [{ type: 'summary_text', text: 'Summary of thinking' }],
    });
  });
});

describe('extractReasoningDetailsFromOutput', () => {
  it('should return undefined for output with no reasoning', () => {
    const output = [
      { type: 'message', content: [{ type: 'output_text', text: 'Hello' }] },
    ];
    expect(extractReasoningDetailsFromOutput(output)).toBeUndefined();
  });

  it('should extract reasoning from output items', () => {
    const output = [
      {
        type: 'reasoning',
        id: 'reasoning_123',
        content: [{ type: 'reasoning_text', text: 'Thinking...' }],
        signature: 'sig123',
      },
      { type: 'message', content: [{ type: 'output_text', text: 'Done.' }] },
    ];

    const details = extractReasoningDetailsFromOutput(output);
    expect(details).toBeDefined();
    expect(details).toHaveLength(1);
    expect(details![0]).toMatchObject({
      type: 'reasoning',
      id: 'reasoning_123',
      signature: 'sig123',
    });
  });
});

describe('hasEncryptedReasoning', () => {
  it('should return false for undefined', () => {
    expect(hasEncryptedReasoning(undefined)).toBe(false);
  });

  it('should return false for empty array', () => {
    expect(hasEncryptedReasoning([])).toBe(false);
  });

  it('should return false for Claude-format without encryptedContent', () => {
    const details = [
      {
        type: 'reasoning',
        id: 'reasoning_123',
        content: [{ type: 'reasoning_text', text: 'Thinking...' }],
        signature: 'sig123',
      },
    ];
    expect(hasEncryptedReasoning(details)).toBe(false);
  });

  it('should return true for Gemini-format with encryptedContent', () => {
    const details = [
      {
        type: 'reasoning',
        id: 'reasoning_456',
        encryptedContent: 'encrypted-blob',
      },
    ];
    expect(hasEncryptedReasoning(details)).toBe(true);
  });

  it('should return true for reasoning.encrypted type', () => {
    const details = [
      {
        type: 'reasoning.encrypted',
        id: 'reasoning_789',
        data: 'encrypted-data',
      },
    ];
    expect(hasEncryptedReasoning(details)).toBe(true);
  });
});

describe('buildReasoningProviderMetadata', () => {
  it('should return undefined for undefined input', () => {
    expect(buildReasoningProviderMetadata(undefined)).toBeUndefined();
  });

  it('should return undefined for empty array', () => {
    expect(buildReasoningProviderMetadata([])).toBeUndefined();
  });

  it('should build provider metadata with reasoning details', () => {
    const details = [
      {
        type: 'reasoning',
        id: 'reasoning_123',
        content: [{ type: 'reasoning_text', text: 'Thinking...' }],
      },
    ];

    const metadata = buildReasoningProviderMetadata(details);
    expect(metadata).toBeDefined();
    expect(metadata).toMatchObject({
      openrouter: {
        reasoning_details: details,
      },
    });
  });
});
