/**
 * x402 Payment utilities for Dreams Router
 */

import type { Account } from 'viem';
import type { DreamsRouterPaymentConfig } from '../types';
import type { X402PaymentRequirements } from './x402-types';

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
  config: DreamsRouterPaymentConfig = {}
) {
  const usdcAddress = CONFIG.usdcAddress;
  const serviceWallet = CONFIG.serviceWallet;
  const amount = config.amount || CONFIG.amount;
  const requestedNetwork = config.network || CONFIG.network;
  const network: 'base' | 'base-sepolia' = (() => {
    if (requestedNetwork === 'base' || requestedNetwork === 'base-sepolia') {
      return requestedNetwork;
    }
    throw new Error(
      `Unsupported EVM network for x402: ${String(requestedNetwork)}`
    );
  })();
  const validityDuration = config.validityDuration || CONFIG.validityDuration;

  const now = Math.floor(Date.now() / 1000);

  const authorization = {
    from: address as `0x${string}`,
    to: serviceWallet as `0x${string}`,
    value: BigInt(amount),
    // Backdate window start to tolerate clock skew
    validAfter: BigInt(Math.max(0, now - 120)),
    validBefore: BigInt(now + validityDuration),
    nonce:
      '0x' +
      Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join(''),
  };

  const eip712Data = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
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
      name: network === 'base-sepolia' ? 'USDC' : 'USD Coin',
      version: '2',
      chainId: CONFIG.networks[network as keyof typeof CONFIG.networks],
      verifyingContract: usdcAddress as `0x${string}`,
    },
    primaryType: 'TransferWithAuthorization' as const,
    message: authorization,
  };

  return { eip712Data, authorization, network } as const;
}

/**
 * Generates X402 payment for browser/wagmi environments
 */
export async function generateX402PaymentBrowser(
  address: string,
  signTypedDataAsync: (data: any) => Promise<string>,
  config: DreamsRouterPaymentConfig = {}
): Promise<string | null> {
  try {
    const { eip712Data, authorization, network } = createX402PaymentData(
      address,
      config
    );

    const signature = await signTypedDataAsync(eip712Data);

    const signedPaymentHeader = {
      x402Version: 1,
      scheme: 'exact' as const,
      network,
      payload: {
        authorization: {
          from: authorization.from,
          to: authorization.to,
          value: authorization.value.toString(),
          validAfter: authorization.validAfter.toString(),
          validBefore: authorization.validBefore.toString(),
          nonce: authorization.nonce as `0x${string}`,
        },
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
          'Dreams Router x402 payments require viem. Install with: npm install viem'
        );
      }
      if (error.message.includes('x402')) {
        throw new Error(
          'Dreams Router x402 payments require x402. Install with: npm install x402'
        );
      }
    }

    return null;
  }
}

export async function generateX402Payment(
  account: Account,
  config: DreamsRouterPaymentConfig
): Promise<string | null> {
  try {
    const { eip712Data, authorization, network } = createX402PaymentData(
      account.address,
      config
    );

    // Use the account to sign the typed data
    if (!account.signTypedData) {
      throw new Error(
        'Account does not support typed data signing. Required for X402 payments.'
      );
    }
    const signature = await account.signTypedData(eip712Data as any);

    const signedPaymentHeader = {
      x402Version: 1,
      scheme: 'exact' as const,
      network,
      payload: {
        authorization: {
          from: authorization.from,
          to: authorization.to,
          value: authorization.value.toString(),
          validAfter: authorization.validAfter.toString(),
          validBefore: authorization.validBefore.toString(),
          nonce: authorization.nonce as `0x${string}`,
        },
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
          'Dreams Router x402 payments require viem. Install with: npm install viem'
        );
      }
      if (error.message.includes('x402')) {
        throw new Error(
          'Dreams Router x402 payments require x402. Install with: npm install x402'
        );
      }
    }

    return null;
  }
}

/**
 * Generate an EVM x402 payment header directly from server-provided requirements.
 */
