export * from './provider';
export * from './types';
export * from './wallet/x402-payment-utils';
export * from './wallet/unified-account-types';
export * from './wallet/unified-wallet-auth';
export * from './wallet/account-helpers';
export * from './wallet/separated-auth';

// Legacy wallet auth utils (without createDreamsRouterAuth to avoid conflict)
export {
  createWalletAuthManager,
  type WalletAuthManager,
  type WalletAuthManagerOptions,
} from './wallet/wallet-auth-utils';

export type { SolanaSigner } from './types';
