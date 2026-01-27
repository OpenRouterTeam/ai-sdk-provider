import type { ReasoningDetailUnion } from '../schemas/reasoning-details';

import { ReasoningDetailType } from '../schemas/reasoning-details';

/**
 * Tracks ReasoningDetailUnion entries and deduplicates them based
 * on a derived canonical key.
 *
 * This is used when converting messages to ensure the API request only
 * contains unique reasoning details, preventing "Duplicate item found with id"
 * errors in multi-turn conversations.
 *
 * The canonical key logic matches the OpenRouter API's deduplication exactly
 * (see openrouter-web/packages/llm-interfaces/reasonings/duplicate-tracker.ts):
 * - Summary: key = summary field
 * - Encrypted: key = id field (if truthy) or data field
 * - Text: key = text field (if truthy) or signature field (if truthy)
 */
export class ReasoningDetailsDuplicateTracker {
  readonly #seenKeys = new Set<string>();

  /**
   * Attempts to track a detail.
   * Returns true if this is a NEW detail (not seen before and has valid key),
   * false if it was skipped (no valid key) or already seen (duplicate).
   */
  upsert(detail: ReasoningDetailUnion): boolean {
    const key = this.getCanonicalKey(detail);
    if (key === null) {
      return false;
    }

    if (this.#seenKeys.has(key)) {
      return false;
    }

    this.#seenKeys.add(key);
    return true;
  }

  private getCanonicalKey(detail: ReasoningDetailUnion): string | null {
    // This logic matches the OpenRouter API's deduplication exactly.
    // See: openrouter-web/packages/llm-interfaces/reasonings/duplicate-tracker.ts
    switch (detail.type) {
      case ReasoningDetailType.Summary:
        return detail.summary;

      case ReasoningDetailType.Encrypted:
        if (detail.id) {
          return detail.id;
        }
        return detail.data;

      case ReasoningDetailType.Text: {
        if (detail.text) {
          return detail.text;
        }
        if (detail.signature) {
          return detail.signature;
        }
        return null;
      }

      default: {
        // Handle unknown types gracefully
        return null;
      }
    }
  }
}
