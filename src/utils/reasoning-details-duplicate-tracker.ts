import type { ReasoningDetailUnion } from '../schemas/reasoning-details';

import { ReasoningFormat } from '../schemas/format';
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
 * - Every key is prefixed with the detail `type`, so details of different
 *   types never collide even when their identifying values are equal.
 * - Summary: key = summary field
 * - Encrypted: key = data field for `google-gemini-v1`, otherwise id field
 *   (if truthy) or data field
 * - Text: key = signature field (if truthy) or text field (if truthy)
 *
 * `format` is deliberately NOT part of the key: it is nullish and gets
 * defaulted during extraction, so the same item can arrive with and without
 * it, and splitting those would re-send duplicates (OpenAI Responses rejects a
 * repeated `rs_` id with "Duplicate item found").
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
    const identity = this.getIdentity(detail);
    if (identity === null) {
      return null;
    }
    return `${detail.type}:${identity}`;
  }

  private getIdentity(detail: ReasoningDetailUnion): string | null {
    // This logic matches the OpenRouter API's deduplication exactly.
    // See: openrouter-web/packages/llm-interfaces/reasonings/duplicate-tracker.ts
    switch (detail.type) {
      case ReasoningDetailType.Summary:
        return detail.summary;

      case ReasoningDetailType.Encrypted:
        // Gemini encrypted ids are derived from tool-call ids, which can repeat
        // across turns, so the blob itself is the identity. Every other format
        // (notably OpenAI `rs_` ids) keeps id-based dedupe.
        if (detail.id && detail.format !== ReasoningFormat.GoogleGeminiV1) {
          return detail.id;
        }
        return detail.data;

      case ReasoningDetailType.Text: {
        // A signature identifies one signed block; identical text can appear in
        // distinct signed blocks. Fall back to text only for unsigned blocks.
        if (detail.signature) {
          return detail.signature;
        }
        if (detail.text) {
          return detail.text;
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
