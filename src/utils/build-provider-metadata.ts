import type { JSONObject } from '@ai-sdk/provider';
import type { ChatGenerationTokenUsage } from '@openrouter/sdk/models';

/**
 * OpenRouter-specific provider metadata structure.
 */
export interface OpenRouterProviderMetadata {
  /**
   * The response ID from OpenRouter.
   */
  responseId?: string;

  /**
   * The upstream provider that served the request.
   */
  provider?: string;

  /**
   * Detailed usage information.
   */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    promptTokensDetails?: {
      cachedTokens?: number;
      cacheWriteTokens?: number;
      audioTokens?: number;
      videoTokens?: number;
    };
    completionTokensDetails?: {
      reasoningTokens?: number;
      imageTokens?: number;
    };
    /**
     * Cost in USD (omit if unavailable).
     */
    cost?: number;
    /**
     * Whether the request used BYOK (Bring Your Own Key).
     */
    isByok?: boolean;
    /**
     * Detailed cost breakdown.
     */
    costDetails?: JSONObject;
  };
}

/**
 * Extended prompt tokens details with fields not in SDK types.
 */
export interface ExtendedPromptTokensDetails {
  cachedTokens?: number | null;
  cacheWriteTokens?: number | null;
  audioTokens?: number | null;
  videoTokens?: number | null;
}

/**
 * Extended completion tokens details with fields not in SDK types.
 */
export interface ExtendedCompletionTokensDetails {
  reasoningTokens?: number | null;
  imageTokens?: number | null;
}

/**
 * Extended usage type with additional fields from raw OpenRouter API response.
 * The SDK types don't include cost/is_byok but the API returns them.
 */
export interface OpenRouterUsageExtended
  extends Omit<
    ChatGenerationTokenUsage,
    'promptTokensDetails' | 'completionTokensDetails'
  > {
  cost?: number;
  isByok?: boolean;
  costDetails?: JSONObject;
  promptTokensDetails?: ExtendedPromptTokensDetails | null;
  completionTokensDetails?: ExtendedCompletionTokensDetails | null;
}

/**
 * Response data from OpenRouter API used to build provider metadata.
 * Note: The SDK transforms snake_case to camelCase for all fields.
 * The `provider` field exists in raw API responses but isn't in SDK types.
 */
export interface OpenRouterResponseData {
  id?: string;
  /**
   * The upstream provider that served the request (e.g. "Google", "Anthropic").
   * This field exists in the raw API response but isn't in SDK TypeScript types.
   */
  provider?: string;
  /**
   * Usage data in camelCase (as transformed by SDK).
   */
  usage?: OpenRouterUsageExtended;
}

/**
 * Filters out undefined values from an object, returning only defined properties.
 * This ensures providerMetadata is valid JSON (undefined is not a valid JSON value).
 */
function filterUndefined<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined),
  ) as Partial<T>;
}

/**
 * Builds provider metadata from OpenRouter API response data.
 *
 * @param response - The response data from OpenRouter API (with camelCase fields from SDK).
 * @returns Provider metadata in the format expected by AI SDK.
 */
export function buildProviderMetadata(
  response: OpenRouterResponseData | undefined,
): Record<string, JSONObject> | undefined {
  if (!response) {
    return undefined;
  }

  const usage = response.usage;
  const usageMetadata: OpenRouterProviderMetadata['usage'] | undefined = usage
    ? filterUndefined({
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        ...(usage.promptTokensDetails && {
          promptTokensDetails: filterUndefined({
            cachedTokens: usage.promptTokensDetails.cachedTokens ?? undefined,
            cacheWriteTokens:
              usage.promptTokensDetails.cacheWriteTokens ?? undefined,
            audioTokens: usage.promptTokensDetails.audioTokens ?? undefined,
            videoTokens: usage.promptTokensDetails.videoTokens ?? undefined,
          }),
        }),
        ...(usage.completionTokensDetails && {
          completionTokensDetails: filterUndefined({
            reasoningTokens:
              usage.completionTokensDetails.reasoningTokens ?? undefined,
            imageTokens: usage.completionTokensDetails.imageTokens ?? undefined,
          }),
        }),
        cost: usage.cost,
        isByok: usage.isByok,
        costDetails: usage.costDetails,
      })
    : undefined;

  const metadata: OpenRouterProviderMetadata = filterUndefined({
    responseId: response.id,
    provider: response.provider,
    usage: usageMetadata,
  });

  return {
    openrouter: metadata as unknown as JSONObject,
  };
}
