import type { OpenRouterUsageAccounting } from '../types';

/**
 * Normalizes raw OpenRouter usage data to the SDK's usage accounting format.
 *
 * Implements the "Raw-First Spread" pattern:
 * 1. Spread raw server data (preserves unknown fields - the "sidecar")
 * 2. Overlay strict SDK fields on top (maintains contract)
 *
 * Default value strategy:
 * - Token counts: fallback to 0 (safe - undefined → 0 is acceptable)
 * - Cost/price data: NaN "Poison Pill" (dangerous - miscalculating money must be explicit)
 *
 * @param rawUsage - Raw usage object from OpenRouter API response
 * @returns Normalized usage object conforming to OpenRouterUsageAccounting
 */
export function normalizeOpenRouterUsage(
  rawUsage: unknown,
): OpenRouterUsageAccounting {
  if (!rawUsage || typeof rawUsage !== 'object') {
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }

  const usage = rawUsage as Record<string, unknown>;

  // Extract token values with 0 fallback (safe for token counts)
  const promptTokens =
    typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
  const completionTokens =
    typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0;

  // Calculate totalTokens: use server value if present, else sum
  const totalTokens =
    typeof usage.total_tokens === 'number'
      ? usage.total_tokens
      : promptTokens + completionTokens;

  return {
    // Raw sidecar: spread to preserve unknown server fields
    ...usage,

    // Normalized SDK contract fields (0 fallback for token counts)
    promptTokens,
    completionTokens,
    totalTokens,

    // Only include cost if defined (omission is better than 0 for optional cost field)
    ...(typeof usage.cost === 'number' ? { cost: usage.cost } : {}),

    // Nested details with camelCase mapping
    // Token detail fields: 0 fallback (safe)
    // Cost detail fields: NaN fallback (poison pill for money)
    ...(isPromptTokensDetails(usage.prompt_tokens_details)
      ? {
          promptTokensDetails: {
            ...usage.prompt_tokens_details,
            cachedTokens:
              typeof usage.prompt_tokens_details.cached_tokens === 'number'
                ? usage.prompt_tokens_details.cached_tokens
                : 0,
          },
        }
      : {}),
    ...(isCompletionTokensDetails(usage.completion_tokens_details)
      ? {
          completionTokensDetails: {
            ...usage.completion_tokens_details,
            reasoningTokens:
              typeof usage.completion_tokens_details.reasoning_tokens ===
              'number'
                ? usage.completion_tokens_details.reasoning_tokens
                : 0,
          },
        }
      : {}),
    ...(isCostDetails(usage.cost_details)
      ? {
          costDetails: {
            ...usage.cost_details,
            // NaN poison pill for cost - miscalculating money is dangerous
            upstreamInferenceCost:
              typeof usage.cost_details.upstream_inference_cost === 'number'
                ? usage.cost_details.upstream_inference_cost
                : Number.NaN,
          },
        }
      : {}),
  };
}

// Type guards for nested details objects
function isPromptTokensDetails(
  value: unknown,
): value is Record<string, unknown> & { cached_tokens?: number } {
  return value != null && typeof value === 'object';
}

function isCompletionTokensDetails(
  value: unknown,
): value is Record<string, unknown> & { reasoning_tokens?: number } {
  return value != null && typeof value === 'object';
}

function isCostDetails(
  value: unknown,
): value is Record<string, unknown> & { upstream_inference_cost?: number } {
  return value != null && typeof value === 'object';
}
