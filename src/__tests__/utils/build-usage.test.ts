import type { OpenRouterRawUsage } from '../../utils/build-usage.js';

import { describe, expect, it } from 'vitest';
import { buildUsage } from '../../utils/build-usage.js';

describe('buildUsage', () => {
  it('should map inputTokens.total from response', () => {
    const usage: OpenRouterRawUsage = {
      inputTokens: 100,
      outputTokens: 50,
    };
    const result = buildUsage(usage);
    expect(result.inputTokens.total).toBe(100);
  });

  it('should map outputTokens.total from response', () => {
    const usage: OpenRouterRawUsage = {
      inputTokens: 100,
      outputTokens: 50,
    };
    const result = buildUsage(usage);
    expect(result.outputTokens.total).toBe(50);
  });

  it('should map inputTokens.cacheRead from inputTokensDetails.cachedTokens', () => {
    const usage: OpenRouterRawUsage = {
      inputTokens: 100,
      outputTokens: 50,
      inputTokensDetails: {
        cachedTokens: 25,
      },
    };
    const result = buildUsage(usage);
    expect(result.inputTokens.cacheRead).toBe(25);
  });

  it('should map outputTokens.reasoning from outputTokensDetails.reasoningTokens', () => {
    const usage: OpenRouterRawUsage = {
      inputTokens: 100,
      outputTokens: 50,
      outputTokensDetails: {
        reasoningTokens: 30,
      },
    };
    const result = buildUsage(usage);
    expect(result.outputTokens.reasoning).toBe(30);
  });

  it('should preserve raw usage data as JSONObject', () => {
    const usage: OpenRouterRawUsage = {
      inputTokens: 100,
      outputTokens: 50,
      inputTokensDetails: {
        cachedTokens: 25,
      },
    };
    const result = buildUsage(usage);
    expect(result.raw).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      inputTokensDetails: {
        cachedTokens: 25,
      },
    });
  });

  it('should handle undefined usage gracefully', () => {
    const result = buildUsage(undefined);
    expect(result.inputTokens.total).toBe(0);
    expect(result.outputTokens.total).toBe(0);
    expect(result.raw).toBeUndefined();
  });

  it('should handle missing inputTokensDetails', () => {
    const usage: OpenRouterRawUsage = {
      inputTokens: 100,
      outputTokens: 50,
    };
    const result = buildUsage(usage);
    expect(result.inputTokens.cacheRead).toBeUndefined();
  });

  it('should handle missing outputTokensDetails', () => {
    const usage: OpenRouterRawUsage = {
      inputTokens: 100,
      outputTokens: 50,
    };
    const result = buildUsage(usage);
    expect(result.outputTokens.reasoning).toBeUndefined();
  });

  it('should handle zero values correctly', () => {
    const usage: OpenRouterRawUsage = {
      inputTokens: 0,
      outputTokens: 0,
      inputTokensDetails: {
        cachedTokens: 0,
      },
      outputTokensDetails: {
        reasoningTokens: 0,
      },
    };
    const result = buildUsage(usage);
    expect(result.inputTokens.total).toBe(0);
    expect(result.outputTokens.total).toBe(0);
    expect(result.inputTokens.cacheRead).toBe(0);
    expect(result.outputTokens.reasoning).toBe(0);
  });
});
