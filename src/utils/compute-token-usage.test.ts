import { describe, expect, it } from 'vitest';
import { computeTokenUsage, emptyUsage } from './compute-token-usage';

describe('computeTokenUsage', () => {
  it('should compute all fields from complete usage data', () => {
    const result = computeTokenUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      prompt_tokens_details: {
        cached_tokens: 20,
        cache_write_tokens: 30,
      },
      completion_tokens_details: {
        reasoning_tokens: 10,
      },
    });

    expect(result.inputTokens).toStrictEqual({
      total: 100,
      noCache: 80,
      cacheRead: 20,
      cacheWrite: 30,
    });
    expect(result.outputTokens).toStrictEqual({
      total: 50,
      text: 40,
      reasoning: 10,
    });
    expect(result.raw).toBeDefined();
  });

  it('should set noCache equal to total when no detail fields present', () => {
    const result = computeTokenUsage({
      prompt_tokens: 50,
      completion_tokens: 30,
    });

    expect(result.inputTokens).toStrictEqual({
      total: 50,
      noCache: 50,
      cacheRead: 0,
      cacheWrite: undefined,
    });
    expect(result.outputTokens).toStrictEqual({
      total: 30,
      text: 30,
      reasoning: 0,
    });
  });

  it('should handle null prompt_tokens_details', () => {
    const result = computeTokenUsage({
      prompt_tokens: 10,
      completion_tokens: 5,
      prompt_tokens_details: null,
      completion_tokens_details: null,
    });

    expect(result.inputTokens).toStrictEqual({
      total: 10,
      noCache: 10,
      cacheRead: 0,
      cacheWrite: undefined,
    });
    expect(result.outputTokens).toStrictEqual({
      total: 5,
      text: 5,
      reasoning: 0,
    });
  });

  it('should handle null cache_write_tokens vs undefined vs number', () => {
    const withNull = computeTokenUsage({
      prompt_tokens: 10,
      completion_tokens: 5,
      prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: null },
    });
    expect(withNull.inputTokens.cacheWrite).toBeUndefined();

    const withUndefined = computeTokenUsage({
      prompt_tokens: 10,
      completion_tokens: 5,
      prompt_tokens_details: {
        cached_tokens: 0,
        cache_write_tokens: undefined,
      },
    });
    expect(withUndefined.inputTokens.cacheWrite).toBeUndefined();

    const withNumber = computeTokenUsage({
      prompt_tokens: 10,
      completion_tokens: 5,
      prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 42 },
    });
    expect(withNumber.inputTokens.cacheWrite).toBe(42);
  });

  it('should handle zero token counts', () => {
    const result = computeTokenUsage({
      prompt_tokens: 0,
      completion_tokens: 0,
      prompt_tokens_details: { cached_tokens: 0 },
      completion_tokens_details: { reasoning_tokens: 0 },
    });

    expect(result.inputTokens).toStrictEqual({
      total: 0,
      noCache: 0,
      cacheRead: 0,
      cacheWrite: undefined,
    });
    expect(result.outputTokens).toStrictEqual({
      total: 0,
      text: 0,
      reasoning: 0,
    });
  });

  it('should handle missing prompt_tokens and completion_tokens', () => {
    const result = computeTokenUsage({});

    expect(result.inputTokens).toStrictEqual({
      total: 0,
      noCache: 0,
      cacheRead: 0,
      cacheWrite: undefined,
    });
    expect(result.outputTokens).toStrictEqual({
      total: 0,
      text: 0,
      reasoning: 0,
    });
  });

  it('should handle null prompt_tokens and completion_tokens', () => {
    const result = computeTokenUsage({
      prompt_tokens: null,
      completion_tokens: null,
    });

    expect(result.inputTokens.total).toBe(0);
    expect(result.outputTokens.total).toBe(0);
  });

  it('should preserve raw usage object', () => {
    const usage = {
      prompt_tokens: 10,
      completion_tokens: 5,
      total_tokens: 15,
      extra_field: 'preserved',
    };

    const result = computeTokenUsage(usage);
    expect(result.raw).toBeDefined();
    expect((result.raw as Record<string, unknown>).total_tokens).toBe(15);
    expect((result.raw as Record<string, unknown>).extra_field).toBe(
      'preserved',
    );
  });
});

describe('emptyUsage', () => {
  it('should return undefined for all detail fields', () => {
    const result = emptyUsage();

    expect(result.inputTokens).toStrictEqual({
      total: 0,
      noCache: undefined,
      cacheRead: undefined,
      cacheWrite: undefined,
    });
    expect(result.outputTokens).toStrictEqual({
      total: 0,
      text: undefined,
      reasoning: undefined,
    });
    expect(result.raw).toBeUndefined();
  });

  it('should return a new object each call', () => {
    const a = emptyUsage();
    const b = emptyUsage();
    expect(a).not.toBe(b);
    expect(a.inputTokens).not.toBe(b.inputTokens);
  });
});
