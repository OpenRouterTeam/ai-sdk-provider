import { describe, expect, it } from 'vitest';
import { withUserAgentSuffix } from './with-user-agent-suffix';

describe('withUserAgentSuffix', () => {
  const sdkVersion = 'ai-sdk/openrouter/1.5.4';

  describe('when no user-agent is provided', () => {
    it('should set the SDK version as the user-agent', () => {
      const result = withUserAgentSuffix({}, sdkVersion);

      expect(result['user-agent']).toBe(sdkVersion);
      expect(result['X-OpenRouter-SDK-Version']).toBeUndefined();
    });

    it('should set SDK version as user-agent with undefined headers', () => {
      const result = withUserAgentSuffix(undefined, sdkVersion);

      expect(result['user-agent']).toBe(sdkVersion);
    });

    it('should preserve other headers', () => {
      const result = withUserAgentSuffix(
        { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
        sdkVersion,
      );

      expect(result['user-agent']).toBe(sdkVersion);
      expect(result['Authorization']).toBe('Bearer token');
      expect(result['Content-Type']).toBe('application/json');
    });
  });

  describe('when user-agent is provided', () => {
    it('should NOT modify the user-provided user-agent', () => {
      const result = withUserAgentSuffix(
        { 'user-agent': 'my-custom-agent/1.0' },
        sdkVersion,
      );

      expect(result['user-agent']).toBe('my-custom-agent/1.0');
    });

    it('should add SDK version as X-OpenRouter-SDK-Version header', () => {
      const result = withUserAgentSuffix(
        { 'user-agent': 'my-custom-agent/1.0' },
        sdkVersion,
      );

      expect(result['X-OpenRouter-SDK-Version']).toBe(sdkVersion);
    });

    it('should preserve all other headers', () => {
      const result = withUserAgentSuffix(
        {
          'user-agent': 'my-custom-agent/1.0',
          Authorization: 'Bearer token',
          'X-Custom-Header': 'value',
        },
        sdkVersion,
      );

      expect(result['user-agent']).toBe('my-custom-agent/1.0');
      expect(result['X-OpenRouter-SDK-Version']).toBe(sdkVersion);
      expect(result['Authorization']).toBe('Bearer token');
      expect(result['X-Custom-Header']).toBe('value');
    });
  });

  describe('edge cases', () => {
    it('should remove null header values', () => {
      const result = withUserAgentSuffix(
        {
          Authorization: 'Bearer token',
          'X-Optional': null,
        } as unknown as Record<string, string | undefined>,
        sdkVersion,
      );

      expect(result['Authorization']).toBe('Bearer token');
      expect('X-Optional' in result).toBe(false);
    });

    it('should handle empty user-agent as not provided', () => {
      const result = withUserAgentSuffix({ 'user-agent': '' }, sdkVersion);

      // Empty string is falsy, so SDK version becomes the user-agent
      expect(result['user-agent']).toBe(sdkVersion);
      expect(result['X-OpenRouter-SDK-Version']).toBeUndefined();
    });
  });
});
