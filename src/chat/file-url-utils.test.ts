import { describe, expect, it } from 'vitest';
import { getBase64FromDataUrl, getMediaType } from './file-url-utils';

// The implementation this replaced. Used as an oracle: the new function must
// match it on every input except the intentional changes tested below.
function previousGetBase64FromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:[^;]*;base64,(.+)$/);
  return match ? match[1]! : dataUrl;
}

function previousGetMediaType(
  dataUrl: string,
  defaultMediaType: string,
): string {
  const match = dataUrl.match(/^data:([^;]+)/);
  return match ? (match[1] ?? defaultMediaType) : defaultMediaType;
}

describe('getBase64FromDataUrl', () => {
  it('returns the payload of a base64 data URL', () => {
    expect(getBase64FromDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(
      'iVBORw0KGgo=',
    );
  });

  it.each([
    ['standard data URL', 'data:image/png;base64,iVBORw0KGgo='],
    ['empty media type', 'data:;base64,iVBORw0KGgo='],
    ['raw base64', 'iVBORw0KGgo='],
    ['https URL', 'https://example.com/image.png'],
    ['http URL', 'http://example.com/image.png'],
    ['missing ;base64', 'data:image/png,abc'],
    ['no comma', 'data:image/png;base64'],
    ['empty payload', 'data:image/png;base64,'],
    ['uppercase BASE64', 'data:image/png;BASE64,abc'],
    ['uppercase DATA:', 'DATA:image/png;base64,abc'],
    ['multiple ;base64, markers', 'data:image/png;base64,abc;base64,def'],
    ['comma inside payload', 'data:image/png;base64,abc,def'],
    [';base64 not followed by comma', 'data:image/png;base64x,abc'],
    ['empty string', ''],
    ['bare data:', 'data:'],
    ['long media type', `data:${'x'.repeat(250)};base64,AAA`],
  ])('matches the previous implementation: %s', (_name, input) => {
    expect(getBase64FromDataUrl(input)).toBe(
      previousGetBase64FromDataUrl(input),
    );
  });

  it('returns everything after the first ;base64, marker', () => {
    expect(getBase64FromDataUrl('data:image/png;base64,abc;base64,def')).toBe(
      'abc;base64,def',
    );
  });

  it('does not cap the length of the media type', () => {
    expect(getBase64FromDataUrl(`data:${'x'.repeat(250)};base64,AAA`)).toBe(
      'AAA',
    );
  });

  // Intentional change: the previous regex required `;base64` to directly
  // follow the media type, so parameters made it return the whole URL.
  it.each([
    ['data:image/png;charset=utf-8;base64,abc', 'abc'],
    ['data:text/plain;name=a.txt;charset=utf-8;base64,abc', 'abc'],
    ['data:;charset=utf-8;base64,abc', 'abc'],
  ])('decodes data URLs with parameters: %s', (input, expected) => {
    expect(getBase64FromDataUrl(input)).toBe(expected);
  });

  // Intentional change: `.` in the previous regex did not match line
  // terminators, so a payload with line breaks was returned as the whole URL.
  // Base64 decoders (atob, Buffer) accept line breaks, so the payload is now
  // returned as-is.
  it.each([
    ['\\n', 'data:image/png;base64,abc\ndef', 'abc\ndef'],
    ['\\r\\n', 'data:image/png;base64,abc\r\ndef', 'abc\r\ndef'],
    ['U+2028', 'data:image/png;base64,abc def', 'abc def'],
  ])('returns payloads containing %s', (_name, input, expected) => {
    expect(previousGetBase64FromDataUrl(input)).toBe(input);
    expect(getBase64FromDataUrl(input)).toBe(expected);
  });

  // Intentional change: per RFC 2397 the first comma ends the header, so a
  // comma cannot appear in the media type. The previous regex accepted it.
  it('treats the first comma as the end of the header', () => {
    const input = 'data:a,b;base64,xyz';
    expect(previousGetBase64FromDataUrl(input)).toBe('xyz');
    expect(getBase64FromDataUrl(input)).toBe(input);
  });

  it('handles a multi-megabyte payload', () => {
    const payload = 'A'.repeat(2_000_000);
    expect(getBase64FromDataUrl(`data:image/jpeg;base64,${payload}`)).toBe(
      payload,
    );
  });
});

describe('getMediaType', () => {
  it.each([
    ['data:image/png;base64,abc'],
    ['data:image/webp;base64,abc;def'],
    ['data:;base64,abc'],
    ['data:image/png'],
    ['data:'],
    ['DATA:image/png;base64,abc'],
    ['https://example.com/image.png'],
    ['iVBORw0KGgo='],
    ['data:image/png;charset=utf-8;base64,abc'],
  ])('matches the previous implementation: %s', (input) => {
    expect(getMediaType(input, 'image/jpeg')).toBe(
      previousGetMediaType(input, 'image/jpeg'),
    );
  });

  // Intentional change: only the header (before the first comma) is read.
  it.each([
    ['data:image/png,abc', 'image/png'],
    ['data:a,b;base64,xyz', 'a'],
    ['data:,abc', 'image/jpeg'],
  ])('reads the media type from the header only: %s', (input, expected) => {
    expect(getMediaType(input, 'image/jpeg')).toBe(expected);
  });
});
