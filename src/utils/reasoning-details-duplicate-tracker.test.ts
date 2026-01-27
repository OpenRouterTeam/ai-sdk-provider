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

  describe('cross-type collision prevention', () => {
    it('should not collide when different types have same field value', () => {
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

    it('should not collide text field with signature field having same value', () => {
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
      expect(tracker.upsert(textWithSignature)).toBe(true);
    });
  });

  describe('empty string handling', () => {
    it('should treat empty string text as valid key', () => {
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

      // Empty string text should use "text:" key, not fall through to signature
      expect(tracker.upsert(detailWithEmptyText)).toBe(true);
      expect(tracker.upsert(detailWithSignatureOnly)).toBe(true);
    });

    it('should treat empty string encrypted id as valid key', () => {
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

      // Empty string id should use "encrypted:" key, not fall through to data
      expect(tracker.upsert(detailWithEmptyId)).toBe(true);
      expect(tracker.upsert(detailWithDataOnly)).toBe(true);
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
