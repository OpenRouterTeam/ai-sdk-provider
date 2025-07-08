/**
 * x402 Payment utilities for Dreams Router
 */

import type { DreamsRouterPaymentConfig } from './types';

import {
  privateKeyToAddress,
  signMessage,
  signTransaction,
  signTypedData,
  toAccount,
} from 'viem/accounts';
import { exact } from 'x402/schemes';
import { getNetworkId } from 'x402/shared';

export async function generateX402Payment(
  config: DreamsRouterPaymentConfig,
): Promise<string | null> {
  try {
    const address = privateKeyToAddress(config.privateKey);

    // Set defaults
    const usdcAddress =
      config.usdcAddress || '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; // Base Sepolia USDC
    const serviceWallet =
      config.serviceWallet || '0xb308ed39d67D0d4BAe5BC2FAEF60c66BBb6AE429';
    const amount = config.amount || '100000'; // $0.10 USDC
    const network = config.network || 'base-sepolia';
    const validityDuration = config.validityDuration || 600; // 10 minutes

    const now = Math.floor(Date.now() / 1000);
    const authorization = {
      from: address,
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
        chainId: getNetworkId(network),
        verifyingContract: usdcAddress as `0x${string}`,
      },
      primaryType: 'TransferWithAuthorization' as const,
      message: authorization,
    };

    // Create account with proper signTypedData implementation
    const account = toAccount({
      address: address as `0x${string}`,
      async signMessage({ message }) {
        return signMessage({ message, privateKey: config.privateKey });
      },
      async signTransaction(transaction, options) {
        return signTransaction({
          privateKey: config.privateKey,
          transaction,
          serializer: options?.serializer,
        });
      },
      async signTypedData(typedData) {
        return signTypedData({ ...typedData, privateKey: config.privateKey });
      },
    });

    const signature = await account.signTypedData(eip712Data);

    const signedPaymentHeader = {
      x402Version: 1,
      scheme: 'exact' as const,
      network: network as
        | 'base-sepolia'
        | 'base'
        | 'avalanche-fuji'
        | 'avalanche'
        | 'iotex',
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
