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

```typescript
import { createDreamsRouter } from '@dreams/ai-sdk-provider';

// Use JWT or API key
const dreamsrouter = createDreamsRouter({
  apiKey: process.env.DREAMSROUTER_API_KEY
});
```
