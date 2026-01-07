import { describe, it, expect } from 'vitest';
import { parseOpenRouterOptions } from '../../utils/parse-provider-options.js';
import type { OpenRouterModelOptions } from '../../openrouter-config.js';

describe('parseOpenRouterOptions', () => {
  it('should return model options when no call options provided', () => {
    const modelOptions: OpenRouterModelOptions = {
      route: 'fallback',
      transforms: ['middle-out'],
    };
    const result = parseOpenRouterOptions(modelOptions, undefined);
    expect(result.options).toEqual({
      route: 'fallback',
      transforms: ['middle-out'],
    });
    expect(result.warnings).toEqual([]);
  });

  it('should return call options when no model options provided', () => {
    const callOptions = {
      route: 'fallback',
      transforms: ['middle-out'],
    };
    const result = parseOpenRouterOptions(undefined, callOptions);
    expect(result.options.route).toBe('fallback');
    expect(result.options.transforms).toEqual(['middle-out']);
    expect(result.warnings).toEqual([]);
  });

  it('should merge model and call options', () => {
    const modelOptions: OpenRouterModelOptions = {
      route: 'fallback',
      transforms: ['middle-out'],
    };
    const callOptions = {
      models: ['gpt-4', 'claude-3'],
    };
    const result = parseOpenRouterOptions(modelOptions, callOptions);
    expect(result.options.route).toBe('fallback');
    expect(result.options.transforms).toEqual(['middle-out']);
    expect(result.options.models).toEqual(['gpt-4', 'claude-3']);
  });

  it('should let call options override model options', () => {
    const modelOptions: OpenRouterModelOptions = {
      route: 'fallback',
      transforms: ['middle-out'],
    };
    const callOptions = {
      route: 'direct',
      transforms: ['compress'],
    };
    const result = parseOpenRouterOptions(modelOptions, callOptions);
    expect(result.options.route).toBe('direct');
    expect(result.options.transforms).toEqual(['compress']);
  });

  it('should handle empty model options', () => {
    const result = parseOpenRouterOptions({}, { route: 'fallback' });
    expect(result.options.route).toBe('fallback');
    expect(result.warnings).toEqual([]);
  });

  it('should handle empty call options', () => {
    const modelOptions: OpenRouterModelOptions = {
      route: 'fallback',
    };
    const result = parseOpenRouterOptions(modelOptions, {});
    expect(result.options.route).toBe('fallback');
    expect(result.warnings).toEqual([]);
  });

  it('should handle both undefined', () => {
    const result = parseOpenRouterOptions(undefined, undefined);
    expect(result.options).toEqual({});
    expect(result.warnings).toEqual([]);
  });

  it('should pass through unknown keys without warning', () => {
    const modelOptions: OpenRouterModelOptions = {
      route: 'fallback',
    };
    const callOptions = {
      customField: 'custom-value',
      anotherCustom: 123,
    };
    const result = parseOpenRouterOptions(modelOptions, callOptions);
    // Unknown keys pass through (per design spec)
    expect(result.options.customField).toBe('custom-value');
    expect(result.options.anotherCustom).toBe(123);
    // No warnings for unknown keys passing through
    expect(result.warnings).toEqual([]);
  });

  it('should handle nested provider config', () => {
    const modelOptions: OpenRouterModelOptions = {
      provider: {
        order: ['anthropic'],
        allowFallbacks: false,
      },
    };
    const callOptions = {
      provider: {
        order: ['openai', 'anthropic'],
        allowFallbacks: true,
      },
    };
    const result = parseOpenRouterOptions(modelOptions, callOptions);
    // Shallow merge means provider is replaced entirely
    expect(result.options.provider).toEqual({
      order: ['openai', 'anthropic'],
      allowFallbacks: true,
    });
  });

  it('should handle plugins array', () => {
    const modelOptions: OpenRouterModelOptions = {
      plugins: [{ id: 'plugin-a' }],
    };
    const callOptions = {
      plugins: [{ id: 'plugin-b' }],
    };
    const result = parseOpenRouterOptions(modelOptions, callOptions);
    // Shallow merge replaces array
    expect(result.options.plugins).toEqual([{ id: 'plugin-b' }]);
  });

  it('should handle usage config', () => {
    const modelOptions: OpenRouterModelOptions = {
      usage: { include: false },
    };
    const callOptions = {
      usage: { include: true },
    };
    const result = parseOpenRouterOptions(modelOptions, callOptions);
    expect(result.options.usage).toEqual({ include: true });
  });

  it('should handle systemMessageMode', () => {
    const modelOptions: OpenRouterModelOptions = {
      systemMessageMode: 'system',
    };
    const callOptions = {
      systemMessageMode: 'developer',
    };
    const result = parseOpenRouterOptions(modelOptions, callOptions);
    expect(result.options.systemMessageMode).toBe('developer');
  });
});
