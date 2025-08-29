/**
 * Unified wallet authentication for Dreams Router
 * Supports both EVM and Solana accounts seamlessly
 */

import type { Account } from 'viem';
import type { User } from './dreams-router-api-client.js';
import type { DreamsRouterPaymentConfig } from '../types';
import type { UnifiedAccount, SolanaAccount } from './unified-account-types';
import {
  wrapAccount,
  isEVMAccount,
  isSolanaAccount,
  getAccountIdentifier,
  getPreferredNetwork,
} from './unified-account-types';

import { DreamsRouterApiClient } from './dreams-router-api-client.js';
import { createDreamsRouter } from '../provider';

export interface UnifiedAuthManager {
  apiClient: DreamsRouterApiClient;
  currentSessionToken: string | null;
  currentUser: User | null;
  currentAccount: UnifiedAccount | null;

  /**
   * Sign message and get JWT session token using any supported account type
   */
  login(
    account: Account | SolanaAccount
  ): Promise<{ sessionToken: string; user: User }>;

  /**
   * Create Dreams Router provider with current authentication and payments
   */
  createDreamsRouter(options?: {
    payments?: DreamsRouterPaymentConfig;
    baseURL?: string;
  }): ReturnType<typeof createDreamsRouter>;

  /**
   * Get current user profile
   */
  getProfile(): Promise<User>;

  /**
   * Get wallet balance
   */
  getBalance(identifier?: string): Promise<number>;

  /**
   * Logout and clear tokens
   */
  logout(): void;
}

export interface UnifiedAuthOptions {
  baseURL?: string;
  onTokenExpired?: () => Promise<string | null>;
}

export function createUnifiedAuthManager(
  options: UnifiedAuthOptions = {}
): UnifiedAuthManager {
  const apiClient = new DreamsRouterApiClient({
    baseURL: options.baseURL,
  });

  let currentSessionToken: string | null = null;
  let currentUser: User | null = null;
  let currentAccount: UnifiedAccount | null = null;

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

    async login(account: Account | SolanaAccount) {
      // Wrap account to unified type
      const unifiedAccount = wrapAccount(account);
      const accountId = getAccountIdentifier(unifiedAccount);

      const timestamp = Date.now();
      const message = `Sign this message to authenticate with Dreams Router\n\nAccount: ${accountId}\nTimestamp: ${timestamp}`;

      let signature: string;

      if (isEVMAccount(unifiedAccount)) {
        // EVM signing
        if (!unifiedAccount.signMessage) {
          throw new Error(
            'EVM account does not support message signing. Required for authentication.'
          );
        }
        signature = await unifiedAccount.signMessage({ message });
      } else if (isSolanaAccount(unifiedAccount)) {
        // Solana signing
        if (!unifiedAccount.signMessage) {
          throw new Error(
            'Solana account does not support message signing. Required for authentication.'
          );
        }
        signature = await unifiedAccount.signMessage({ message });
      } else {
        throw new Error('Unsupported account type for authentication');
      }

      const response = await apiClient.walletLogin(
        accountId,
        signature,
        message
      );

      if (response.success && response.sessionToken && response.user) {
        currentSessionToken = response.sessionToken;
        currentUser = response.user;
        currentAccount = unifiedAccount;
        apiClient.setApiKey(response.sessionToken);

        return {
          sessionToken: response.sessionToken,
          user: response.user,
        };
      } else {
        throw new Error(response.error || 'Failed to login with account');
      }
    },

    createDreamsRouter(
      routerOptions: {
        payments?: DreamsRouterPaymentConfig;
        baseURL?: string;
      } = {}
    ) {
      if (!currentSessionToken || !currentAccount) {
        throw new Error(
          'No session token or account available. Please login first.'
        );
      }

      // Determine network preference if not specified
      const payments = routerOptions.payments || {};
      if (!payments.network && currentAccount) {
        payments.network = getPreferredNetwork(currentAccount) as any;
      }

      const config: any = {
        apiKey: currentSessionToken,
        baseURL:
          routerOptions.baseURL ||
          options.baseURL ||
          'https://api-beta.daydreams.systems/v1',
        payment: payments,
      };

      // Add appropriate signer based on account type
      if (isEVMAccount(currentAccount)) {
        config.signer = currentAccount;
      } else if (isSolanaAccount(currentAccount)) {
        // For Solana accounts, we expect them to handle their own signing
        // The payment system will use the Solana account directly
        throw new Error(
          'Solana accounts are not yet fully integrated with the provider. Use EVM accounts for now.'
        );
      }

      return createDreamsRouter(config);
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

    async getBalance(identifier?: string) {
      const accountId =
        identifier ||
        (currentAccount ? getAccountIdentifier(currentAccount) : null);
      if (!accountId) {
        throw new Error('No account identifier available');
      }

      const response = await apiClient.getWalletBalance(accountId);

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
 * Unified Dreams Router authentication - works with any account type
 */
export async function createUnifiedAuth(
  account: Account | SolanaAccount,
  options: UnifiedAuthOptions & {
    payments?: DreamsRouterPaymentConfig;
  } = {}
) {
  const authManager = createUnifiedAuthManager(options);

  // Authenticate with the account (EVM or Solana)
  const { sessionToken, user } = await authManager.login(account);

  // Create Dreams Router provider
  const dreamsRouter = authManager.createDreamsRouter({
    payments: options.payments,
    baseURL: options.baseURL,
  });

  return {
    sessionToken,
    user,
    dreamsRouter,
    authManager,
  };
}

// Backwards compatibility - re-export with new name
export const createDreamsRouterAuth = createUnifiedAuth;
