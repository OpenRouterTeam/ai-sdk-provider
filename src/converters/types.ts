/**
 * Type utilities and discriminated unions for message conversion.
 *
 * This module provides type-safe utilities for handling the various data formats
 * that can appear in AI SDK messages (URLs, base64, Uint8Array, etc.).
 */

// =============================================================================
// Type Guards and Assertions
// =============================================================================

/**
 * Exhaustive check helper - ensures all cases are handled in switch statements.
 *
 * If this function is reachable at runtime, it means a case was missed.
 * TypeScript will error at compile time if `value` is not of type `never`.
 *
 * @example
 * ```ts
 * type Color = 'red' | 'blue';
 * function handle(color: Color) {
 *   switch (color) {
 *     case 'red': return 'R';
 *     case 'blue': return 'B';
 *     default: return assertNever(color); // TS error if case added to Color
 *   }
 * }
 * ```
 */
export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unhandled discriminated union member: ${JSON.stringify(value)}`);
}

// =============================================================================
// File Data Classification
// =============================================================================

/**
 * Discriminated union types for classifying file data sources.
 *
 * WHY: AI SDK's LanguageModelV2FilePart.data can be string | URL | Uint8Array.
 * Using a discriminated union allows type-safe handling of each case without
 * repeated type checks or type assertions.
 */

export type FileDataUrl = {
  kind: 'url';
  value: string;
};

export type FileDataBase64 = {
  kind: 'base64';
  value: string;
};

export type FileDataUint8Array = {
  kind: 'uint8array';
  value: Uint8Array;
};

export type FileDataUnknown = {
  kind: 'unknown';
  value: unknown;
};

export type ClassifiedFileData =
  | FileDataUrl
  | FileDataBase64
  | FileDataUint8Array
  | FileDataUnknown;

/**
 * Classify file data into a discriminated union for type-safe handling.
 *
 * Classification priority:
 * 1. Uint8Array instances → 'uint8array' (binary data)
 * 2. URL objects → 'url' (native URL type)
 * 3. http:// or https:// strings → 'url' (remote resource)
 * 4. data: URLs → 'base64' (extract payload from data URL format)
 * 5. Other strings → 'base64' (assume raw base64 for backwards compat)
 * 6. Everything else → 'unknown' (graceful degradation)
 */
export function classifyFileData(data: string | URL | Uint8Array): ClassifiedFileData {
  if (data instanceof Uint8Array) {
    return {
      kind: 'uint8array',
      value: data,
    };
  }

  if (data instanceof URL) {
    return {
      kind: 'url',
      value: data.toString(),
    };
  }

  if (typeof data === 'string') {
    // Remote URLs
    if (data.startsWith('http://') || data.startsWith('https://')) {
      return {
        kind: 'url',
        value: data,
      };
    }
    // Data URLs - extract the base64 payload
    if (data.startsWith('data:')) {
      const base64Match = data.match(/base64,(.+)$/);
      return base64Match
        ? {
            kind: 'base64',
            value: base64Match[1],
          }
        : {
            kind: 'base64',
            value: data,
          };
    }
    // Assume raw base64 string (common in older SDK versions)
    return {
      kind: 'base64',
      value: data,
    };
  }

  return {
    kind: 'unknown',
    value: data,
  };
}

/**
 * Convert classified file data to a URL string (either http URL or data URL).
 *
 * Used when APIs require URL format but we have various input types.
 */
export function classifiedDataToUrl(
  classifiedData: ClassifiedFileData,
  mediaType: string,
): string | null {
  switch (classifiedData.kind) {
    case 'url':
      return classifiedData.value;

    case 'base64':
      return `data:${mediaType ?? 'application/octet-stream'};base64,${classifiedData.value}`;

    case 'uint8array': {
      const base64 = Buffer.from(classifiedData.value).toString('base64');
      return `data:${mediaType ?? 'application/octet-stream'};base64,${base64}`;
    }

    case 'unknown':
      return null;

    default:
      return assertNever(classifiedData);
  }
}

// =============================================================================
// Tool Output Types
// =============================================================================

/**
 * Known tool output types from the AI SDK.
 *
 * WHY: Tool results can be returned in various formats depending on whether
 * the tool succeeded or failed, and whether the output is text or structured.
 */
export type ToolOutputType = 'error-text' | 'error-json' | 'text' | 'json' | 'content';

export interface ToolOutputResult {
  type: ToolOutputType;
  value: unknown;
}

export function isKnownToolOutputType(type: string): type is ToolOutputType {
  return ['error-text', 'error-json', 'text', 'json', 'content'].includes(type);
}

/**
 * Convert tool output to string based on output type.
 *
 * Different output types are formatted appropriately:
 * - error-text/error-json: Prefixed with "Error: " for visibility
 * - text: Direct string conversion
 * - json: JSON stringified
 * - content: Multi-part content array collapsed to text
 */
export function toolOutputToString(output: ToolOutputResult): string {
  switch (output.type) {
    case 'error-text':
      return `Error: ${output.value}`;

    case 'error-json':
      return `Error: ${JSON.stringify(output.value)}`;

    case 'text':
      return String(output.value);

    case 'json':
      return JSON.stringify(output.value);

    case 'content': {
      if (!Array.isArray(output.value)) {
        return JSON.stringify(output.value);
      }
      return output.value
        .map((item: { type: string; text?: string; data?: unknown; mediaType?: string }) => {
          switch (item.type) {
            case 'text':
              return item.text ?? '';
            case 'media':
              return `[Image: ${item.mediaType ?? 'image'}]`;
            default:
              return '';
          }
        })
        .filter(Boolean)
        .join('\n');
    }

    default:
      return assertNever(output.type);
  }
}

// =============================================================================
// Media Type Helpers
// =============================================================================

export type MediaCategory = 'image' | 'other';

/**
 * Categorize a MIME type into broad categories for routing to appropriate converters.
 */
export function categorizeMediaType(mediaType: string): MediaCategory {
  return mediaType.startsWith('image/') ? 'image' : 'other';
}
