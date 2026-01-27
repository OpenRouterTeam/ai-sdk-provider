import type { ReasoningDetailUnion } from '../schemas/reasoning-details';

import { describe, expect, it } from 'vitest';
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

  describe('Text type deduplication', () => {
    it('should deduplicate using text field when present', () => {
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

  describe('cross-type collision behavior (matches API)', () => {
    it('should collide when different types have same field value', () => {
      // This matches the OpenRouter API behavior - keys are not type-prefixed
      // so different types with the same value will collide
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
      expect(tracker.upsert(encrypted)).toBe(false); // Collides with summary
      expect(tracker.upsert(text)).toBe(false); // Collides with summary
    });

    it('should collide text field with signature field having same value', () => {
      // This matches the OpenRouter API behavior - text and signature use
      // the same key space, so they will collide if they have the same value
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
    it('should treat empty string text as falsy and fall through to signature', () => {
      // This matches the OpenRouter API behavior - empty strings are falsy
      // so they fall through to the next field
      const tracker = new ReasoningDetailsDuplicateTracker();

      const detailWithEmptyText: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: '',
        signature: 'some-signature',
      };

      const detailWithSignatureOnly: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: null,
        signature: 'some-signature',
      };

      // Empty string text falls through to signature, so both use 'some-signature' as key
      expect(tracker.upsert(detailWithEmptyText)).toBe(true);
      expect(tracker.upsert(detailWithSignatureOnly)).toBe(false); // Collides
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