export async function generateX402PaymentFromRequirement(
  account: Account,
  requirement: X402PaymentRequirements,
  config: Pick<DreamsRouterPaymentConfig, 'validityDuration'> = {}
): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const skew = 120; // 2 minutes
    const validityDuration = config.validityDuration || 600;

    const [chainId, evmNetwork] = (() => {
      switch (requirement.network) {
        case 'base':
          return [8453, 'base' as const];
        case 'base-sepolia':
          return [84532, 'base-sepolia' as const];
        default:
          throw new Error(
            `Unsupported EVM network for x402: ${requirement.network}`
          );
      }
    })();

    // Convert amount to atomic units (USDC has 6 decimals)
    const amountAtomic = (() => {
      const raw = requirement.maxAmountRequired;
      if (typeof raw === 'number') return Math.ceil(raw * 1_000_000).toString();
      if (typeof raw === 'string' && raw.includes('.')) {
        return Math.ceil(parseFloat(raw) * 1_000_000).toString();
      }
      return String(raw);
    })();

    const authorization = {
      from: account.address as `0x${string}`,
      to: requirement.payTo as `0x${string}`,
      value: BigInt(amountAtomic),
      validAfter: BigInt(Math.max(0, now - skew)),
      validBefore: BigInt(now + validityDuration),
      nonce: ('0x' +
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('')) as `0x${string}`,
    };

    const tokenName = (requirement as any)?.extra?.name || 'USD Coin';
    const tokenVersion = (requirement as any)?.extra?.version || '2';
    const eip712Data = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
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
        name: tokenName,
        version: tokenVersion,
        chainId,
        verifyingContract: requirement.asset as `0x${string}`,
      },
      primaryType: 'TransferWithAuthorization' as const,
      message: authorization,
    } as const;

    if (!account.signTypedData) {
      throw new Error(
        'Account does not support typed data signing. Required for X402 payments.'
      );
    }
    const signature = await account.signTypedData(eip712Data as any);

    const signedPaymentHeader = {
      x402Version: 1,
      scheme: 'exact' as const,
      network: evmNetwork,
      payload: {
        authorization: {
          from: authorization.from,
          to: authorization.to,
          value: authorization.value.toString(),
          validAfter: authorization.validAfter.toString(),
          validBefore: authorization.validBefore.toString(),
          nonce: authorization.nonce,
        },
        signature,
      },
    };

    const encodedPayment = exact.evm.encodePayment(signedPaymentHeader);
    return encodedPayment;
  } catch (error) {
    console.error('Failed to generate x402 payment from requirement:', error);
    return null;
  }
}

/**
 * Auto x402 provider - handles the complete flow automatically
 * 1. Makes initial request
 * 2. If 402 received, extracts payment requirements
 * 3. Creates x402 payment with provided account
 * 4. Retries request with x402 payment
 */
export async function autoX402Provider(
  account: Account,
  url: string,
  requestInit: RequestInit,
  config: Pick<DreamsRouterPaymentConfig, 'validityDuration'> = {}
): Promise<Response> {
  // 1. Make initial request to get payment requirements
  const initialResponse = await fetch(url, requestInit);

  // If not 402, return as-is
  if (initialResponse.status !== 402) {
    return initialResponse;
  }

  // 2. Extract payment requirements from 402 response
  const paymentRequiredHeader =
    initialResponse.headers.get('x-payment-required');
  if (!paymentRequiredHeader) {
    throw new Error('402 response missing x-payment-required header');
  }

  let requirement: X402PaymentRequirements;
  try {
    requirement = JSON.parse(paymentRequiredHeader);
  } catch (error) {
    throw new Error('Invalid x-payment-required header format');
  }

  // Check if it's Solana network (not supported by this function)
  if (requirement.network.startsWith('solana')) {
    throw new Error(
      `EVM account cannot pay on Solana network: ${requirement.network}`
    );
  }

  // 3. Generate x402 payment from requirements
  const x402Payment = await generateX402PaymentFromRequirement(
    account,
    requirement,
    config
  );

  if (!x402Payment) {
    throw new Error('Failed to generate x402 payment');
  }

  // 4. Retry request with x402 payment header
  const headers = new Headers(requestInit.headers);
  headers.set('x-payment', x402Payment);

  const retryResponse = await fetch(url, {
    ...requestInit,
    headers,
  });

  return retryResponse;
}

/**
 * Simple wrapper for chat completions with auto x402
 */
export async function chatCompletionsWithX402(
  account: Account,
  baseUrl: string,
  body: any,
  config: Pick<DreamsRouterPaymentConfig, 'validityDuration'> & {
    preferredNetwork?: 'base' | 'base-sepolia';
  } = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Set preferred network if specified
  if (config.preferredNetwork) {
    headers['x-payment-network'] = config.preferredNetwork;
  }

  return autoX402Provider(
    account,
    `${baseUrl}/v1/chat/completions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
    config
  );
}
