/**
 * Dreams Router payment configuration types
 */

export interface DreamsRouterPaymentConfig {
  /**
   * Private key for signing payment transactions
   */
  privateKey: `0x${string}`;

  /**
   * Payment amount in USDC (6 decimals). Defaults to 100000 ($0.10)
   */
  amount?: string;

  /**
   * Service wallet address to receive payments
   */
  serviceWallet?: string;

  /**
   * USDC contract address. Defaults to Base Sepolia USDC
   */
  usdcAddress?: string;

  /**
   * Network to use for payments. Defaults to 'base-sepolia'
   */
  network?: 'base-sepolia' | 'base' | 'avalanche-fuji' | 'avalanche' | 'iotex';

  /**
   * Payment validity duration in seconds. Defaults to 600 (10 minutes)
   */
  validityDuration?: number;
}
