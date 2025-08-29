/**
 * Dreams Router payment configuration types
 */

/**
 * Simplified payment configuration - amounts and addresses auto-fetched from router
 */
export interface DreamsRouterPaymentConfig {
  /**
   * Preferred network for payments. If not specified, router will choose based on signer availability.
   * The router will return requirements for the appropriate network.
   */
  network?:
    | 'base-sepolia'
    | 'base'
    | 'avalanche-fuji'
    | 'avalanche'
    | 'iotex'
    | 'solana'
    | 'solana-devnet';

  /**
   * Payment validity duration in seconds. Defaults to 600 (10 minutes)
   */
  validityDuration?: number;

  /**
   * Autopay mode. When 'lazy' (default), the SDK performs a 402 handshake,
   * generates a payment for the required amount, and retries once automatically.
   * When 'eager', the SDK will attempt to pre-attach a payment on first attempt
   * if a fresh cached requirement is available.
   */
  mode?: 'lazy' | 'eager';

  /**
   * Optional RPC endpoint override for SOL networks.
   */
  rpcUrl?: string;

  // Legacy fields for backwards compatibility - will be ignored in favor of router requirements
  /** @deprecated Use network preference instead. Amount is determined by router. */
  amount?: string;
}

/**
 * Dreams Router authentication method types
 */
export type DreamsRouterAuthMethod = 'api-key' | 'session-token';

export interface DreamsRouterAuthConfig {
  method: DreamsRouterAuthMethod;
  apiKey?: string;
  sessionToken?: string;
}
