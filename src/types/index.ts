import type { LanguageModelV2, LanguageModelV2Prompt } from '@ai-sdk/provider';

export type { LanguageModelV2, LanguageModelV2Prompt };

// Export Dreams Router types
export type {
  DreamsRouterPaymentConfig,
  DreamsRouterAuthMethod,
  DreamsRouterAuthConfig,
} from './dreams-router-payment-config';

// SOL signer support
export type SolanaSigner = NodeSolanaSigner;

export interface NodeSolanaSigner {
  type: 'node';
  /** Base58-encoded 64-byte secret key */
  secretKeyBase58: string;
  /** Optional RPC endpoint override */
  rpcUrl?: string;
}

export type DreamsRouterProviderOptions = {
  models?: string[];

  /**
   * https://openrouter.ai/docs/use-cases/reasoning-tokens
   * One of `max_tokens` or `effort` is required.
   * If `exclude` is true, reasoning will be removed from the response. Default is false.
   */
  reasoning?: {
    enabled?: boolean;
    exclude?: boolean;
  } & (
    | {
        max_tokens: number;
      }
    | {
        effort: 'high' | 'medium' | 'low';
      }
  );

  /**
   * A unique identifier representing your end-user, which can
   * help OpenRouter to monitor and detect abuse.
   */
  user?: string;
};

export type OpenRouterSharedSettings = DreamsRouterProviderOptions & {
  /**
   * @deprecated use `reasoning` instead
   */
  includeReasoning?: boolean;

  extraBody?: Record<string, unknown>;

  /**
   * Enable usage accounting to get detailed token usage information.
   * https://openrouter.ai/docs/use-cases/usage-accounting
   */
  usage?: {
    /**
     * When true, includes token usage information in the response.
     */
    include: boolean;
  };
};

/**
 * Usage accounting response
 * @see https://openrouter.ai/docs/use-cases/usage-accounting
 */
export type OpenRouterUsageAccounting = {
  promptTokens: number;
  // TODO: Router doesn't track cached tokens yet
  // promptTokensDetails?: {
  //   cachedTokens: number;
  // };
  completionTokens: number;
  // TODO: Router doesn't separate reasoning tokens in response yet
  // completionTokensDetails?: {
  //   reasoningTokens: number;
  // };
  totalTokens: number;
  cost?: number;
  // TODO: Router doesn't provide upstream cost breakdown yet
  // costDetails: {
  //   upstreamInferenceCost: number;
  // };
};
