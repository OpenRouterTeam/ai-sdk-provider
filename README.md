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

# For Node.js wallet signing
PRIVATE_KEY=0x...
```

## Authentication Methods

Dreams Router supports multiple authentication methods:

### 1. API Key (Server-side)

```typescript
import { createDreamsRouter } from '@dreams/ai-sdk-provider';

const dreamsrouter = createDreamsRouter({
  apiKey: process.env.DREAMSROUTER_API_KEY // or in ENV
});
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
