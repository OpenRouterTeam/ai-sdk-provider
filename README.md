# Dreams Router Provider for Vercel AI SDK

The Dreams Router provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs) gives access to large language models through the Dreams Router API (forked from [OpenRouter](https://openrouter.ai/)).

## Setup

```bash
# For pnpm
pnpm add @daydreamsai/ai-sdk-provider

# For npm
npm install @daydreamsai/ai-sdk-provider

# For yarn
yarn add @daydreamsai/ai-sdk-provider
```

## Authentication Methods

Dreams Router supports two authentication methods:

### 1. API Key Authentication (Traditional)

```ts
import { createDreamsRouter } from '@daydreamsai/ai-sdk-provider';

const dreamsrouter = createDreamsRouter({
  apiKey: 'your-dreams-router-api-key', // defaults to DREAMSROUTER_API_KEY env var
  // baseURL: 'https://your-dreams-router-domain.com/api/v1', // TODO: Update when ready
});
```

### 2. Wallet-based Authentication (x402 Payment)

```ts
import { createDreamsRouter } from '@daydreamsai/ai-sdk-provider';

// No API key required when using x402Payment
const dreamsrouter = createDreamsRouter({
  baseURL: 'https://your-dreams-router-domain.com/api/v1',
  extraBody: {
    x402Payment: 'your-encoded-x402-payment-header',
  },
});
```

## Provider Instance

You can import the default provider instance `dreamsrouter` from `@daydreamsai/ai-sdk-provider`:

```ts
import { dreamsrouter } from '@daydreamsai/ai-sdk-provider';
```

You can also create a custom provider instance:

```ts
import { createDreamsRouter } from '@daydreamsai/ai-sdk-provider';

const dreamsrouter = createDreamsRouter({
  apiKey: 'your-dreams-router-api-key', // defaults to DREAMSROUTER_API_KEY env var
  // baseURL: 'https://your-dreams-router-domain.com/api/v1', // TODO: Update when ready
});
```

## Example

### Basic Usage with API Key

```ts
import { dreamsrouter } from '@daydreamsai/ai-sdk-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: dreamsrouter('openai/gpt-4o'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

### Wallet-only Authentication with x402 Payment

```ts
import { createDreamsRouter } from '@daydreamsai/ai-sdk-provider';
import { generateText } from 'ai';

// Create provider with x402 payment - no API key needed
const dreamsrouter = createDreamsRouter({
  baseURL: 'http://localhost:8080/v1/',
  extraBody: {
    x402Payment: 'your-encoded-x402-payment-header',
  },
});

const { text } = await generateText({
  model: dreamsrouter('openai/gpt-4o'),
  prompt: 'Hello with wallet authentication!',
});
```

## Environment Variables

For API key authentication:

```bash
DREAMSROUTER_API_KEY=your-api-key-here
```

For wallet-based authentication, no environment variables are required.

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
