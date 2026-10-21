export type JsonCompletenessScanner = {
  depth: number;
  inString: boolean;
  escaped: boolean;
  /** A non-whitespace character has been seen at the top level. */
  started: boolean;
  /** The top-level value is complete; only whitespace may follow. */
  ended: boolean;
  /** The text seen so far can never become valid JSON. */
  dead: boolean;
};

export function createJsonCompletenessScanner(): JsonCompletenessScanner {
  return {
    depth: 0,
    inString: false,
    escaped: false,
    started: false,
    ended: false,
    dead: false,
  };
}

// The only whitespace JSON.parse accepts around a value.
function isJsonWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

function canStartJsonValue(char: string): boolean {
  return (
    char === '{' ||
    char === '[' ||
    char === '"' ||
    char === '-' ||
    char === 't' ||
    char === 'f' ||
    char === 'n' ||
    (char >= '0' && char <= '9')
  );
}

/**
 * Incrementally scans a streamed JSON chunk and returns whether the text seen
 * so far may be complete JSON (depth back to 0 and not inside a string).
 *
 * This is a cheap guard for `isParsableJson`: complete JSON always returns
 * true here, so callers can skip re-parsing the whole accumulated string on
 * every delta without changing the parse result.
 *
 * Once the text can never become valid JSON (an unexpected first character,
 * an unmatched closer, or content after a complete top-level value), the
 * scanner is dead and always returns false.
 */
export function mayBeCompleteJson(
  scanner: JsonCompletenessScanner,
  chunk: string,
): boolean {
  for (let i = 0; i < chunk.length && !scanner.dead; i++) {
    const char = chunk[i] as string;
    if (scanner.inString) {
      if (scanner.escaped) {
        scanner.escaped = false;
      } else if (char === '\\') {
        scanner.escaped = true;
      } else if (char === '"') {
        scanner.inString = false;
        if (scanner.depth === 0) {
          scanner.ended = true;
        }
      }
    } else if (isJsonWhitespace(char)) {
      // Whitespace ends a top-level number or literal.
      if (scanner.started && scanner.depth === 0) {
        scanner.ended = true;
      }
    } else if (scanner.ended) {
      scanner.dead = true;
    } else if (!scanner.started) {
      scanner.started = true;
      if (!canStartJsonValue(char)) {
        scanner.dead = true;
      } else if (char === '"') {
        scanner.inString = true;
      } else if (char === '{' || char === '[') {
        scanner.depth++;
      }
    } else if (char === '"') {
      scanner.inString = true;
    } else if (char === '{' || char === '[') {
      scanner.depth++;
    } else if (char === '}' || char === ']') {
      scanner.depth--;
      if (scanner.depth === 0) {
        scanner.ended = true;
      } else if (scanner.depth < 0) {
        scanner.dead = true;
      }
    }
  }
  return !scanner.dead && scanner.depth === 0 && !scanner.inString;
}
