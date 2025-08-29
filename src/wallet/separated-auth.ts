/**
 * Separated authentication functions for Dreams Router
 * Clean separation of concerns: createEVMAuth() and createSolanaAuth()
 * Internal plumbing remains generic
 */

import type { Account } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { User } from './dreams-router-api-client.js';
import type { DreamsRouterPaymentConfig } from '../types';
import { createDreamsRouter } from '../provider';
import { createSolanaAccount } from './unified-account-types';

import {
  createUnifiedAuthManager,
  type UnifiedAuthOptions,
} from './unified-wallet-auth';

// Common auth result interface
export interface AuthResult {
  sessionToken: string;
  user: User;
  dreamsRouter: ReturnType<typeof createDreamsRouter>;
  authManager: ReturnType<typeof createUnifiedAuthManager>;
}

// EVM-specific options
export interface EVMAuthOptions extends UnifiedAuthOptions {
  payments?: DreamsRouterPaymentConfig & {
    network?:
      | 'base-sepolia'
      | 'base'
      | 'avalanche-fuji'
      | 'avalanche'
      | 'iotex';
  };
}

// Solana-specific options
export interface SolanaAuthOptions extends UnifiedAuthOptions {
  payments?: DreamsRouterPaymentConfig & {
    network?: 'solana' | 'solana-devnet';
    rpcUrl?: string;
  };
}

/**
 * Create Dreams Router authentication for EVM accounts
 * Works with any EVM-compatible chain (Ethereum, Base, etc.)
 */
export async function createEVMAuth(
  account: Account,
  options: EVMAuthOptions = {}
): Promise<AuthResult> {
  const authManager = createUnifiedAuthManager(options);

  // Authenticate using generic manager (pass original account)
  const { sessionToken, user } = await authManager.login(account);

  // Set default network for EVM if not specified
  const payments = options.payments || {};
  if (!payments.network) {
    payments.network = 'base-sepolia' as const;
  }

  // Create Dreams Router provider
  const dreamsRouter = authManager.createDreamsRouter({
    payments,
    baseURL: options.baseURL,
  });

  return {
    sessionToken,
    user,
    dreamsRouter,
    authManager,
  };
}

/**
 * Create Dreams Router authentication for Solana accounts
 * Works with mainnet and devnet
 */
export async function createSolanaAuth(
  publicKey: string,
  signMessage: (message: { message: string }) => Promise<string>,
  options: SolanaAuthOptions = {}
): Promise<AuthResult> {
  const authManager = createUnifiedAuthManager(options);

  // Create Solana account
  const solanaAccount = createSolanaAccount(publicKey, signMessage);

  // Authenticate using generic manager
  const { sessionToken, user } = await authManager.login(solanaAccount);

  // Set default network for Solana if not specified
  const payments = options.payments || {};
  if (!payments.network) {
    payments.network = 'solana-devnet' as const;
  }

  // Create Dreams Router provider
  const dreamsRouter = authManager.createDreamsRouter({
    payments,
    baseURL: options.baseURL,
  });

  return {
    sessionToken,
    user,
    dreamsRouter,
    authManager,
  };
}

/**
 * Helper: Create EVM auth from private key string
 */
export async function createEVMAuthFromPrivateKey(
  privateKey: `0x${string}`,
  options: EVMAuthOptions = {}
): Promise<AuthResult> {
  const account = privateKeyToAccount(privateKey);
  return createEVMAuth(account, options);
}

/**
 * Helper: Create Solana auth from public key
 */
export async function createSolanaAuthFromPublicKey(
  publicKey: string,
  signMessage: (message: { message: string }) => Promise<string>,
  options: SolanaAuthOptions = {}
): Promise<AuthResult> {
  return createSolanaAuth(publicKey, signMessage, options);
}
