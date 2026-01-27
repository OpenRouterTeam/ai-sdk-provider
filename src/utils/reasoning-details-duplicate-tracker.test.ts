import type { ReasoningDetailUnion } from '../schemas/reasoning-details';

import { describe, expect, it } from 'vitest';
import { ReasoningFormat } from '../schemas/format';
import { ReasoningDetailType } from '../schemas/reasoning-details';
import {
  deduplicateReasoningDetails,
  ReasoningDetailsDuplicateTracker,
} from './reasoning-details-duplicate-tracker';

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
  });
});

describe('deduplicateReasoningDetails', () => {
  it('should deduplicate reasoning_details across multiple messages', () => {
    const message1Details: ReasoningDetailUnion[] = [
      {
        type: ReasoningDetailType.Encrypted,
        data: 'encrypted-data',
        id: 'rs_duplicate_id',
      },
    ];

    const message2Details: ReasoningDetailUnion[] = [
      {
        type: ReasoningDetailType.Encrypted,
        data: 'encrypted-data',
        id: 'rs_duplicate_id', // Same ID as message 1
      },
    ];

    const message3Details: ReasoningDetailUnion[] = [
      {
        type: ReasoningDetailType.Encrypted,
        data: 'different-data',
        id: 'rs_unique_id', // Different ID
      },
    ];

    const result = deduplicateReasoningDetails([
      message1Details,
      message2Details,
      message3Details,
    ]);

    // Message 1 should have its detail (first occurrence)
    expect(result.get(0)?.length).toBe(1);
    expect(result.get(0)?.[0]?.id).toBe('rs_duplicate_id');

    // Message 2 should have no details (duplicate)
    expect(result.has(1)).toBe(false);

    // Message 3 should have its detail (unique)
    expect(result.get(2)?.length).toBe(1);
    expect(result.get(2)?.[0]?.id).toBe('rs_unique_id');
  });

  it('should handle empty and undefined arrays', () => {
    const result = deduplicateReasoningDetails([undefined, [], undefined]);

    expect(result.size).toBe(0);
  });

  it('should handle the exact scenario from issue #254 - multi-turn with same reasoning ID', () => {
    // Simulating the POC scenario where gpt-5-codex generates the same reasoning ID
    // across multiple tool call turns
    const turn1Details: ReasoningDetailUnion[] = [
      {
        type: ReasoningDetailType.Encrypted,
        data: 'reasoning-content-1',
        id: 'rs_0ad20f1f8629dc53016924443203408193abb5b3d0b4301e26',
      },
    ];

    const turn2Details: ReasoningDetailUnion[] = [
      {
        type: ReasoningDetailType.Encrypted,
        data: 'reasoning-content-2',
        id: 'rs_0ad20f1f8629dc53016924443203408193abb5b3d0b4301e26', // Same ID!
      },
    ];

    const turn3Details: ReasoningDetailUnion[] = [
      {
        type: ReasoningDetailType.Encrypted,
        data: 'reasoning-content-3',
        id: 'rs_0ad20f1f8629dc53016924443203408193abb5b3d0b4301e26', // Same ID!
      },
    ];

    const result = deduplicateReasoningDetails([
      turn1Details,
      turn2Details,
      turn3Details,
    ]);

    // Only the first turn should have reasoning_details
    expect(result.get(0)?.length).toBe(1);
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(false);
  });

  it('should preserve Gemini encrypted reasoning across turns when IDs are different', () => {
    // Gemini uses different IDs for each turn's thoughtSignature
    const turn1Details: ReasoningDetailUnion[] = [
      {
        type: ReasoningDetailType.Encrypted,
        data: 'gemini-thought-signature-1',
        format: ReasoningFormat.GoogleGeminiV1,
      },
    ];

    const turn2Details: ReasoningDetailUnion[] = [
      {
        type: ReasoningDetailType.Encrypted,
        data: 'gemini-thought-signature-2', // Different data = different key
        format: ReasoningFormat.GoogleGeminiV1,
      },
    ];

    const result = deduplicateReasoningDetails([turn1Details, turn2Details]);

    // Both turns should have their reasoning_details preserved
    expect(result.get(0)?.length).toBe(1);
    expect(result.get(1)?.length).toBe(1);
  });
});
