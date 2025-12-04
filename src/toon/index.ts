/**
 * TOON (Token-Oriented Object Notation) helper utilities for token-efficient
 * data encoding in LLM prompts.
 *
 * TOON achieves ~40% token reduction vs JSON for tabular data while maintaining
 * high LLM comprehension accuracy.
 *
 * @see https://toonformat.dev
 * @see https://github.com/toon-format/toon
 *
 * @example
 * ```ts
 * import { encodeToon, decodeToon } from '@openrouter/ai-sdk-provider';
 *
 * // Encode data to TOON format
 * const toon = await encodeToon([
 *   { id: 1, name: 'Alice', score: 95 },
 *   { id: 2, name: 'Bob', score: 87 },
 * ]);
 * // Result: [2]{id,name,score}: 1,Alice,95 2,Bob,87
 *
 * // Decode TOON back to JSON
 * const data = await decodeToon(toon);
 * ```
 */

import type {
  DecodeOptions,
  EncodeOptions,
  JsonValue,
} from '@toon-format/toon';

export type { DecodeOptions, EncodeOptions, JsonValue };

export type ToonEncodeOptions = EncodeOptions;
export type ToonDecodeOptions = DecodeOptions;

/**
 * Lazily imports the @toon-format/toon package.
 * Uses dynamic import to support both ESM and CJS consumers.
 */
async function getToonModule() {
  try {
    return await import('@toon-format/toon');
  } catch {
    throw new Error(
      'The @toon-format/toon package is required for TOON encoding/decoding. ' +
        'Install it with: npm install @toon-format/toon',
    );
  }
}

/**
 * Encodes a JavaScript value into TOON format string.
 *
 * TOON is particularly efficient for uniform arrays of objects (tabular data),
 * achieving CSV-like compactness while preserving explicit structure.
 *
 * @param value - Any JavaScript value (objects, arrays, primitives)
 * @param options - Optional encoding configuration
 * @returns Promise resolving to TOON formatted string
 *
 * @example
 * ```ts
 * // Simple object
 * await encodeToon({ name: 'Alice', age: 30 });
 * // name: Alice
 * // age: 30
 *
 * // Tabular array (most efficient)
 * await encodeToon([
 *   { id: 1, name: 'Alice' },
 *   { id: 2, name: 'Bob' },
 * ]);
 * // [2]{id,name}: 1,Alice 2,Bob
 *
 * // With options
 * await encodeToon(data, { indent: 4, keyFolding: 'safe' });
 * ```
 */
export async function encodeToon(
  value: unknown,
  options?: ToonEncodeOptions,
): Promise<string> {
  const toon = await getToonModule();
  return toon.encode(value, options);
}

/**
 * Decodes a TOON format string into a JavaScript value.
 *
 * @param input - TOON formatted string
 * @param options - Optional decoding configuration
 * @returns Promise resolving to parsed JavaScript value
 *
 * @example
 * ```ts
 * // Decode simple object
 * await decodeToon('name: Alice\nage: 30');
 * // { name: 'Alice', age: 30 }
 *
 * // Decode tabular array
 * await decodeToon('[2]{id,name}: 1,Alice 2,Bob');
 * // [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
 *
 * // With options
 * await decodeToon(toonString, { strict: false, expandPaths: 'safe' });
 * ```
 */
export async function decodeToon(
  input: string,
  options?: ToonDecodeOptions,
): Promise<JsonValue> {
  const toon = await getToonModule();
  return toon.decode(input, options);
}
