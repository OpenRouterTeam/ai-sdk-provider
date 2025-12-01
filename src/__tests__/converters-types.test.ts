/**
 * Unit tests for converter type utilities.
 */

import { describe, expect, it } from 'vitest';
import {
  assertNever,
  classifyFileData,
  classifiedDataToUrl,
  toolOutputToString,
  isKnownToolOutputType,
  categorizeMediaType,
} from '../converters/types';

describe('classifyFileData', () => {
  it('classifies Uint8Array as uint8array', () => {
    const data = new Uint8Array([1, 2, 3]);
    const result = classifyFileData(data);
    expect(result.kind).toBe('uint8array');
    expect(result.value).toBe(data);
  });

  it('classifies URL object as url', () => {
    const data = new URL('https://example.com/image.png');
    const result = classifyFileData(data);
    expect(result.kind).toBe('url');
    expect(result.value).toBe('https://example.com/image.png');
  });

  it('classifies https:// string as url', () => {
    const result = classifyFileData('https://example.com/image.png');
    expect(result.kind).toBe('url');
    expect(result.value).toBe('https://example.com/image.png');
  });

  it('classifies http:// string as url', () => {
    const result = classifyFileData('http://localhost:3000/image.png');
    expect(result.kind).toBe('url');
    expect(result.value).toBe('http://localhost:3000/image.png');
  });

  it('extracts base64 from data URL', () => {
    const result = classifyFileData('data:image/png;base64,abc123def');
    expect(result.kind).toBe('base64');
    expect(result.value).toBe('abc123def');
  });

  it('handles data URL without base64 marker', () => {
    const result = classifyFileData('data:text/plain,hello');
    expect(result.kind).toBe('base64');
    expect(result.value).toBe('data:text/plain,hello');
  });

  it('assumes plain string is base64', () => {
    const result = classifyFileData('abc123def456');
    expect(result.kind).toBe('base64');
    expect(result.value).toBe('abc123def456');
  });
});

describe('classifiedDataToUrl', () => {
  it('returns URL string directly', () => {
    const result = classifiedDataToUrl(
      { kind: 'url', value: 'https://example.com/img.png' },
      'image/png',
    );
    expect(result).toBe('https://example.com/img.png');
  });

  it('converts base64 to data URL', () => {
    const result = classifiedDataToUrl({ kind: 'base64', value: 'abc123' }, 'image/png');
    expect(result).toBe('data:image/png;base64,abc123');
  });

  it('converts Uint8Array to data URL', () => {
    const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello" in ASCII
    const result = classifiedDataToUrl({ kind: 'uint8array', value: data }, 'text/plain');
    expect(result).toBe('data:text/plain;base64,SGVsbG8=');
  });

  it('returns null for unknown data', () => {
    const result = classifiedDataToUrl({ kind: 'unknown', value: null }, 'image/png');
    expect(result).toBeNull();
  });

  it('handles empty media type', () => {
    // Empty string still produces valid data URL, just without a media type
    const result = classifiedDataToUrl({ kind: 'base64', value: 'abc123' }, '');
    expect(result).toBe('data:;base64,abc123');
  });

  it('uses fallback for undefined-ish media type', () => {
    // Nullish coalescing applies default when mediaType is falsy but not empty string
    const result = classifiedDataToUrl({ kind: 'base64', value: 'abc123' }, undefined as unknown as string);
    expect(result).toBe('data:application/octet-stream;base64,abc123');
  });
});

describe('toolOutputToString', () => {
  it('formats error-text with prefix', () => {
    const result = toolOutputToString({ type: 'error-text', value: 'Something went wrong' });
    expect(result).toBe('Error: Something went wrong');
  });

  it('formats error-json with prefix and JSON', () => {
    const result = toolOutputToString({
      type: 'error-json',
      value: { code: 500, message: 'Server error' },
    });
    expect(result).toBe('Error: {"code":500,"message":"Server error"}');
  });

  it('formats text directly', () => {
    const result = toolOutputToString({ type: 'text', value: 'Hello world' });
    expect(result).toBe('Hello world');
  });

  it('formats json as JSON string', () => {
    const result = toolOutputToString({
      type: 'json',
      value: { name: 'John', age: 30 },
    });
    expect(result).toBe('{"name":"John","age":30}');
  });

  it('formats content array with text parts', () => {
    const result = toolOutputToString({
      type: 'content',
      value: [
        { type: 'text', text: 'Line 1' },
        { type: 'text', text: 'Line 2' },
      ],
    });
    expect(result).toBe('Line 1\nLine 2');
  });

  it('formats content array with media parts', () => {
    const result = toolOutputToString({
      type: 'content',
      value: [
        { type: 'text', text: 'Here is an image:' },
        { type: 'media', mediaType: 'image/png' },
      ],
    });
    expect(result).toBe('Here is an image:\n[Image: image/png]');
  });

  it('handles non-array content as JSON', () => {
    const result = toolOutputToString({
      type: 'content',
      value: { unexpected: 'object' },
    });
    expect(result).toBe('{"unexpected":"object"}');
  });
});

describe('isKnownToolOutputType', () => {
  it('returns true for known types', () => {
    expect(isKnownToolOutputType('error-text')).toBe(true);
    expect(isKnownToolOutputType('error-json')).toBe(true);
    expect(isKnownToolOutputType('text')).toBe(true);
    expect(isKnownToolOutputType('json')).toBe(true);
    expect(isKnownToolOutputType('content')).toBe(true);
  });

  it('returns false for unknown types', () => {
    expect(isKnownToolOutputType('unknown')).toBe(false);
    expect(isKnownToolOutputType('binary')).toBe(false);
    expect(isKnownToolOutputType('')).toBe(false);
  });
});

describe('categorizeMediaType', () => {
  it('categorizes image types as image', () => {
    expect(categorizeMediaType('image/png')).toBe('image');
    expect(categorizeMediaType('image/jpeg')).toBe('image');
    expect(categorizeMediaType('image/gif')).toBe('image');
    expect(categorizeMediaType('image/webp')).toBe('image');
  });

  it('categorizes non-image types as other', () => {
    expect(categorizeMediaType('application/pdf')).toBe('other');
    expect(categorizeMediaType('text/plain')).toBe('other');
    expect(categorizeMediaType('application/json')).toBe('other');
  });
});

describe('assertNever', () => {
  it('throws error with default message', () => {
    expect(() => assertNever('unexpected' as never)).toThrow(
      'Unhandled discriminated union member: "unexpected"',
    );
  });

  it('throws error with custom message', () => {
    expect(() => assertNever('value' as never, 'Custom error message')).toThrow(
      'Custom error message',
    );
  });
});
