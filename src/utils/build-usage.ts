import type { JSONObject, LanguageModelV3Usage } from '@ai-sdk/provider';

/**
 * Raw usage data from OpenRouter API response.
 */
export interface OpenRouterRawUsage {
  inputTokens?: number;
  outputTokens?: number;
  inputTokensDetails?: {
    cachedTokens?: number;
  };
  outputTokensDetails?: {
    reasoningTokens?: number;
  };
}

/**
 * Builds a LanguageModelV3Usage object from OpenRouter API usage data.
 *
 * @param usage - The raw usage data from the OpenRouter API response.
 * @returns A LanguageModelV3Usage object with standardized token counts.
 */
export function buildUsage(
  usage: OpenRouterRawUsage | undefined,
): LanguageModelV3Usage {
  if (!usage) {
    return {
      inputTokens: {
        total: 0,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 0,
        text: undefined,
        reasoning: undefined,
      },
      raw: undefined,
    };
  }

  // Convert to JSONObject-compatible format for raw field
  const rawUsage: JSONObject = {
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    ...(usage.inputTokensDetails && {
      inputTokensDetails: {
        cachedTokens: usage.inputTokensDetails.cachedTokens ?? null,
      },
    }),
    ...(usage.outputTokensDetails && {
      outputTokensDetails: {
        reasoningTokens: usage.outputTokensDetails.reasoningTokens ?? null,
      },
    }),
  };

  return {
    inputTokens: {
      total: usage.inputTokens ?? 0,
      noCache: undefined,
      cacheRead: usage.inputTokensDetails?.cachedTokens,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: usage.outputTokens ?? 0,
      text: undefined,
      reasoning: usage.outputTokensDetails?.reasoningTokens,
    },
    raw: rawUsage,
  };
}
