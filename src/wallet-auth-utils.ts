/**
 * Wallet authentication utilities for Dreams Router
 * Combines API client with AI SDK for seamless wallet authentication
 */

import type { Account } from 'viem';
import type { DreamsRouterPaymentConfig } from './types';

import { DreamsRouterApiClient } from './dreams-router-api-client';
import { createDreamsRouter } from './openrouter-provider';
import { generateX402Payment } from './x402-payment-utils';

export interface WalletAuthManager {
  apiClient: DreamsRouterApiClient;
  currentSessionToken: string | null;
  currentUser: any | null;
  currentAccount: Account | null;

  /**
   * Sign message and get JWT session token using an account
   */
  walletLogin(account: Account): Promise<{ sessionToken: string; user: any }>;

  /**
   * Get API key using x402 payment generated from account
   */
  getApiKeyWithPayment(
    account: Account,
    paymentConfig?: DreamsRouterPaymentConfig,
  ): Promise<{ apiKey: string; user: any }>;

  /**
   * Create Dreams Router provider with current authentication and optional payments
   */
  createDreamsRouter(options?: {
    payments?: DreamsRouterPaymentConfig;
  }): ReturnType<typeof createDreamsRouter>;

  /**
   * Get current user profile
   */
  getProfile(): Promise<any>;

  /**
   * Get wallet balance
   */
  getBalance(address: string): Promise<number>;

  /**
   * Logout and clear tokens
   */
  logout(): void;
}

export interface WalletAuthManagerOptions {
  baseURL?: string;
  onTokenExpired?: () => Promise<string | null>;
}

export function createWalletAuthManager(
  options: WalletAuthManagerOptions = {},
): WalletAuthManager {
  const apiClient = new DreamsRouterApiClient({
    baseURL: options.baseURL,
  });

  let currentSessionToken: string | null = null;
  let currentUser: any | null = null;
  let currentAccount: Account | null = null;

  // Set up token expiration callback
  if (options.onTokenExpired) {
    apiClient.setTokenExpiredCallback(options.onTokenExpired);
  }

  return {
    apiClient,
    currentSessionToken,
    currentUser,
    currentAccount,

    async walletLogin(account: Account) {
      const timestamp = Date.now();
      const message = `Sign this message to authenticate with Dreams Router\n\nWallet: ${account.address}\nTimestamp: ${timestamp}`;

      if (!account.signMessage) {
        throw new Error(
          'Account does not support message signing. Required for authentication.',
        );
      }
      const signature = await account.signMessage({ message });

      const response = await apiClient.walletLogin(
        account.address,
        signature,
        message,
      );

      if (response.success && response.session_token && response.user) {
        currentSessionToken = response.session_token;
        currentUser = response.user;
        currentAccount = account;
        apiClient.setSessionToken(response.session_token);

        return {
          sessionToken: response.session_token,
          user: response.user,
        };
      } else {
        throw new Error(response.error || 'Failed to login with wallet');
      }
    },

    async getApiKeyWithPayment(
      account: Account,
      paymentConfig: DreamsRouterPaymentConfig = {},
    ) {
      const x402Payment = await generateX402Payment(account, paymentConfig);

      if (!x402Payment) {
        throw new Error('Failed to generate x402 payment');
      }

      const response = await apiClient.authenticateWithWallet(x402Payment);

      if (response.success && response.api_key && response.user) {
        apiClient.setApiKey(response.api_key);
        currentUser = response.user;
        currentAccount = account;

        return {
          apiKey: response.api_key,
          user: response.user,
        };
      } else {
        throw new Error(response.error || 'Failed to get API key with payment');
      }
    },

    createDreamsRouter(
      routerOptions: { payments?: DreamsRouterPaymentConfig } = {},
    ) {
      if (!currentSessionToken) {
        throw new Error('No session token available. Please login first.');
      }

      return createDreamsRouter({
        sessionToken: currentSessionToken,
        baseURL: options.baseURL || 'https://dev-router.daydreams.systems/v1',
        payment: routerOptions.payments,
        signer: currentAccount || undefined,
      });
    },

    async getProfile() {
      if (!currentSessionToken) {
        throw new Error('No session token available. Please login first.');
      }

      const response = await apiClient.getProfile();

      if (response.success && response.user) {
        currentUser = response.user;
        return response.user;
      } else {
        throw new Error(response.error || 'Failed to get profile');
      }
    },

    async getBalance(address: string) {
      const response = await apiClient.getWalletBalance(address);

      if (response.success || response.balance !== undefined) {
        return response.balance ?? 0;
      } else {
        throw new Error(response.error || 'Failed to get wallet balance');
      }
    },

    logout() {
      currentSessionToken = null;
      currentUser = null;
      currentAccount = null;
      apiClient.removeSessionToken();
      apiClient.removeApiKey();
    },
  };
}

/**
 * Dreams Router authentication with automatic AI SDK integration
 */
export async function createDreamsRouterAuth(
  account: Account,
  options: WalletAuthManagerOptions & {
    payments?: DreamsRouterPaymentConfig;
  } = {},
) {
  const authManager = createWalletAuthManager(options);

  // Get JWT token
  const { sessionToken, user } = await authManager.walletLogin(account);

  // Create Dreams Router provider
  const dreamsRouter = authManager.createDreamsRouter({
    payments: options.payments,
  });

  return {
    sessionToken,
    user,
    dreamsRouter,
    authManager,
  };
}
