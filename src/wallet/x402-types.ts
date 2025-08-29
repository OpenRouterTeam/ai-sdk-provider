export type X402Network =
  | 'base'
  | 'base-sepolia'
  | 'avalanche'
  | 'avalanche-fuji'
  | 'iotex'
  | 'solana'
  | 'solana-devnet';

export interface X402PaymentRequirements {
  scheme: string;
  network: X402Network | string;
  maxAmountRequired: string;
  asset: string; // EVM token address or SOL mint address
  payTo: string; // EVM address or SOL owner address
  resource?: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  extra?: {
    feePayer?: string; // for SOL
    [key: string]: unknown;
  };
}

export function isSolanaNetwork(net: string | undefined | null): boolean {
  if (!net) return false;
  return net.startsWith('solana');
}

export function getChainIdForNetwork(network: string): number | undefined {
  switch (network) {
    case 'base':
      return 8453;
    case 'base-sepolia':
      return 84532;
    default:
      return undefined;
  }
}
