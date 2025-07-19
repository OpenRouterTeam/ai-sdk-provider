# Dreams Router Provider for Vercel AI SDK

The Dreams Router provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs) gives access to large language models through the Dreams Router API (forked from [OpenRouter](https://openrouter.ai/)).

## Installation

```bash
npm install @dreams/ai-sdk-provider viem x402
```

## Quick Start

### Node.js Wallet Authentication

```typescript
import {
  createDreamsRouterAuth,
  generateX402Payment,
} from '@dreams/ai-sdk-provider';
import { generateText } from 'ai';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const payment = await generateX402Payment(account, {
  amount: '100000', // $0.10 USDC
  network: 'base-sepolia',
});

const { dreamsRouter, user } = await createDreamsRouterAuth(account, {
  payment,
});

const { text } = await generateText({
  model: dreamsRouter('openai/gpt-4o'),
  prompt: 'Hello, Dreams Router!',
});
```

## Environment Variables

```bash
# For API key authentication
DREAMSROUTER_API_KEY=your-api-key-here

# For JWT session token authentication
DREAMSROUTER_SESSION_TOKEN=your-jwt-session-token-here

# For Node.js wallet signing
PRIVATE_KEY=0x...
```

## Authentication Methods

Dreams Router supports multiple authentication methods:

### 1. API Key (Server-side)

```typescript
import { createDreamsRouter } from '@dreams/ai-sdk-provider';

const dreamsrouter = createDreamsRouter({
  apiKey: process.env.DREAMSROUTER_API_KEY,
  baseURL: 'https://dev-router.daydreams.systems/v1',
});
```

### 2. JWT Session Token (Wallet-based)

```typescript
import { createDreamsRouter } from '@dreams/ai-sdk-provider';

const dreamsrouter = createDreamsRouter({
  sessionToken: process.env.DREAMSROUTER_SESSION_TOKEN,
  baseURL: 'https://dev-router.daydreams.systems/v1',
});
```

### 3. Wallet Authentication with createDreamsRouterAuth (Recommended)

```typescript
import {
  createDreamsRouterAuth,
  generateX402Payment,
} from '@dreams/ai-sdk-provider';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

// Optional: Generate payment
const payment = await generateX402Payment(account, {
  amount: '100000',
  network: 'base-sepolia',
});

const auth = await createDreamsRouterAuth(account, { payment });

// Returns: { dreamsRouter, sessionToken, user, authManager }
```

## Viem-Native Account Interface

Dreams Router uses **viem's native Account interface** for both authentication and payments - no custom abstractions!

### Node.js (Private Key)

```typescript
import {
  createDreamsRouterAuth,
  generateX402Payment,
} from '@dreams/ai-sdk-provider';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const payment = await generateX402Payment(account, { amount: '100000' });
const auth = await createDreamsRouterAuth(account, { payment });
```

### Browser (wagmi/React) - New Recommended Approach

```typescript
import {
  createDreamsRouterAuthBrowser,
  createDreamsRouterFromToken,
  generateX402PaymentBrowser,
  walletLoginBrowser,
} from '@dreams/ai-sdk-provider';
import { generateText } from 'ai';
import { useAccount, useSignMessage, useSignTypedData } from 'wagmi';

function MyComponent() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { signTypedDataAsync } = useSignTypedData();

  const handleLogin = async () => {
    if (!address || !signMessageAsync) return;

    // Option 1: Step-by-step approach
    // First, login to get JWT token
    const { sessionToken, user } = await walletLoginBrowser(
      address,
      signMessageAsync,
    );

    // Then create the router with the token
    const dreamsRouter = createDreamsRouterFromToken(sessionToken, {
      payments: {
        amount: '100000', // $0.10 USDC
        network: 'base-sepolia',
      },
    });

    // Option 2: All-in-one approach
    const auth = await createDreamsRouterAuthBrowser(
      address,
      signMessageAsync,
      {
        payments: {
          amount: '100000',
          network: 'base-sepolia',
        },
        signTypedDataAsync, // Required for payments
      },
    );

    // Use the router
    const { text } = await generateText({
      model: auth.dreamsRouter('openai/gpt-4o'),
      prompt: 'Hello from browser!',
    });
  };
}
```

### Browser with X402 Payments Only

```typescript
import { getApiKeyWithPaymentBrowser } from '@dreams/ai-sdk-provider';
import { useAccount, useSignTypedData } from 'wagmi';

function PaymentComponent() {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();

  const getApiKey = async () => {
    if (!address || !signTypedDataAsync) return;

    const { apiKey, user } = await getApiKeyWithPaymentBrowser(
      address,
      signTypedDataAsync,
      {
        amount: '100000', // $0.10 USDC
        network: 'base-sepolia',
      },
    );

    // Use apiKey for subsequent requests
    const dreamsRouter = createDreamsRouter({ apiKey });
  };
}
```

### Using viem directly

```typescript
import {
  createDreamsRouterAuth,
  generateX402Payment,
} from '@dreams/ai-sdk-provider';
import { privateKeyToAccount } from 'viem/accounts';

// Use viem's native account creation
const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const payment = await generateX402Payment(account, { amount: '100000' });
const auth = await createDreamsRouterAuth(account, { payment });
```

### Custom Account

```typescript
import {
  createCustomAccount,
  createDreamsRouterAuth,
  generateX402Payment,
} from '@dreams/ai-sdk-provider';

const account = createCustomAccount(
  walletAddress,
  async (message) => wallet.signMessage(message),
  async (typedData) => wallet.signTypedData(typedData), // Required for payments
);

const payment = await generateX402Payment(account, { amount: '100000' });
const auth = await createDreamsRouterAuth(account, { payment });
```

## X402 Payment Integration

Dreams Router supports automatic crypto payments using X402 protocol:

### Node.js Payments

```typescript
import {
  createDreamsRouterAuth,
  generateX402Payment,
} from '@dreams/ai-sdk-provider';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const payment = await generateX402Payment(account, {
  amount: '100000', // $0.10 USDC
  network: 'base-sepolia',
  serviceWallet: '0x...', // Optional
  validityDuration: 600, // Optional: 10 minutes
});

const auth = await createDreamsRouterAuth(account, { payment });
```

### Browser Payments

```typescript
import { generateX402PaymentBrowser } from '@dreams/ai-sdk-provider';
import { useAccount, useSignTypedData } from 'wagmi';

const { address } = useAccount();
const { signTypedDataAsync } = useSignTypedData();

const payment = await generateX402PaymentBrowser(address!, signTypedDataAsync, {
  amount: '100000',
  network: 'base-sepolia',
});

const auth = await createDreamsRouterAuth(account, { payment });
```

### Without Payments

```typescript
// Authentication only - no payments
const auth = await createDreamsRouterAuth(account, {});
```

## JWT Token Auto-Refresh

Dreams Router automatically refreshes expired JWT tokens using your account:

```typescript
import { createWalletAuthManager } from '@dreams/ai-sdk-provider';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const authManager = createWalletAuthManager({
  baseURL: 'https://dev-router.daydreams.systems',
  onTokenExpired: async () => {
    // Automatically refresh token when expired
    const { sessionToken } = await authManager.walletLogin(account);
    return sessionToken;
  },
});

// All API calls will automatically handle token refresh
```

## API Client Usage

Access Dreams Router platform features:

```typescript
import { DreamsRouterApiClient } from '@dreams/ai-sdk-provider';

const apiClient = new DreamsRouterApiClient();

// Get available models
const models = await apiClient.getDetailedModels();

// Check wallet balance
const balance = await apiClient.getWalletBalance(walletAddress);

// Get usage statistics
const stats = await apiClient.getWalletStats(walletAddress);
```

## Supported Models

This provider is compatible with OpenRouter model IDs and API format. Check available models:

```typescript
const models = await apiClient.getDetailedModels();
console.log('Available models:', models.data?.models);
```

## Error Handling

Dreams Router handles common errors gracefully:

- **JWT token expiration**: Automatically refreshed
- **Payment failures**: Requests continue without payment
- **Network errors**: Standard HTTP error responses
- **Invalid signatures**: Clear error messages

## TypeScript Support

Full TypeScript support with viem's native types:

```typescript
import type { Account } from 'viem';
import type {
  DreamsRouterPaymentConfig,
  ModelConfig,
  UsageStats,
  User,
} from '@dreams/ai-sdk-provider';
```

## Summary

Dreams Router AI SDK provides:

✅ **Viem-Native**: Uses viem's Account interface - no custom abstractions  
✅ **Multiple auth methods**: API keys, JWT tokens, and wallet authentication  
✅ **Automatic payments**: X402 crypto payment integration  
✅ **Cross-platform**: Works in browser, Node.js, React Native, edge functions  
✅ **Auto token refresh**: Seamless JWT token management  
✅ **Full API access**: Complete Dreams Router platform integration  
✅ **TypeScript support**: Comprehensive type definitions with viem  
✅ **Vercel AI SDK**: Drop-in replacement for other providers

**Key Innovation**: Uses viem's native Account interface - familiar to all viem users!
