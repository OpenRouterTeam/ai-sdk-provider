/**
 * Helper functions for creating accounts easily
 */

import { privateKeyToAccount } from 'viem/accounts';
import { 
  createEVMAccount, 
  createSolanaAccount,
  type EVMAccount, 
  type SolanaAccount 
} from './unified-account-types';

/**
 * Create an EVM account from private key
 * @param privateKey - 0x prefixed hex private key
 * @returns EVMAccount ready for Dreams Router auth
 */
export function createEVMAccountFromPrivateKey(privateKey: `0x${string}`): EVMAccount {
  const account = privateKeyToAccount(privateKey);
  return createEVMAccount(account);
}

/**
 * Create a Solana account from public key
 * @param publicKey - Base58 encoded public key
 * @param signMessage - Optional signing function
 * @returns SolanaAccount ready for Dreams Router auth
 */
export function createSolanaAccountFromPublicKey(
  publicKey: string, 
  signMessage?: (message: { message: string }) => Promise<string>
): SolanaAccount {
  return createSolanaAccount(publicKey, signMessage);
}

/**
 * Auto-detect and create account from private key (EVM only now)
 * @param privateKey - Hex (0x...) private key
 * @returns EVM account type
 */
export function createAccountFromPrivateKey(
  privateKey: string
): EVMAccount {
  if (privateKey.startsWith('0x')) {
    // EVM private key
    return createEVMAccountFromPrivateKey(privateKey as `0x${string}`);
  } else {
    throw new Error('Only EVM private keys (0x...) are supported. Use createSolanaAccountFromPublicKey for Solana.');
  }
}

// Re-export for convenience
export { createEVMAccount, createSolanaAccount } from './unified-account-types';