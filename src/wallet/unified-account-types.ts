/**
 * Unified account types for Dreams Router
 * Supports both EVM (viem Account) and Solana signers
 */

import type { Account } from 'viem';

// Solana account interface (similar to viem's Account)
export interface SolanaAccount {
  /** Account type identifier */
  type: 'solana';
  /** Solana public key (base58) */
  publicKey: string;
  /** Sign a message */
  signMessage?: (message: { message: string }) => Promise<string>;
  /** Sign a transaction */
  signTransaction?: (transaction: any) => Promise<any>;
  /** Optional RPC URL for Solana */
  rpcUrl?: string;
}

// Remove NodeSolanaAccount - no longer needed

// EVM Account wrapper to add type identification
export interface EVMAccount {
  type: 'evm';
  address: `0x${string}`;
  signMessage?: (message: { message: string }) => Promise<`0x${string}`>;
  signTransaction?: (transaction: any) => Promise<any>;
  signTypedData?: (typedData: any) => Promise<`0x${string}`>;
  // Include other essential Account properties
  [key: string]: any;
}

// Unified account type
export type UnifiedAccount = EVMAccount | SolanaAccount;

/**
 * Type guard to check if account is EVM
 */
export function isEVMAccount(account: UnifiedAccount): account is EVMAccount {
  return account.type === 'evm' || 'address' in account;
}

/**
 * Type guard to check if account is Solana
 */
export function isSolanaAccount(
  account: UnifiedAccount
): account is SolanaAccount {
  return account.type === 'solana' || 'publicKey' in account;
}

// Remove isNodeSolanaAccount - no longer needed

/**
 * Create an EVM account wrapper
 */
export function createEVMAccount(account: Account): EVMAccount {
  return {
    ...account,
    type: 'evm' as const, // Ensure type is overridden
    address: account.address,
    signMessage: account.signMessage,
    signTransaction: account.signTransaction,
    signTypedData: account.signTypedData,
  };
}

/**
 * Create a Solana account for browser environments
 */
export function createSolanaAccount(
  publicKey: string,
  signMessage?: (message: { message: string }) => Promise<string>
): SolanaAccount {
  return {
    type: 'solana',
    publicKey,
    signMessage,
  };
}

// Remove createNodeSolanaAccount - no longer needed for backwards compatibility

/**
 * Auto-detect account type and wrap if needed
 */
export function wrapAccount(
  account: Account | SolanaAccount | UnifiedAccount
): UnifiedAccount {
  // Check if it's a viem Account (has address)
  if ('address' in account) {
    return createEVMAccount(account as Account);
  }

  // Check if it's a Solana account (has publicKey)
  if ('publicKey' in account) {
    return account as SolanaAccount;
  }

  throw new Error(
    'Unable to determine account type. Account must be either EVM (viem Account) or Solana account.'
  );
}

/**
 * Get account identifier (address for EVM, publicKey for Solana)
 */
export function getAccountIdentifier(account: UnifiedAccount): string {
  if (isEVMAccount(account)) {
    return account.address;
  } else if (isSolanaAccount(account)) {
    return account.publicKey;
  }
  throw new Error('Unknown account type');
}

/**
 * Get preferred network based on account type
 */
export function getPreferredNetwork(account: UnifiedAccount): string {
  if (isEVMAccount(account)) {
    return 'base-sepolia'; // Default EVM network
  } else if (isSolanaAccount(account)) {
    return 'solana-devnet'; // Default Solana network
  }
  throw new Error('Unknown account type');
}
