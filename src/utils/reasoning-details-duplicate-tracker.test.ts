import type { ReasoningDetailUnion } from '../schemas/reasoning-details';

import { describe, expect, it } from 'vitest';
import { ReasoningFormat } from '../schemas/format';
import { ReasoningDetailType } from '../schemas/reasoning-details';
import { ReasoningDetailsDuplicateTracker } from './reasoning-details-duplicate-tracker';

describe('ReasoningDetailsDuplicateTracker', () => {
  describe('upsert return values', () => {
    it('should return true for new detail', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'test summary',
      };

      expect(tracker.upsert(detail)).toBe(true);
    });

    it('should return false for duplicate detail', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'test summary',
      };

      tracker.upsert(detail);
      expect(tracker.upsert(detail)).toBe(false);
    });

    it('should return false for detail with no valid key', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: null,
        signature: null,
      };

      expect(tracker.upsert(detail)).toBe(false);
    });
  });

  describe('Summary type deduplication', () => {
    it('should deduplicate using summary field', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'same summary',
        id: 'id1',
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'same summary',
        id: 'id2',
      };

      expect(tracker.upsert(detail1)).toBe(true);
      expect(tracker.upsert(detail2)).toBe(false);
    });

    it('should allow different summaries', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'first summary',
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'second summary',
      };

      expect(tracker.upsert(detail1)).toBe(true);
      expect(tracker.upsert(detail2)).toBe(true);
    });
  });

  describe('Encrypted type deduplication', () => {
    it('should deduplicate using id field when present', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        data: 'data1',
        id: 'same-id',
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        data: 'data2',
        id: 'same-id',
      };

      expect(tracker.upsert(detail1)).toBe(true);
      expect(tracker.upsert(detail2)).toBe(false);
    });

    it('should deduplicate using data field when id is absent', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        data: 'same-data',
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        data: 'same-data',
      };

      expect(tracker.upsert(detail1)).toBe(true);
      expect(tracker.upsert(detail2)).toBe(false);
    });

    it('should allow different ids', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        data: 'data',
        id: 'id1',
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        data: 'data',
        id: 'id2',
      };

      expect(tracker.upsert(detail1)).toBe(true);
      expect(tracker.upsert(detail2)).toBe(true);
    });
  });

  describe('Encrypted format handling', () => {
    it('should keep Gemini encrypted details that reuse a tool-call-derived id', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const turn1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        id: 'tool_getWeather_0',
        data: 'gemini-signature-turn-1',
        format: ReasoningFormat.GoogleGeminiV1,
      };

      const turn2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        id: 'tool_getWeather_0',
        data: 'gemini-signature-turn-2',
        format: ReasoningFormat.GoogleGeminiV1,
      };

      expect(tracker.upsert(turn1)).toBe(true);
      expect(tracker.upsert(turn2)).toBe(true);
    });

    it('should deduplicate an identical Gemini encrypted detail', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        id: 'tool_getWeather_0',
        data: 'gemini-signature',
        format: ReasoningFormat.GoogleGeminiV1,
      };

      expect(tracker.upsert(detail)).toBe(true);
      expect(tracker.upsert({ ...detail, index: 0 })).toBe(false);
    });

    it('should deduplicate OpenAI encrypted details by rs_ id even when data differs', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        id: 'rs_abc123',
        data: 'encrypted-a',
        format: ReasoningFormat.OpenAIResponsesV1,
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        id: 'rs_abc123',
        data: 'encrypted-b',
        format: ReasoningFormat.OpenAIResponsesV1,
      };

      expect(tracker.upsert(detail1)).toBe(true);
      expect(tracker.upsert(detail2)).toBe(false);
    });

    it('should deduplicate an rs_ id regardless of whether format is present', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const withFormat: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        id: 'rs_abc123',
        data: 'encrypted-a',
        format: ReasoningFormat.OpenAIResponsesV1,
      };

      const withoutFormat: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        id: 'rs_abc123',
        data: 'encrypted-a',
        format: null,
      };

      expect(tracker.upsert(withFormat)).toBe(true);
      expect(tracker.upsert(withoutFormat)).toBe(false);
    });
  });

  describe('Text type deduplication', () => {
    it('should deduplicate unsigned text using text field', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'same text',
        id: 'id1',
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'same text',
        signature: null,
        id: 'id2',
      };

      expect(tracker.upsert(detail1)).toBe(true);
      expect(tracker.upsert(detail2)).toBe(false);
    });

    it('should keep signed blocks with identical text but different signatures', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'same text',
        signature: 'sig1',
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'same text',
        signature: 'sig2',
      };

      expect(tracker.upsert(detail1)).toBe(true);
      expect(tracker.upsert(detail2)).toBe(true);
    });

    it('should deduplicate signed blocks with the same signature', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'same text',
        signature: 'same-signature',
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'same text',
        signature: 'same-signature',
        id: 'id2',
      };

      expect(tracker.upsert(detail1)).toBe(true);
      expect(tracker.upsert(detail2)).toBe(false);
    });

    it('should deduplicate using signature field when text is null', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: null,
        signature: 'same-signature',
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: null,
        signature: 'same-signature',
      };

      expect(tracker.upsert(detail1)).toBe(true);
      expect(tracker.upsert(detail2)).toBe(false);
    });

    it('should skip detail when both text and signature are null', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: null,
        signature: null,
      };

      expect(tracker.upsert(detail)).toBe(false);
    });

    it('should allow different text values', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'text1',
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'text2',
      };

      expect(tracker.upsert(detail1)).toBe(true);
      expect(tracker.upsert(detail2)).toBe(true);
    });
  });

  describe('ServerToolCall type deduplication', () => {
    it('should deduplicate using tool_call_id when present', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail: ReasoningDetailUnion = {
        type: ReasoningDetailType.ServerToolCall,
        tool_name: 'openrouter:fusion',
        tool_call_id: 'call_1',
        arguments: '{}',
        result: 'first',
      };

      expect(tracker.upsert(detail)).toBe(true);
      expect(tracker.upsert({ ...detail, result: 'second' })).toBe(false);
    });

    it('should deduplicate using tool_name and arguments when tool_call_id is absent', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail: ReasoningDetailUnion = {
        type: ReasoningDetailType.ServerToolCall,
        tool_name: 'openrouter:fusion',
        arguments: '{"q":"a"}',
        result: 'r',
      };

      expect(tracker.upsert(detail)).toBe(true);
      expect(tracker.upsert({ ...detail })).toBe(false);
      expect(tracker.upsert({ ...detail, arguments: '{"q":"b"}' })).toBe(true);
    });

    it('should not collide with an encrypted detail that shares its id', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const serverToolCall: ReasoningDetailUnion = {
        type: ReasoningDetailType.ServerToolCall,
        tool_name: 'openrouter:fusion',
        tool_call_id: 'call_1',
        arguments: '{}',
        result: 'r',
      };
      const encrypted: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        id: 'call_1',
        data: 'blob',
      };

      expect(tracker.upsert(serverToolCall)).toBe(true);
      expect(tracker.upsert(encrypted)).toBe(true);
    });
  });

  describe('cross-type key scoping (matches API)', () => {
    it('should keep details of different types that share an identifying value', () => {
      // This matches the OpenRouter API behavior - keys are type-prefixed
      // so different types with the same value never collide
      const tracker = new ReasoningDetailsDuplicateTracker();

      const summary: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'same-value',
      };

      const encrypted: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        data: 'same-value',
      };

      const text: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'same-value',
      };

      expect(tracker.upsert(summary)).toBe(true);
      expect(tracker.upsert(encrypted)).toBe(true);
      expect(tracker.upsert(text)).toBe(true);
    });

    it('should not merge a summary and a text detail with the same string', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const summary: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'X',
        id: 'rs_1',
      };

      const text: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'X',
      };

      expect(tracker.upsert(summary)).toBe(true);
      expect(tracker.upsert(text)).toBe(true);
    });

    it('should collide text field with signature field having same value', () => {
      // This matches the OpenRouter API behavior - within reasoning.text,
      // text and signature share one key space, so they will collide if they
      // have the same value
      const tracker = new ReasoningDetailsDuplicateTracker();

      const textWithText: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'same-value',
        signature: null,
      };

      const textWithSignature: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: null,
        signature: 'same-value',
      };

      expect(tracker.upsert(textWithText)).toBe(true);
      expect(tracker.upsert(textWithSignature)).toBe(false); // Collides
    });
  });

  describe('empty string handling (matches API)', () => {
    it('should treat empty string signature as falsy and fall through to text', () => {
      // This matches the OpenRouter API behavior - empty strings are falsy
      // so they fall through to the next field
      const tracker = new ReasoningDetailsDuplicateTracker();

      const detailWithEmptySignature: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'some-text',
        signature: '',
      };

      const detailWithTextOnly: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'some-text',
        signature: null,
      };

      // Empty string signature falls through to text, so both use 'some-text' as key
      expect(tracker.upsert(detailWithEmptySignature)).toBe(true);
      expect(tracker.upsert(detailWithTextOnly)).toBe(false); // Collides
    });

    it('should treat empty string encrypted id as falsy and fall through to data', () => {
      // This matches the OpenRouter API behavior - empty strings are falsy
      const tracker = new ReasoningDetailsDuplicateTracker();

      const detailWithEmptyId: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        data: 'some-data',
        id: '',
      };

      const detailWithDataOnly: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        data: 'some-data',
      };

      // Empty string id falls through to data, so both use 'some-data' as key
      expect(tracker.upsert(detailWithEmptyId)).toBe(true);
      expect(tracker.upsert(detailWithDataOnly)).toBe(false); // Collides
    });
  });

  describe('edge cases', () => {
    it('should handle multiple adds of same detail', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'test',
      };

      expect(tracker.upsert(detail)).toBe(true);
      expect(tracker.upsert(detail)).toBe(false);
      expect(tracker.upsert(detail)).toBe(false);
    });

    it('should handle mixed types', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const summary: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'summary value',
      };

      const encrypted: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        data: 'encrypted value',
      };

      const text: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'text value',
      };

      expect(tracker.upsert(summary)).toBe(true);
      expect(tracker.upsert(encrypted)).toBe(true);
      expect(tracker.upsert(text)).toBe(true);
    });
  });
});
