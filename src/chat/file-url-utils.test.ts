import { describe, expect, it } from 'vitest';
import { getBase64FromDataUrl } from './file-url-utils';

describe('getBase64FromDataUrl', () => {
  it('returns the payload of a base64 data URL', () => {
    expect(getBase64FromDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(
      'iVBORw0KGgo=',
    );
  });

  it('returns the input unchanged when it is not a base64 data URL', () => {
    for (const input of [
      'iVBORw0KGgo=',
      'https://example.com/image.png',
      'data:image/png,abc',
      'data:image/png;base64,',
    ]) {
      expect(getBase64FromDataUrl(input)).toBe(input);
    }
  });

  it('handles a multi-megabyte payload without scanning it with a regex', () => {
    // About the size of a 4K image a model returns.
    const payload = 'A'.repeat(13_000_000);
    expect(getBase64FromDataUrl(`data:image/jpeg;base64,${payload}`)).toBe(
      payload,
    );
  });
});
