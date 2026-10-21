import { describe, expect, it } from 'vitest';
import {
  createFinishReason,
  mapOpenRouterFinishReason,
} from './map-finish-reason';

describe('mapOpenRouterFinishReason', () => {
  it.each([
    ['stop', 'stop'],
    ['length', 'length'],
    ['content_filter', 'content-filter'],
    ['function_call', 'tool-calls'],
    ['tool_calls', 'tool-calls'],
  ] as const)('maps %s to %s', (raw, unified) => {
    expect(mapOpenRouterFinishReason(raw)).toEqual({ unified, raw });
  });

  it.each([undefined, null, 'unknown'])('maps %s to other', (raw) => {
    expect(mapOpenRouterFinishReason(raw)).toEqual({
      unified: 'other',
      raw: raw ?? undefined,
    });
  });
});

describe('createFinishReason', () => {
  it('creates a finish reason with an optional raw value', () => {
    expect(createFinishReason('length', 'max_tokens')).toEqual({
      unified: 'length',
      raw: 'max_tokens',
    });
  });
});
