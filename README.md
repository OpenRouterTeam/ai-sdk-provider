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
import { llmgateway, createLLMGateway } from '@llmgateway/ai-sdk-provider';
import { generateText } from 'ai';

const openrouter = createLLMGateway({
  apiKey: process.env.LLMGATEWAY_API_KEY,
});

const { text } = await generateText({
  model: llmgateway('openai/gpt-4o'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});

console.log(`response: ${text}`);
```

## Supported models

You can find the latest list of models supported by LLMGateway [here](https://llmgateway.io/models).
