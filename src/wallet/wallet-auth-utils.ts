/**
 * Wallet authentication utilities for Dreams Router
 * Combines API client with AI SDK for seamless wallet authentication
 */

import type { Account } from 'viem';
import type { User } from './dreams-router-api-client.js';
import type { DreamsRouterPaymentConfig, SolanaSigner } from '../types';

import { DreamsRouterApiClient } from './dreams-router-api-client.js';
import { createDreamsRouter } from '../provider';

export interface WalletAuthManager {
  apiClient: DreamsRouterApiClient;
  currentSessionToken: string | null;
  currentUser: User | null;
  currentAccount: Account | null;

  /**
   * Sign message and get JWT session token using an account
   */
  walletLogin(account: Account): Promise<{ sessionToken: string; user: User }>;

  /**
   * Create Dreams Router provider with current authentication and optional payments
   */
  createDreamsRouter(options?: {
    payments?: DreamsRouterPaymentConfig;
    solanaSigner?: SolanaSigner;
  }): ReturnType<typeof createDreamsRouter>;

  /**
   * Get current user profile
   */
  getProfile(): Promise<User>;

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
  options: WalletAuthManagerOptions = {}
): WalletAuthManager {
  const apiClient = new DreamsRouterApiClient({
    baseURL: options.baseURL,
  });

  let currentSessionToken: string | null = null;
  let currentUser: User | null = null;
  let currentAccount: Account | null = null;

  // Set up token expiration callback
  if (options.onTokenExpired) {
    apiClient.setTokenExpiredCallback(options.onTokenExpired);
  }

  return {
    apiClient,
    get currentSessionToken() {
      return currentSessionToken;
    },
    get currentUser() {
      return currentUser;
    },
    get currentAccount() {
      return currentAccount;
    },

    async walletLogin(account: Account) {
      const timestamp = Date.now();
      const message = `Sign this message to authenticate with Dreams Router\n\nWallet: ${account.address}\nTimestamp: ${timestamp}`;

      if (!account.signMessage) {
        throw new Error(
          'Account does not support message signing. Required for authentication.'
        );
      }
      const signature = await account.signMessage({ message });

      const response = await apiClient.walletLogin(
        account.address,
        signature,
        message
      );

      if (response.success && response.sessionToken && response.user) {
        currentSessionToken = response.sessionToken;
        currentUser = response.user;
        currentAccount = account;
        apiClient.setApiKey(response.sessionToken);

        return {
          sessionToken: response.sessionToken,
          user: response.user,
        };
      } else {
        throw new Error(response.error || 'Failed to login with wallet');
      }
    },

    createDreamsRouter(
      routerOptions: {
        payments?: DreamsRouterPaymentConfig;
        solanaSigner?: SolanaSigner;
      } = {}
    ) {
      if (!currentSessionToken) {
        throw new Error('No session token available. Please login first.');
      }

      return createDreamsRouter({
        apiKey: currentSessionToken,
        baseURL: options.baseURL || 'https://api-beta.daydreams.systems/v1',
        payment: routerOptions.payments,
        signer: currentAccount || undefined,
        solanaSigner: routerOptions.solanaSigner,
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
    solanaSigner?: SolanaSigner;
  } = {}
) {
  const authManager = createWalletAuthManager(options);

  // Get JWT token
  const { sessionToken, user } = await authManager.walletLogin(account);

  // Create Dreams Router provider
  const dreamsRouter = authManager.createDreamsRouter({
    payments: options.payments,
    solanaSigner: options.solanaSigner,
  });

  return {
    sessionToken,
    user,
    dreamsRouter,
    authManager,
  };
}
