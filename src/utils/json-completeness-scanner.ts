export type JsonCompletenessScanner = {
  depth: number;
  inString: boolean;
  escaped: boolean;
};

export function createJsonCompletenessScanner(): JsonCompletenessScanner {
  return { depth: 0, inString: false, escaped: false };
}

/**
 * Incrementally scans a streamed JSON chunk and returns whether the text seen
 * so far may be complete JSON (depth back to 0 and not inside a string).
 *
 * This is a cheap guard for `isParsableJson`: complete JSON always returns
 * true here, so callers can skip re-parsing the whole accumulated string on
 * every delta without changing the parse result.
 */
export function mayBeCompleteJson(
  scanner: JsonCompletenessScanner,
  chunk: string,
): boolean {
  // An unmatched closer means no continuation can be valid JSON.
  for (let i = 0; i < chunk.length && scanner.depth >= 0; i++) {
    const char = chunk[i];
    if (scanner.inString) {
      if (scanner.escaped) {
        scanner.escaped = false;
      } else if (char === '\\') {
        scanner.escaped = true;
      } else if (char === '"') {
        scanner.inString = false;
      }
    } else if (char === '"') {
      scanner.inString = true;
    } else if (char === '{' || char === '[') {
      scanner.depth++;
    } else if (char === '}' || char === ']') {
      scanner.depth--;
    }
  }
  return scanner.depth === 0 && !scanner.inString;
}
