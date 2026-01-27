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
 * The canonical key logic matches the OpenRouter API's deduplication:
 * - Summary: key = summary field
 * - Encrypted: key = id field (if present) or data field
 * - Text: key = text field (if present) or signature field
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
    // Prefix keys with type to prevent cross-type collisions.
    // For example, a summary with summary="abc" and an encrypted with data="abc"
    // would otherwise collide. The type prefix ensures they're treated as distinct.
    switch (detail.type) {
      case ReasoningDetailType.Summary:
        return `summary:${detail.summary}`;

      case ReasoningDetailType.Encrypted:
        // Use explicit null check to allow empty string IDs
        if (detail.id != null) {
          return `encrypted:${detail.id}`;
        }
        return `encrypted:${detail.data}`;

      case ReasoningDetailType.Text: {
        // Use explicit null checks to allow empty strings as valid values
        if (detail.text != null) {
          return `text:${detail.text}`;
        }
        if (detail.signature != null) {
          // Use different prefix to avoid collision with text field
          return `text-sig:${detail.signature}`;
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
