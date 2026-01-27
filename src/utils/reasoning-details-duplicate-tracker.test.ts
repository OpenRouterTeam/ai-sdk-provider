import type { ReasoningDetailUnion } from '../schemas/reasoning-details';

import { describe, expect, it } from 'vitest';
import { ReasoningDetailType } from '../schemas/reasoning-details';
import { ReasoningDetailsDuplicateTracker } from './reasoning-details-duplicate-tracker';

describe('ReasoningDetailsDuplicateTracker', () => {
  describe('basic operations', () => {
    it('should return empty array initially', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      expect(tracker.getAll()).toEqual([]);
    });

    it('should add a new detail', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'test summary',
      };

      tracker.upsert(detail);
      expect(tracker.getAll()).toEqual([detail]);
    });

    it('should return false for non-existent detail', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'test summary',
      };

      expect(tracker.has(detail)).toBe(false);
    });

    it('should return true for existing detail', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'test summary',
      };

      tracker.upsert(detail);
      expect(tracker.has(detail)).toBe(true);
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

      tracker.upsert(detail1);
      tracker.upsert(detail2);

      const result = tracker.getAll();
      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe('id2'); // Second detail's id should win
    });

    it('should create separate entries for different summaries', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'first summary',
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'second summary',
      };

      tracker.upsert(detail1);
      tracker.upsert(detail2);

      expect(tracker.getAll().length).toBe(2);
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

      tracker.upsert(detail1);
      tracker.upsert(detail2);

      const result = tracker.getAll();
      expect(result.length).toBe(1);
      expect((result[0] as { data: string }).data).toBe('data2');
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

      tracker.upsert(detail1);
      tracker.upsert(detail2);

      expect(tracker.getAll().length).toBe(1);
    });

    it('should create separate entries for different ids', () => {
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

      tracker.upsert(detail1);
      tracker.upsert(detail2);

      expect(tracker.getAll().length).toBe(2);
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

      tracker.upsert(detail1);
      tracker.upsert(detail2);

      const result = tracker.getAll();
      expect(result.length).toBe(1);
      expect((result[0] as { signature?: string | null }).signature).toBe(
        'sig2',
      );
    });

    it('should deduplicate using signature field when text is absent', () => {
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

      tracker.upsert(detail1);
      tracker.upsert(detail2);

      expect(tracker.getAll().length).toBe(1);
    });

    it('should skip detail when both text and signature are missing', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: null,
        signature: null,
      };

      tracker.upsert(detail);

      expect(tracker.getAll().length).toBe(0);
    });

    it('should create separate entries for different text values', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'text1',
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Text,
        text: 'text2',
      };

      tracker.upsert(detail1);
      tracker.upsert(detail2);

      expect(tracker.getAll().length).toBe(2);
    });
  });

  describe('merging behavior', () => {
    it('should preserve defined values from first detail when second has undefined', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'same summary',
        id: 'id1',
        index: 1,
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'same summary',
      };

      tracker.upsert(detail1);
      tracker.upsert(detail2);

      const result = tracker.getAll();
      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe('id1');
      expect(result[0]?.index).toBe(1);
    });

    it('should override with defined values from second detail', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail1: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'same summary',
      };

      const detail2: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'same summary',
        id: 'id2',
        index: 5,
      };

      tracker.upsert(detail1);
      tracker.upsert(detail2);

      const result = tracker.getAll();
      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe('id2');
      expect(result[0]?.index).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple adds of same detail', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();
      const detail: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'test',
      };

      tracker.upsert(detail);
      tracker.upsert(detail);
      tracker.upsert(detail);

      expect(tracker.getAll().length).toBe(1);
    });

    it('should handle mixed types with different canonical keys', () => {
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

      tracker.upsert(summary);
      tracker.upsert(encrypted);
      tracker.upsert(text);

      expect(tracker.getAll().length).toBe(3);
    });

    it('should not collide when different types have same field value', () => {
      // This tests the fix for cross-type key collision.
      // Without type prefixing, a summary with summary="abc" and an encrypted
      // with data="abc" would collide because they'd both have key "abc".
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

      tracker.upsert(summary);
      tracker.upsert(encrypted);
      tracker.upsert(text);

      // All three should be stored separately because they have different types
      const result = tracker.getAll();
      expect(result.length).toBe(3);

      // Verify each type is present
      expect(result.some((d) => d.type === ReasoningDetailType.Summary)).toBe(
        true,
      );
      expect(result.some((d) => d.type === ReasoningDetailType.Encrypted)).toBe(
        true,
      );
      expect(result.some((d) => d.type === ReasoningDetailType.Text)).toBe(
        true,
      );
    });

    it('should not detect cross-type duplicates with has()', () => {
      const tracker = new ReasoningDetailsDuplicateTracker();

      const summary: ReasoningDetailUnion = {
        type: ReasoningDetailType.Summary,
        summary: 'same-value',
      };

      tracker.upsert(summary);

      // An encrypted detail with the same value should NOT be detected as duplicate
      const encrypted: ReasoningDetailUnion = {
        type: ReasoningDetailType.Encrypted,
        data: 'same-value',
      };

      expect(tracker.has(encrypted)).toBe(false);
    });

    it('should not collide text field with signature field having same value', () => {
      // This tests the fix for text/signature key collision within Text type.
      // Without different prefixes, { text: 'abc' } and { text: null, signature: 'abc' }
      // would both have key "text:abc" and collide incorrectly.
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

      tracker.upsert(textWithText);
      tracker.upsert(textWithSignature);

      // Both should be stored separately because text uses "text:" prefix
      // and signature uses "text-sig:" prefix
      const result = tracker.getAll();
      expect(result.length).toBe(2);

      // Verify both are present
      expect(
        result.some(
          (d) =>
            d.type === ReasoningDetailType.Text &&
            (d as { text?: string | null }).text === 'same-value',
        ),
      ).toBe(true);
      expect(
        result.some(
          (d) =>
            d.type === ReasoningDetailType.Text &&
            (d as { signature?: string | null }).signature === 'same-value',
        ),
      ).toBe(true);
    });
  });
});
