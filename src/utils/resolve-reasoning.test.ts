import { describe, expect, it } from 'vitest';
import { resolveReasoning } from './resolve-reasoning';

describe('resolveReasoning', () => {
  it.each([
    undefined,
    'provider-default',
  ] as const)('returns undefined for %s without model settings', (reasoning) => {
    expect(
      resolveReasoning({
        reasoning,
        settingsReasoning: undefined,
        providerOptions: undefined,
      }),
    ).toBeUndefined();
  });

  it.each([
    undefined,
    'provider-default',
  ] as const)('falls back to model settings for %s', (reasoning) => {
    expect(
      resolveReasoning({
        reasoning,
        settingsReasoning: { effort: 'high', exclude: true },
        providerOptions: undefined,
      }),
    ).toEqual({ effort: 'high', exclude: true });
  });

  it.each([
    'none',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
  ] as const)('maps %s to reasoning.effort', (reasoning) => {
    expect(
      resolveReasoning({
        reasoning,
        settingsReasoning: undefined,
        providerOptions: undefined,
      }),
    ).toEqual({ effort: reasoning });
  });

  it('overrides the model-level effort but keeps enabled/exclude', () => {
    expect(
      resolveReasoning({
        reasoning: 'medium',
        settingsReasoning: { enabled: true, exclude: true, effort: 'high' },
        providerOptions: undefined,
      }),
    ).toEqual({ enabled: true, exclude: true, effort: 'medium' });
  });

  it('replaces model-level max_tokens with the call-level effort', () => {
    expect(
      resolveReasoning({
        reasoning: 'low',
        settingsReasoning: { max_tokens: 1000, exclude: true },
        providerOptions: undefined,
      }),
    ).toEqual({ exclude: true, effort: 'low' });
  });

  it('still maps call-level reasoning when providerOptions sets reasoning (the later spread overrides it)', () => {
    expect(
      resolveReasoning({
        reasoning: 'medium',
        settingsReasoning: { effort: 'high' },
        providerOptions: { openrouter: { reasoning: { effort: 'low' } } },
      }),
    ).toEqual({ effort: 'medium' });
  });

  it('ignores call-level reasoning but keeps model settings when providerOptions sets reasoning_effort', () => {
    expect(
      resolveReasoning({
        reasoning: 'medium',
        settingsReasoning: { effort: 'high', exclude: true },
        providerOptions: { openrouter: { reasoning_effort: 'low' } },
      }),
    ).toEqual({ effort: 'high', exclude: true });
  });

  it.each([
    'first',
    'second',
  ] as const)('ignores call-level reasoning when the %s extraBody sets reasoning_effort', (position) => {
    const extraBody = { reasoning_effort: 'low' };
    expect(
      resolveReasoning({
        reasoning: 'high',
        settingsReasoning: { max_tokens: 1000, exclude: true },
        providerOptions: undefined,
        extraBodies:
          position === 'first' ? [extraBody, undefined] : [{}, extraBody],
      }),
    ).toStrictEqual({ max_tokens: 1000, exclude: true });
  });

  it('does not emit undefined enabled/exclude keys', () => {
    expect(
      resolveReasoning({
        reasoning: 'high',
        settingsReasoning: { max_tokens: 100 },
        providerOptions: undefined,
      }),
    ).toStrictEqual({ effort: 'high' });
  });

  it('returns undefined when providerOptions sets reasoning_effort and there are no model settings', () => {
    expect(
      resolveReasoning({
        reasoning: 'medium',
        settingsReasoning: undefined,
        providerOptions: { openrouter: { reasoning_effort: 'low' } },
      }),
    ).toBeUndefined();
  });
});
