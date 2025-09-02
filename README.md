# Dreams Router Provider for Vercel AI SDK

Dreams Router is an AI model router with built‑in x402 payments for the [Vercel AI SDK](https://sdk.vercel.ai/docs). It supports EVM and Solana, API keys or wallet auth, and auto‑generates exact payment headers from server requirements.

## 🌟 Key Features

- **Payment-Integrated AI**: Send USDC payments directly within API requests using the x402 protocol
- **Multiple Authentication Methods**: Use JWT, API Key, or inline payments
- **LLM Router**: Access various AI models through a unified interface
- **Account Management**: Create and manage your account at [router.daydreams.systems](https://router.daydreams.systems)

## 📋 Prerequisites

- Account at `router.daydreams.systems`
- One of: API key, account credit, or a wallet with USDC (router returns amounts; you don’t set them manually)

## 📦 Installation

```bash
npm install @daydreamsai/ai-sdk-provider viem x402

```

## 🚀 Quick Start

### Separated Auth (clean EVM/Solana helpers)

```ts
import { generateText } from 'ai';
import {
  createEVMAuthFromPrivateKey,
  createSolanaAuthFromPublicKey,
} from '@daydreamsai/ai-sdk-provider';

// EVM (Ethereum, Base, etc.)
const { dreamsRouter } = await createEVMAuthFromPrivateKey(
  process.env.EVM_PRIVATE_KEY as `0x${string}`,
  {
    payments: { network: 'base-sepolia' },
  }
);

// Solana (browser/wallet-style: publicKey + signMessage)
const { dreamsRouter: solanaRouter } = await createSolanaAuthFromPublicKey(
  process.env.SOL_PUBLIC_KEY!,
  async ({ message }) => wallet.signMessage(message),
  {
    payments: {
      network: 'solana-devnet',
      rpcUrl: 'https://api.devnet.solana.com',
    },
  }
);

const { text } = await generateText({
  model: dreamsRouter('google-vertex/gemini-2.5-flash'),
  prompt: 'Hello from Dreams Router!',
});
```

#### 🎯 Why Separated Functions?

- Type safety per chain; chain‑specific options stay clear
- Explicit intent (EVM vs Solana), smaller bundles

### API Key Auth

```ts
import { createDreamsRouter } from '@daydreamsai/ai-sdk-provider';
import { generateText } from 'ai';

const dreamsRouter = createDreamsRouter({
  apiKey: process.env.DREAMSROUTER_API_KEY,
});

const { text } = await generateText({
  model: dreamsRouter('google-vertex/gemini-2.5-flash'),
  prompt: 'Hello, Dreams Router!',
});
```

### Namespace `.evm` / `.solana` (Node)

```ts
import {
  createDreamsRouter,
  type SolanaSigner,
} from '@daydreamsai/ai-sdk-provider';
import { privateKeyToAccount } from 'viem/accounts';

// EVM via viem Account
const evm = createDreamsRouter.evm(
  privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`),
  { network: 'base-sepolia' }
);

// Solana via Node signer (base58 secret)
const solana = createDreamsRouter.solana(
  {
    type: 'node',
    secretKeyBase58: process.env.SOLANA_SECRET_KEY!,
    rpcUrl: process.env.SOLANA_RPC_URL,
  },
  { network: 'solana-devnet' }
);
```

## 🔐 Authentication Methods

- x402 payments (wallet‑based, EVM or Solana)
- API key
- Session token (JWT) from wallet login

## 💡 When to Use

- Microservices with per‑request payments
- Pay‑per‑use apps without billing backends
- Wallet‑native AI integrations (EVM or Solana)

## 🔧 Configuration

### Environment

```bash
# API key auth
DREAMSROUTER_API_KEY=...

# EVM auth
EVM_PRIVATE_KEY=0x...

# Solana (Node signer)
SOLANA_SECRET_KEY=base58-encoded-64-byte-secret
SOLANA_RPC_URL=https://api.devnet.solana.com

# Solana (wallet-style)
SOL_PUBLIC_KEY=...
ROUTER_BASE_URL=https://api-beta.daydreams.systems
```

## 📚 Advanced

### Payment config (auto‑requirements)

```ts
type DreamsRouterPaymentConfig = {
  network?:
    | 'base'
    | 'base-sepolia'
    | 'avalanche'
    | 'avalanche-fuji'
    | 'iotex'
    | 'solana'
    | 'solana-devnet';
  validityDuration?: number; // default 600s
  mode?: 'lazy' | 'eager'; // default 'lazy'
  rpcUrl?: string; // Solana only
};
```

Amounts and pay‑to addresses come from the router’s 402 response and are signed automatically.

### Solana signer interface (Node)

```ts
type SolanaSigner = {
  type: 'node';
  secretKeyBase58: string; // 64‑byte secret, base58
  rpcUrl?: string;
};
```

### Model selection

Use any model available in the dashboard; e.g. `google-vertex/gemini-2.5-flash`.

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Dreams Router Dashboard](https://router.daydreams.systems)
- [x402 Protocol](https://github.com/x402)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
