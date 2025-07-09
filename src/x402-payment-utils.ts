/**
 * x402 Payment utilities for Dreams Router
 */

import type { Account } from 'viem';
import type { DreamsRouterPaymentConfig } from './types';

import { exact } from 'x402/schemes';

const CONFIG = {
  usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  serviceWallet: '0xb308ed39d67D0d4BAe5BC2FAEF60c66BBb6AE429',
  amount: '100000',
  network: 'base-sepolia' as const,
  validityDuration: 600,
  networks: {
    'base-sepolia': 84532,
    base: 8453,
  },
};

/**
 * Creates EIP-712 typed data for X402 payment (no signing)
 */
export function createX402PaymentData(
  address: string,
  config: DreamsRouterPaymentConfig = {},
) {
  const usdcAddress = config.usdcAddress || CONFIG.usdcAddress;
  const serviceWallet = config.serviceWallet || CONFIG.serviceWallet;
  const amount = config.amount || CONFIG.amount;
  const network = config.network || CONFIG.network;
  const validityDuration = config.validityDuration || CONFIG.validityDuration;

  const now = Math.floor(Date.now() / 1000);
  const authorization = {
    from: address as `0x${string}`,
    to: serviceWallet as `0x${string}`,
    value: amount,
    validAfter: now.toString(),
    validBefore: (now + validityDuration).toString(),
    nonce:
      '0x' +
      Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join(''),
  };

  const eip712Data = {
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    domain: {
      name: 'USDC',
      version: '2',
      chainId: CONFIG.networks[network as keyof typeof CONFIG.networks],
      verifyingContract: usdcAddress as `0x${string}`,
    },
    primaryType: 'TransferWithAuthorization' as const,
    message: authorization,
  };

  return { eip712Data, authorization, network };
}

/**
 * Generates X402 payment for browser/wagmi environments
 */
export async function generateX402PaymentBrowser(
  address: string,
  signTypedDataAsync: (data: any) => Promise<string>,
  config: DreamsRouterPaymentConfig = {},
): Promise<string | null> {
  try {
    const { eip712Data, authorization, network } = createX402PaymentData(
      address,
      config,
    );

    const signature = await signTypedDataAsync(eip712Data);

    const signedPaymentHeader = {
      x402Version: 1,
      scheme: 'exact' as const,
      network: network,
      payload: {
        authorization,
        signature,
      },
    };

    const encodedPayment = exact.evm.encodePayment(signedPaymentHeader);
    return encodedPayment;
  } catch (error) {
    console.error('Failed to generate x402 payment:', error);

    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('viem')) {
        throw new Error(
          'Dreams Router x402 payments require viem. Install with: npm install viem',
        );
      }
      if (error.message.includes('x402')) {
        throw new Error(
          'Dreams Router x402 payments require x402. Install with: npm install x402',
        );
      }
    }

    return null;
  }
}

export async function generateX402Payment(
  account: Account,
  config: DreamsRouterPaymentConfig,
): Promise<string | null> {
  try {
    const { eip712Data, authorization, network } = createX402PaymentData(
      account.address,
      config,
    );

    // Use the account to sign the typed data
    if (!account.signTypedData) {
      throw new Error(
        'Account does not support typed data signing. Required for X402 payments.',
      );
    }
    const signature = await account.signTypedData(eip712Data);

    const signedPaymentHeader = {
      x402Version: 1,
      scheme: 'exact' as const,
      network: network,
      payload: {
        authorization,
        signature,
      },
    };

    const encodedPayment = exact.evm.encodePayment(signedPaymentHeader);
    return encodedPayment;
  } catch (error) {
    console.error('Failed to generate x402 payment:', error);

    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('viem')) {
        throw new Error(
          'Dreams Router x402 payments require viem. Install with: npm install viem',
        );
      }
      if (error.message.includes('x402')) {
        throw new Error(
          'Dreams Router x402 payments require x402. Install with: npm install x402',
        );
      }
    }

    return null;
  }
}
