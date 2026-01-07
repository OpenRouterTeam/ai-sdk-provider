import { describe, expect, it } from 'vitest';
import { mapOpenRouterFinishReason } from '../../chat/map-openrouter-finish-reason.js';

describe('mapOpenRouterFinishReason', () => {
  describe('stop reasons', () => {
    it('maps "end_turn" to "stop"', () => {
      const result = mapOpenRouterFinishReason('end_turn');
      expect(result).toEqual({ unified: 'stop', raw: 'end_turn' });
    });

    it('maps "stop" to "stop"', () => {
      const result = mapOpenRouterFinishReason('stop');
      expect(result).toEqual({ unified: 'stop', raw: 'stop' });
    });

    it('maps "stop_sequence" to "stop"', () => {
      const result = mapOpenRouterFinishReason('stop_sequence');
      expect(result).toEqual({ unified: 'stop', raw: 'stop_sequence' });
    });
  });

  describe('length reason', () => {
    it('maps "max_tokens" to "length"', () => {
      const result = mapOpenRouterFinishReason('max_tokens');
      expect(result).toEqual({ unified: 'length', raw: 'max_tokens' });
    });

    it('maps "length" to "length"', () => {
      const result = mapOpenRouterFinishReason('length');
      expect(result).toEqual({ unified: 'length', raw: 'length' });
    });
  });

  describe('tool-calls reason', () => {
    it('maps "tool_use" to "tool-calls"', () => {
      const result = mapOpenRouterFinishReason('tool_use');
      expect(result).toEqual({ unified: 'tool-calls', raw: 'tool_use' });
    });

    it('maps "tool_calls" to "tool-calls"', () => {
      const result = mapOpenRouterFinishReason('tool_calls');
      expect(result).toEqual({ unified: 'tool-calls', raw: 'tool_calls' });
    });
  });

  describe('content-filter reason', () => {
    it('maps "content_filter" to "content-filter"', () => {
      const result = mapOpenRouterFinishReason('content_filter');
      expect(result).toEqual({ unified: 'content-filter', raw: 'content_filter' });
    });
  });

  describe('error reason', () => {
    it('maps "error" to "error"', () => {
      const result = mapOpenRouterFinishReason('error');
      expect(result).toEqual({ unified: 'error', raw: 'error' });
    });
  });

  describe('unknown/null/undefined reasons', () => {
    it('maps null to "other" with undefined raw', () => {
      const result = mapOpenRouterFinishReason(null);
      expect(result).toEqual({ unified: 'other', raw: undefined });
    });

    it('maps undefined to "other" with undefined raw', () => {
      const result = mapOpenRouterFinishReason(undefined);
      expect(result).toEqual({ unified: 'other', raw: undefined });
    });

    it('maps unknown string to "other"', () => {
      const result = mapOpenRouterFinishReason('some_unknown_reason');
      expect(result).toEqual({ unified: 'other', raw: 'some_unknown_reason' });
    });

    it('maps empty string to "other"', () => {
      const result = mapOpenRouterFinishReason('');
      expect(result).toEqual({ unified: 'other', raw: '' });
    });
  });
});
