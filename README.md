# @openrouter/ai-sdk-provider

> Access 500+ AI models through the [Vercel AI SDK](https://sdk.vercel.ai). One API. No vendor lock-in.

[![npm](https://img.shields.io/npm/v/@openrouter/ai-sdk-provider)](https://www.npmjs.com/package/@openrouter/ai-sdk-provider)
[![npm alpha](https://img.shields.io/npm/v/@openrouter/ai-sdk-provider/alpha?label=alpha)](https://www.npmjs.com/package/@openrouter/ai-sdk-provider?activeTab=versions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Why OpenRouter?

- **500+ models** — GPT-5.2, Claude Opus 4.5, Gemini 3, Llama 4, and more
- **One integration** — Switch models by changing a string
- **Automatic fallbacks** — Route between providers for reliability
- **Pay-as-you-go** — No commitments, unified billing

## Install

**For AI SDK v6 (alpha):**
```bash
npm install @openrouter/ai-sdk-provider@alpha ai@^6.0.0
```

**For AI SDK v5 (stable):**
```bash
npm install @openrouter/ai-sdk-provider ai@^5.0.0
```

## Quick Start

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const { text } = await generateText({
  model: openrouter('anthropic/claude-opus-4.5'),
  prompt: 'Write a haiku about distributed systems.',
});

console.log(text);
```

## Streaming

```typescript
import { streamText } from 'ai';

const stream = streamText({
  model: openrouter('google/gemini-3-pro-preview'),
  prompt: 'Explain monads without using the word "monad".',
});

for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

## Tool Calling

```typescript
import { generateText, tool } from 'ai';
import { z } from 'zod';

const { toolCalls } = await generateText({
  model: openrouter('openai/gpt-5.2'),
  tools: {
    weather: tool({
      description: 'Get current weather',
      parameters: z.object({ city: z.string() }),
      execute: async ({ city }) => fetchWeather(city),
    }),
  },
  prompt: 'What's the weather in Tokyo?',
});
```

## Reasoning Models

Models with extended thinking (Claude, Gemini 3, DeepSeek R1) expose their reasoning:

```typescript
const { text, reasoning } = await generateText({
  model: openrouter('deepseek/deepseek-r1-0528'),
  prompt: 'Prove that √2 is irrational.',
});

console.log('Thinking:', reasoning);
console.log('Answer:', text);
```

## Embeddings

```typescript
import { embed } from 'ai';

const { embedding } = await embed({
  model: openrouter.embeddingModel('openai/text-embedding-3-small'),
  value: 'The quick brown fox...',
});
```

## Configuration

```typescript
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  
  // Optional: Set defaults for all requests
  defaultHeaders: {
    'HTTP-Referer': 'https://myapp.com',
    'X-Title': 'My App',
  },
});

// Per-request options
const model = openrouter('anthropic/claude-sonnet-4.5', {
  // OpenRouter-specific
  transforms: ['middle-out'],
  route: 'fallback',
  models: ['anthropic/claude-sonnet-4.5', 'openai/gpt-5.2'],
});
```

## Popular Models

| Model | Best for |
|-------|----------|
| `anthropic/claude-opus-4.5` | Complex reasoning, agentic workflows |
| `anthropic/claude-sonnet-4.5` | Balanced performance, 1M context |
| `google/gemini-3-pro-preview` | Multimodal, long context |
| `openai/gpt-5.2` | General purpose, adaptive thinking |
| `deepseek/deepseek-r1-0528` | Open reasoning, math proofs |
| `meta-llama/llama-4-maverick` | Open weights, 17B active |

→ [Browse all models](https://openrouter.ai/models)

## Coming Soon

These features are planned for upcoming releases:

| Feature | Status |
|---------|--------|
| **Prompt caching** | Planned — Anthropic-style `cache_control` for cost savings |
| **Image generation** | Planned — `ImageModelV3` support |
| **Audio inputs** | Planned — For multimodal models like GPT-4o |
| **Rate limit headers** | Planned — Expose `X-RateLimit-*` in provider metadata |

### Known Limitations

Some model + feature combinations have upstream issues:

- **Gemini 3 + tools + reasoning**: May return 400 errors ([tracking](https://github.com/OpenRouterTeam/ai-sdk-provider/issues/239))
- **Claude thinking + tools**: Edge cases in multi-turn conversations ([tracking](https://github.com/OpenRouterTeam/ai-sdk-provider/issues/245))

These are being tracked upstream and will be resolved in future releases.

## Requirements

- Node.js 18+ / Bun / Deno
- AI SDK 6.x (`ai@^6.0.0`)
- OpenRouter API key ([get one free](https://openrouter.ai/keys))

## Compatibility

Works everywhere the AI SDK works:

- ✅ Node.js
- ✅ Edge runtimes (Vercel, Cloudflare)
- ✅ Serverless functions
- ✅ React Server Components

## Documentation

- [OpenRouter API Docs](https://openrouter.ai/docs)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Model Pricing](https://openrouter.ai/models)

## License

MIT
