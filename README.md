# Dreams Router Provider for Vercel AI SDK

The Dreams Router provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs) gives access to large language models through the Dreams Router API (forked from [OpenRouter](https://openrouter.ai/)).

## Setup

```bash
# For pnpm
pnpm add @dreams/ai-sdk-provider

# For npm
npm install @dreams/ai-sdk-provider

# For yarn
yarn add @dreams/ai-sdk-provider
```

## Provider Instance

You can import the default provider instance `dreamsrouter` from `@dreams/ai-sdk-provider`:

```ts
import { dreamsrouter } from '@dreams/ai-sdk-provider';
```

You can also create a custom provider instance:

```ts
import { createDreamsRouter } from '@dreams/ai-sdk-provider';

const dreamsrouter = createDreamsRouter({
  apiKey: 'your-dreams-router-api-key', // defaults to DREAMSROUTER_API_KEY env var
  // baseURL: 'https://your-dreams-router-domain.com/api/v1', // TODO: Update when ready
});
```

## Example

```ts
import { dreamsrouter } from '@dreams/ai-sdk-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: dreamsrouter('openai/gpt-4o'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

## Environment Variables

Set your Dreams Router API key:

```bash
DREAMSROUTER_API_KEY=your-api-key-here
```

## X402 Payment Integration

Dreams Router supports automatic x402 payment generation for seamless crypto payments. When enabled, the SDK will automatically generate and include x402 payment signatures with each request.

### Setup

First, install the required payment dependencies:

```bash
npm install viem x402
```

### Basic Usage

```typescript
import { createDreamsRouter } from '@dreams/ai-sdk-provider';
import { generateText } from 'ai';

const dreamsrouter = createDreamsRouter({
  apiKey: 'your-api-key',
  payment: {
    privateKey: '0x...', // Your private key for signing payments
    amount: '100000', // Payment amount in USDC (6 decimals) - defaults to $0.10
  },
});

// Payment is automatically handled for each request
const { text } = await generateText({
  model: dreamsrouter('openai/gpt-4o'),
  prompt: 'Hello world!',
});
```

### Payment Configuration

```typescript
const dreamsrouter = createDreamsRouter({
  payment: {
    privateKey: '0x...', // Required: Your private key
    amount: '100000', // Optional: Payment amount (defaults to $0.10)
    serviceWallet: '0x...', // Optional: Service wallet address
    usdcAddress: '0x...', // Optional: USDC contract address
    network: 'base-sepolia', // Optional: Network (base-sepolia, base, avalanche-fuji, avalanche, iotex)
    validityDuration: 600, // Optional: Payment validity in seconds (default: 10 minutes)
  },
});
```

### How It Works

1. **Automatic Payment Generation**: Each request automatically generates a fresh x402 payment signature
2. **EIP-712 Signing**: Uses standard Ethereum signing for secure payment authorization
3. **USDC Payments**: Supports USDC payments on multiple networks
4. **Request Integration**: Payments are seamlessly injected into request bodies

### Networks Supported

- `base-sepolia` (default)
- `base`
- `avalanche-fuji`
- `avalanche`
- `iotex`

### Error Handling

If payment generation fails, the request will continue without payment, allowing the server to handle the error appropriately.

## Supported models

This provider is compatible with OpenRouter model IDs and API format.

## Passing Extra Body to OpenRouter

There are 3 ways to pass extra body to OpenRouter:

1. Via the `providerOptions.openrouter` property:

   ```typescript
   import { createOpenRouter } from '@openrouter/ai-sdk-provider';
   import { streamText } from 'ai';

   const openrouter = createOpenRouter({ apiKey: 'your-api-key' });
   const model = openrouter('anthropic/claude-3.7-sonnet:thinking');
   await streamText({
     model,
     messages: [{ role: 'user', content: 'Hello' }],
     providerOptions: {
       openrouter: {
         reasoning: {
           max_tokens: 10,
         },
       },
     },
   });
   ```

2. Via the `extraBody` property in the model settings:

   ```typescript
   import { createOpenRouter } from '@openrouter/ai-sdk-provider';
   import { streamText } from 'ai';

   const openrouter = createOpenRouter({ apiKey: 'your-api-key' });
   const model = openrouter('anthropic/claude-3.7-sonnet:thinking', {
     extraBody: {
       reasoning: {
         max_tokens: 10,
       },
     },
   });
   await streamText({
     model,
     messages: [{ role: 'user', content: 'Hello' }],
   });
   ```

3. Via the `extraBody` property in the model factory.

   ```typescript
   import { createOpenRouter } from '@openrouter/ai-sdk-provider';
   import { streamText } from 'ai';

   const openrouter = createOpenRouter({
     apiKey: 'your-api-key',
     extraBody: {
       reasoning: {
         max_tokens: 10,
       },
     },
   });
   const model = openrouter('anthropic/claude-3.7-sonnet:thinking');
   await streamText({
     model,
     messages: [{ role: 'user', content: 'Hello' }],
   });
   ```

## Anthropic Prompt Caching

You can include Anthropic-specific options directly in your messages when using functions like `streamText`. The OpenRouter provider will automatically convert these messages to the correct format internally.

### Basic Usage

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { streamText } from 'ai';

const openrouter = createOpenRouter({ apiKey: 'your-api-key' });
const model = openrouter('anthropic/<supported-caching-model>');

await streamText({
  model,
  messages: [
    {
      role: 'system',
      content:
        'You are a podcast summary assistant. You are detail oriented and critical about the content.',
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Given the text body below:',
        },
        {
          type: 'text',
          text: `<LARGE BODY OF TEXT>`,
          providerOptions: {
            openrouter: {
              cacheControl: { type: 'ephemeral' },
            },
          },
        },
        {
          type: 'text',
          text: 'List the speakers?',
        },
      ],
    },
  ],
});
```

## Use Cases

### Usage Accounting

The provider supports [OpenRouter usage accounting](https://openrouter.ai/docs/use-cases/usage-accounting), which allows you to track token usage details directly in your API responses, without making additional API calls.

```typescript
// Enable usage accounting
const model = openrouter('openai/gpt-3.5-turbo', {
  usage: {
    include: true,
  },
});

// Access usage accounting data
const result = await generateText({
  model,
  prompt: 'Hello, how are you today?',
});

// Provider-specific usage details (available in providerMetadata)
if (result.providerMetadata?.openrouter?.usage) {
  console.log('Cost:', result.providerMetadata.openrouter.usage.cost);
  console.log(
    'Total Tokens:',
    result.providerMetadata.openrouter.usage.totalTokens,
  );
}
```
