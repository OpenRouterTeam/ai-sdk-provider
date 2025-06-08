# LLMGateway Provider for Vercel AI SDK

Forked from https://github.com/OpenRouterTeam/ai-sdk-provider

The [LLMGateway](https://llmgateway.io/) provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs) gives access to over 300 large language model on the LLMGateway chat and completion APIs.

## Setup

```bash
# For pnpm
pnpm add @llmgateway/ai-sdk-provider

# For npm
npm install @llmgateway/ai-sdk-provider

# For yarn
yarn add @llmgateway/ai-sdk-provider
```

## Provider Instance

You can import the default provider instance `llmgateway` from `@llmgateway/ai-sdk-provider`:

```ts
import { llmgateway } from '@llmgateway/ai-sdk-provider';
```

## Example

```ts
import { llmgateway } from '@llmgateway/ai-sdk-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: llmgateway('openai/gpt-4o'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

## Supported models

This list is not a definitive list of models supported by LLMGateway, as it constantly changes as we add new models (and deprecate old ones) to our system. You can find the latest list of models supported by LLMGateway [here](https://llmgateway.io/models).

You can find the latest list of tool-supported models supported by LLMGateway [here](https://llmgateway.io/models?order=newest&supported_parameters=tools). (Note: This list may contain models that are not compatible with the AI SDK.)

## Passing Extra Body to LLMGateway

There are 3 ways to pass extra body to LLMGateway:

1. Via the `providerOptions.llmgateway` property:

   ```typescript
   import { createLLMGateway } from '@llmgateway/ai-sdk-provider';
   import { streamText } from 'ai';

   const llmgateway = createLLMGateway({ apiKey: 'your-api-key' });
   const model = llmgateway('anthropic/claude-3.7-sonnet:thinking');
   await streamText({
     model,
     messages: [{ role: 'user', content: 'Hello' }],
     providerOptions: {
       llmgateway: {
         reasoning: {
           max_tokens: 10,
         },
       },
     },
   });
   ```

2. Via the `extraBody` property in the model settings:

   ```typescript
   import { createLLMGateway } from '@llmgateway/ai-sdk-provider';
   import { streamText } from 'ai';

   const llmgateway = createLLMGateway({ apiKey: 'your-api-key' });
   const model = llmgateway('anthropic/claude-3.7-sonnet:thinking', {
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
   import { createLLMGateway } from '@llmgateway/ai-sdk-provider';
   import { streamText } from 'ai';

   const llmgateway = createLLMGateway({
     apiKey: 'your-api-key',
     extraBody: {
       reasoning: {
         max_tokens: 10,
       },
     },
   });
   const model = llmgateway('anthropic/claude-3.7-sonnet:thinking');
   await streamText({
     model,
     messages: [{ role: 'user', content: 'Hello' }],
   });
   ```

## Anthropic Prompt Caching

You can include Anthropic-specific options directly in your messages when using functions like `streamText`. The LLMGateway provider will automatically convert these messages to the correct format internally.

### Basic Usage

```typescript
import { createLLMGateway } from '@llmgateway/ai-sdk-provider';
import { streamText } from 'ai';

const llmgateway = createLLMGateway({ apiKey: 'your-api-key' });
const model = llmgateway('anthropic/<supported-caching-model>');

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
            llmgateway: {
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

The provider supports [LLMGateway usage accounting](https://llmgateway.io/docs/use-cases/usage-accounting), which allows you to track token usage details directly in your API responses, without making additional API calls.

```typescript
// Enable usage accounting
const model = llmgateway('openai/gpt-3.5-turbo', {
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
if (result.providerMetadata?.llmgateway?.usage) {
  console.log('Cost:', result.providerMetadata.llmgateway.usage.cost);
  console.log(
    'Total Tokens:',
    result.providerMetadata.llmgateway.usage.totalTokens,
  );
}
```
