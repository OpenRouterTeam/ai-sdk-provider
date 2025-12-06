import { describe, expect, it } from 'vitest';
import { buildProviderMetadata, buildUsageMetadata } from '../build-provider-metadata';

describe('buildUsageMetadata', () => {
  it('returns undefined when usage is undefined', () => {
    expect(buildUsageMetadata(undefined)).toBeUndefined();
  });

  it('builds basic usage metadata', () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    };
    const result = buildUsageMetadata(usage);
    expect(result).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
  });

  it('includes token details when provided', () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      inputTokensDetails: {
        cachedTokens: 20,
      },
      outputTokensDetails: {
        reasoningTokens: 10,
      },
    };
    const result = buildUsageMetadata(usage);
    expect(result).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      promptTokensDetails: {
        cachedTokens: 20,
      },
      completionTokensDetails: {
        reasoningTokens: 10,
      },
    });
  });

  it('includes cost when provided', () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cost: 0.0015,
    };
    const result = buildUsageMetadata(usage);
    expect(result?.cost).toBe(0.0015);
  });

  it('excludes cost when null', () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      cost: null,
    };
    const result = buildUsageMetadata(usage);
    expect(result).not.toHaveProperty('cost');
  });

  it('includes isByok when provided', () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      isByok: true,
    };
    const result = buildUsageMetadata(usage);
    expect(result?.isByok).toBe(true);
  });

  it('includes costDetails and prunes undefined values', () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      costDetails: {
        input: 0.001,
        output: 0.0005,
        reasoning: undefined,
      },
    };
    const result = buildUsageMetadata(usage);
    expect(result?.costDetails).toEqual({
      input: 0.001,
      output: 0.0005,
    });
  });
});

describe('buildProviderMetadata', () => {
  it('extracts provider from modelId', () => {
    const result = buildProviderMetadata({
      modelId: 'anthropic/claude-3-opus',
    });
    expect(result.openrouter).toMatchObject({
      provider: 'anthropic',
      model_id: 'anthropic/claude-3-opus',
    });
  });

  it('uses "unknown" when modelId is undefined', () => {
    const result = buildProviderMetadata({
      modelId: undefined,
    });
    expect(result.openrouter).toMatchObject({
      provider: 'unknown',
    });
    expect(result.openrouter).not.toHaveProperty('model_id');
  });

  it('includes usage metadata when provided', () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
    };
    const result = buildProviderMetadata({
      modelId: 'openai/gpt-4',
      usage,
    });
    expect(result.openrouter).toHaveProperty('usage');
    expect((result.openrouter as Record<string, unknown>).usage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
  });

  it('includes reasoning_details from messageReasoningDetails', () => {
    const reasoningDetails = [
      {
        type: 'reasoning',
        content: 'thinking...',
      },
    ];
    const result = buildProviderMetadata({
      modelId: 'anthropic/claude-3-opus',
      messageReasoningDetails: reasoningDetails,
    });
    expect((result.openrouter as Record<string, unknown>).reasoning_details).toEqual(
      reasoningDetails,
    );
  });

  it('extracts reasoning_details from output when messageReasoningDetails is empty', () => {
    const output = [
      {
        type: 'message',
        reasoning_details: [
          {
            type: 'reasoning',
            content: 'from output',
          },
        ],
      },
    ];
    const result = buildProviderMetadata({
      modelId: 'anthropic/claude-3-opus',
      output,
      messageReasoningDetails: [],
    });
    expect((result.openrouter as Record<string, unknown>).reasoning_details).toEqual([
      {
        type: 'reasoning',
        content: 'from output',
      },
    ]);
  });

  it('prefers messageReasoningDetails over output extraction', () => {
    const messageReasoningDetails = [
      {
        type: 'reasoning',
        content: 'from message',
      },
    ];
    const output = [
      {
        type: 'message',
        reasoning_details: [
          {
            type: 'reasoning',
            content: 'from output',
          },
        ],
      },
    ];
    const result = buildProviderMetadata({
      modelId: 'anthropic/claude-3-opus',
      output,
      messageReasoningDetails,
    });
    expect((result.openrouter as Record<string, unknown>).reasoning_details).toEqual(
      messageReasoningDetails,
    );
  });

  it('does not include reasoning_details when not available', () => {
    const result = buildProviderMetadata({
      modelId: 'openai/gpt-4',
    });
    expect(result.openrouter).not.toHaveProperty('reasoning_details');
  });

  it('skips non-message output items when extracting reasoning_details', () => {
    const output = [
      {
        type: 'other',
        data: 'something',
      },
      {
        type: 'message',
        reasoning_details: [
          {
            type: 'reasoning',
            content: 'found it',
          },
        ],
      },
    ];
    const result = buildProviderMetadata({
      modelId: 'anthropic/claude-3-opus',
      output,
    });
    expect((result.openrouter as Record<string, unknown>).reasoning_details).toEqual([
      {
        type: 'reasoning',
        content: 'found it',
      },
    ]);
  });
});
