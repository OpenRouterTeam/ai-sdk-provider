import { describe, expect, it } from 'vitest';
import { withUserAgentSuffix } from './with-user-agent-suffix';

describe('withUserAgentSuffix', () => {
  const SDK_SUFFIX = 'ai-sdk/openrouter/1.0.0';

  describe('when no user-agent header is provided', () => {
    it('should add SDK identifier as the user-agent', () => {
      const result = withUserAgentSuffix({}, SDK_SUFFIX);
      expect(result['user-agent']).toBe(SDK_SUFFIX);
    });

    it('should add SDK identifier when headers is undefined', () => {
      const result = withUserAgentSuffix(undefined, SDK_SUFFIX);
      expect(result['user-agent']).toBe(SDK_SUFFIX);
    });

    it('should preserve other headers while adding user-agent', () => {
      const result = withUserAgentSuffix(
        { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
        SDK_SUFFIX,
      );
      expect(result['user-agent']).toBe(SDK_SUFFIX);
      expect(result['Authorization']).toBe('Bearer token');
      expect(result['Content-Type']).toBe('application/json');
    });
  });

  describe('when user provides user-agent header', () => {
    it('should use user-provided lowercase user-agent verbatim without SDK suffix', () => {
      const result = withUserAgentSuffix(
        { 'user-agent': 'my-custom-agent/1.0' },
        SDK_SUFFIX,
      );
      expect(result['user-agent']).toBe('my-custom-agent/1.0');
    });

    it('should use user-provided capitalized User-Agent verbatim without SDK suffix', () => {
      const result = withUserAgentSuffix(
        { 'User-Agent': 'my-custom-agent/1.0' },
        SDK_SUFFIX,
      );
      expect(result['user-agent']).toBe('my-custom-agent/1.0');
      // Should not have duplicate header with different casing
      expect(result['User-Agent']).toBeUndefined();
    });

    it('should use user-provided mixed case USER-AGENT verbatim without SDK suffix', () => {
      const result = withUserAgentSuffix(
        { 'USER-AGENT': 'my-custom-agent/1.0' },
        SDK_SUFFIX,
      );
      expect(result['user-agent']).toBe('my-custom-agent/1.0');
      // Should not have duplicate header with different casing
      expect(result['USER-AGENT']).toBeUndefined();
    });

    it('should preserve other headers when user provides User-Agent', () => {
      const result = withUserAgentSuffix(
        {
          'User-Agent': 'my-custom-agent/1.0',
          Authorization: 'Bearer token',
        },
        SDK_SUFFIX,
      );
      expect(result['user-agent']).toBe('my-custom-agent/1.0');
      expect(result['Authorization']).toBe('Bearer token');
    });
  });

  describe('edge cases', () => {
    it('should use SDK identifier when user-agent is empty string', () => {
      const result = withUserAgentSuffix({ 'user-agent': '' }, SDK_SUFFIX);
      expect(result['user-agent']).toBe(SDK_SUFFIX);
    });

    it('should handle multiple suffix parts when no user-agent provided', () => {
      const result = withUserAgentSuffix({}, 'part1', 'part2');
      expect(result['user-agent']).toBe('part1 part2');
    });

    it('should remove undefined header values and not include the key', () => {
      const result = withUserAgentSuffix(
        { 'some-header': undefined as unknown as string },
        SDK_SUFFIX,
      );
      expect('some-header' in result).toBe(false);
      expect(result['user-agent']).toBe(SDK_SUFFIX);
    });
  });

  describe('HeadersInit variants', () => {
    it('should handle Headers object input', () => {
      const headers = new Headers({
        Authorization: 'Bearer token',
        'User-Agent': 'my-custom-agent/1.0',
      });
      const result = withUserAgentSuffix(headers, SDK_SUFFIX);
      expect(result['user-agent']).toBe('my-custom-agent/1.0');
      expect(result['authorization']).toBe('Bearer token');
    });

    it('should handle Headers object without user-agent', () => {
      const headers = new Headers({
        Authorization: 'Bearer token',
      });
      const result = withUserAgentSuffix(headers, SDK_SUFFIX);
      expect(result['user-agent']).toBe(SDK_SUFFIX);
      expect(result['authorization']).toBe('Bearer token');
    });

    it('should handle array-of-tuples input', () => {
      const headers: [string, string][] = [
        ['Authorization', 'Bearer token'],
        ['User-Agent', 'my-custom-agent/1.0'],
      ];
      const result = withUserAgentSuffix(headers, SDK_SUFFIX);
      expect(result['user-agent']).toBe('my-custom-agent/1.0');
      expect(result['Authorization']).toBe('Bearer token');
    });

    it('should handle array-of-tuples without user-agent', () => {
      const headers: [string, string][] = [
        ['Authorization', 'Bearer token'],
        ['Content-Type', 'application/json'],
      ];
      const result = withUserAgentSuffix(headers, SDK_SUFFIX);
      expect(result['user-agent']).toBe(SDK_SUFFIX);
      expect(result['Authorization']).toBe('Bearer token');
      expect(result['Content-Type']).toBe('application/json');
    });
  });
});
