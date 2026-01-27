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
  readonly #entriesByKey = new Map<string, ReasoningDetailUnion>();

  getAll(): ReasoningDetailUnion[] {
    return Array.from(this.#entriesByKey.values());
  }

  has(detail: ReasoningDetailUnion): boolean {
    const key = this.getCanonicalKey(detail);
    if (key === null) {
      return false;
    }
    return this.#entriesByKey.has(key);
  }

  upsert(detail: ReasoningDetailUnion): void {
    const key = this.getCanonicalKey(detail);
    if (key === null) {
      return;
    }

    const existingDetail = this.#entriesByKey.get(key);
    if (existingDetail === undefined) {
      this.#entriesByKey.set(key, detail);
      return;
    }

    // Merge the 2 details to dedupe them, cherry pick only defined values
    // The type assertion is safe because we're merging two details of the same
    // canonical key, which means they have the same discriminated type
    this.#entriesByKey.set(key, {
      ...this.definedValues(existingDetail),
      ...this.definedValues(detail),
    } as ReasoningDetailUnion);
  }

  private definedValues<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const result: Partial<T> = {};
    for (const key of Object.keys(obj) as Array<keyof T>) {
      if (obj[key] !== undefined) {
        result[key] = obj[key];
      }
    }
    return result;
  }

  private getCanonicalKey(detail: ReasoningDetailUnion): string | null {
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

/**
 * Deduplicates an array of reasoning details across multiple messages.
 * Returns only unique reasoning details based on their canonical keys.
 */
export function deduplicateReasoningDetails(
  allReasoningDetails: Array<ReasoningDetailUnion[] | undefined>,
): Map<number, ReasoningDetailUnion[]> {
  const tracker = new ReasoningDetailsDuplicateTracker();
  const result = new Map<number, ReasoningDetailUnion[]>();

  for (let i = 0; i < allReasoningDetails.length; i++) {
    const details = allReasoningDetails[i];
    if (!details || details.length === 0) {
      continue;
    }

    const uniqueForThisMessage: ReasoningDetailUnion[] = [];
    for (const detail of details) {
      if (!tracker.has(detail)) {
        tracker.upsert(detail);
        uniqueForThisMessage.push(detail);
      }
    }

    if (uniqueForThisMessage.length > 0) {
      result.set(i, uniqueForThisMessage);
    }
  }

  return result;
}
