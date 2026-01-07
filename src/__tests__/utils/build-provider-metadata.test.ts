import { describe, it, expect } from 'vitest';
import {
  buildProviderMetadata,
  type OpenRouterResponseData,
  type OpenRouterProviderMetadata,
} from '../../utils/build-provider-metadata.js';

describe('buildProviderMetadata', () => {
  // Helper to extract typed metadata
  const getOpenRouterMetadata = (
    result: Record<string, unknown> | undefined
  ): OpenRouterProviderMetadata | undefined => {
    return result?.openrouter as OpenRouterProviderMetadata | undefined;
  };

  it('should extract responseId from response id', () => {
    const response: OpenRouterResponseData = {
      id: 'resp_123abc',
    };
    const result = buildProviderMetadata(response);
    const metadata = getOpenRouterMetadata(result);
    expect(metadata?.responseId).toBe('resp_123abc');
  });

  it('should extract provider from response', () => {
    const response: OpenRouterResponseData = {
      id: 'resp_123',
      provider: 'anthropic',
    };
    const result = buildProviderMetadata(response);
    const metadata = getOpenRouterMetadata(result);
    expect(metadata?.provider).toBe('anthropic');
  });

  it('should map usage.promptTokens from prompt_tokens', () => {
    const response: OpenRouterResponseData = {
      id: 'resp_123',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    };
    const result = buildProviderMetadata(response);
    const metadata = getOpenRouterMetadata(result);
    expect(metadata?.usage?.promptTokens).toBe(100);
  });

  it('should map usage.completionTokens from completion_tokens', () => {
    const response: OpenRouterResponseData = {
      id: 'resp_123',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    };
    const result = buildProviderMetadata(response);
    const metadata = getOpenRouterMetadata(result);
    expect(metadata?.usage?.completionTokens).toBe(50);
  });

  it('should map usage.totalTokens from total_tokens', () => {
    const response: OpenRouterResponseData = {
      id: 'resp_123',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    };
    const result = buildProviderMetadata(response);
    const metadata = getOpenRouterMetadata(result);
    expect(metadata?.usage?.totalTokens).toBe(150);
  });

  it('should map promptTokensDetails.cachedTokens from prompt_tokens_details', () => {
    const response: OpenRouterResponseData = {
      id: 'resp_123',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        prompt_tokens_details: {
          cached_tokens: 25,
        },
      },
    };
    const result = buildProviderMetadata(response);
    const metadata = getOpenRouterMetadata(result);
    expect(metadata?.usage?.promptTokensDetails?.cachedTokens).toBe(25);
  });

  it('should map completionTokensDetails.reasoningTokens from completion_tokens_details', () => {
    const response: OpenRouterResponseData = {
      id: 'resp_123',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        completion_tokens_details: {
          reasoning_tokens: 30,
        },
      },
    };
    const result = buildProviderMetadata(response);
    const metadata = getOpenRouterMetadata(result);
    expect(metadata?.usage?.completionTokensDetails?.reasoningTokens).toBe(30);
  });

  it('should include cost when available', () => {
    const response: OpenRouterResponseData = {
      id: 'resp_123',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        cost: 0.0015,
      },
    };
    const result = buildProviderMetadata(response);
    const metadata = getOpenRouterMetadata(result);
    expect(metadata?.usage?.cost).toBe(0.0015);
  });

  it('should omit cost when not available', () => {
    const response: OpenRouterResponseData = {
      id: 'resp_123',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    };
    const result = buildProviderMetadata(response);
    const metadata = getOpenRouterMetadata(result);
    expect(metadata?.usage?.cost).toBeUndefined();
  });

  it('should include isByok flag', () => {
    const response: OpenRouterResponseData = {
      id: 'resp_123',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        is_byok: true,
      },
    };
    const result = buildProviderMetadata(response);
    const metadata = getOpenRouterMetadata(result);
    expect(metadata?.usage?.isByok).toBe(true);
  });

  it('should include costDetails when available', () => {
    const response: OpenRouterResponseData = {
      id: 'resp_123',
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        cost_details: {
          input_cost: 0.001,
          output_cost: 0.0005,
        },
      },
    };
    const result = buildProviderMetadata(response);
    const metadata = getOpenRouterMetadata(result);
    expect(metadata?.usage?.costDetails).toEqual({
      input_cost: 0.001,
      output_cost: 0.0005,
    });
  });

  it('should return undefined for undefined response', () => {
    const result = buildProviderMetadata(undefined);
    expect(result).toBeUndefined();
  });

  it('should handle response with only id', () => {
    const response: OpenRouterResponseData = {
      id: 'resp_123',
    };
    const result = buildProviderMetadata(response);
    const metadata = getOpenRouterMetadata(result);
    expect(metadata?.responseId).toBe('resp_123');
    expect(metadata?.usage).toBeUndefined();
  });

  it('should handle empty response object', () => {
    const response: OpenRouterResponseData = {};
    const result = buildProviderMetadata(response);
    const metadata = getOpenRouterMetadata(result);
    // Should return metadata but with undefined fields
    expect(metadata).toBeDefined();
    expect(metadata?.responseId).toBeUndefined();
  });
});
