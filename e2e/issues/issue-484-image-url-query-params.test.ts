/**
 * Regression test for GitHub issue #484
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/484
 *
 * Issue: "Zod Schema for Image URLs restricts query params"
 *
 * The `supportedUrls` regex for `image/*` only matches URLs that END with a
 * known extension. Valid image URLs with query strings or fragments do NOT
 * match, so the AI SDK's LanguageModelV3 layer treats them as unsupported
 * and downloads + base64-encodes them.
 */
import { describe, expect, it } from 'vitest';
import { createOpenRouter } from '@/src';

const provider = createOpenRouter({ apiKey: 'test-key' });
const chatModel = provider.chat('anthropic/claude-3.5-sonnet');
const completionModel = provider.completion('openai/gpt-3.5-turbo-instruct');

const IMAGE_URLS_WITH_QUERY_PARAMS = [
  'https://cdn.example.com/photo.png?height=200',
  'https://cdn.example.com/photo.jpeg?w=100&h=200',
  'https://cdn.example.com/photo.webp?v=1&t=2',
  'https://cdn.example.com/photo.gif?cache=false',
  'https://cdn.example.com/photo.jpg?signature=abc123',
] as const;

const IMAGE_URLS_WITH_FRAGMENTS = [
  'https://cdn.example.com/photo.png#section',
  'https://cdn.example.com/photo.webp#fragment',
] as const;

const IMAGE_URLS_WITH_QUERY_AND_FRAGMENT = [
  'https://cdn.example.com/photo.png?height=200#section',
] as const;

const STILL_VALID_PLAIN_URLS = [
  'https://cdn.example.com/photo.png',
  'https://cdn.example.com/photo.PNG',
  'https://cdn.example.com/photo.jpeg',
  'https://cdn.example.com/photo.jpg',
  'https://cdn.example.com/photo.webp',
  'https://cdn.example.com/photo.gif',
  'data:image/png;base64,AAECAw==',
] as const;

const STILL_INVALID_URLS = [
  'https://example.com/not-an-image.txt',
  'ftp://example.com/photo.png',
  'https://example.com/document.pdf',
] as const;

/**
 * Additional defensive edge cases for the same failure mode.
 *
 * These cover real-world image URL shapes commonly seen with CDNs and
 * pre-signed object storage URLs (S3, GCS, R2, etc.). They are deliberately
 * tightly scoped to the same `?...` / `#...` suffix relaxation — they should
 * NOT pass under any pattern that drops the extension requirement entirely.
 */
const DEFENSIVE_EXTRA_VALID_URLS = [
  // URL-encoded query value (typical for signed URLs)
  'https://cdn.example.com/photo.png?token=abc%20def%2F123',
  // Pre-signed S3-style URL with multiple query params
  'https://my-bucket.s3.amazonaws.com/photo.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=deadbeef',
  // Both query and fragment, plus uppercase extension
  'https://cdn.example.com/photo.PNG?x=1#frag',
  // Empty query string (still a query, just no params)
  'https://cdn.example.com/photo.gif?',
  // Empty fragment
  'https://cdn.example.com/photo.webp#',
] as const;

/**
 * Defensive cases that must REMAIN rejected after the fix.
 *
 * The most important one is the "extension-in-the-path" shape:
 * `https://cdn.example.com/some.png/redirect`. Naive relaxations of the
 * regex (e.g. dropping the `$` anchor or replacing it with `.*`) would
 * accept this, which would regress the explicit `image/*` allowlist.
 */
const DEFENSIVE_EXTRA_INVALID_URLS = [
  // Extension is in the path, not terminal — must stay rejected
  'https://cdn.example.com/some.png/redirect',
  // Extension followed by another path segment
  'https://cdn.example.com/photo.jpg/thumbnail',
  // No extension at all, just a query string
  'https://cdn.example.com/photo?type=png',
  // Wrong scheme with query params
  'ftp://example.com/photo.png?x=1',
] as const;

function firstImagePattern(supportedUrls: Record<string, RegExp[]>): RegExp[] {
  const patterns = supportedUrls['image/*'];
  if (!patterns) {
    throw new Error('image/* patterns missing');
  }
  return patterns;
}

function matchesAny(url: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(url));
}

describe('Issue #484: image URL regex must accept query strings and fragments', () => {
  describe('chat model supportedUrls', () => {
    const patterns = firstImagePattern(chatModel.supportedUrls);
    it.each(IMAGE_URLS_WITH_QUERY_PARAMS)('accepts query params: %s', (url) => {
      expect(matchesAny(url, patterns)).toBe(true);
    });
    it.each(IMAGE_URLS_WITH_FRAGMENTS)('accepts fragment: %s', (url) => {
      expect(matchesAny(url, patterns)).toBe(true);
    });
    it.each(
      IMAGE_URLS_WITH_QUERY_AND_FRAGMENT,
    )('accepts query+fragment: %s', (url) => {
      expect(matchesAny(url, patterns)).toBe(true);
    });
    it.each(STILL_VALID_PLAIN_URLS)('still accepts plain: %s', (url) => {
      expect(matchesAny(url, patterns)).toBe(true);
    });
    it.each(STILL_INVALID_URLS)('still rejects: %s', (url) => {
      expect(matchesAny(url, patterns)).toBe(false);
    });
    it.each(DEFENSIVE_EXTRA_VALID_URLS)('defensive: accepts %s', (url) => {
      expect(matchesAny(url, patterns)).toBe(true);
    });
    it.each(
      DEFENSIVE_EXTRA_INVALID_URLS,
    )('defensive: still rejects %s', (url) => {
      expect(matchesAny(url, patterns)).toBe(false);
    });
  });

  describe('completion model supportedUrls', () => {
    const patterns = firstImagePattern(completionModel.supportedUrls);
    it('accepts image URL with query params', () => {
      expect(
        matchesAny('https://cdn.example.com/photo.png?height=200', patterns),
      ).toBe(true);
    });
    it('accepts image URL with fragment', () => {
      expect(matchesAny('https://cdn.example.com/photo.webp#f', patterns)).toBe(
        true,
      );
    });
    it('still rejects non-image URL', () => {
      expect(matchesAny('https://example.com/document.pdf', patterns)).toBe(
        false,
      );
    });
    it('defensive: still rejects extension-in-path', () => {
      expect(
        matchesAny('https://cdn.example.com/some.png/redirect', patterns),
      ).toBe(false);
    });
    it('defensive: accepts pre-signed URL with multiple query params', () => {
      expect(
        matchesAny(
          'https://my-bucket.s3.amazonaws.com/photo.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=deadbeef',
          patterns,
        ),
      ).toBe(true);
    });
  });
});
