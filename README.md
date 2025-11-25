# OpenRouter AI SDK Provider

A provider implementation for the [Vercel AI SDK](https://sdk.vercel.ai/) that enables integration with [OpenRouter](https://openrouter.ai/), providing unified access to multiple AI models through a single API.

## Features

- ✅ **Full AI SDK V2 Compatibility** - Implements LanguageModelV2, EmbeddingModelV2, and ImageModelV2
- 🧠 **Advanced Reasoning Support** - Full support for reasoning/chain-of-thought (e.g., OpenAI o1, Claude with thinking)
- 🔄 **Streaming & Non-streaming** - Support for both streaming and non-streaming responses
- 🛠️ **Tool Calling** - Full support for function/tool calling
- 🖼️ **Multimodal** - Support for text, images, and file inputs
- 📊 **Embeddings** - Text embedding generation
- 🎨 **Image Generation** - AI image generation support
- 🔀 **Model Routing** - OpenRouter's intelligent model routing and fallbacks
- ⚡ **Transforms** - Support for OpenRouter transforms
- 📈 **Usage Tracking** - Detailed token usage including reasoning tokens

## Installation

```bash
npm install @openrouter/ai-provider ai
```

## Quick Start

```typescript
import { openrouter } from '@openrouter/ai-provider';
import { generateText, streamText } from 'ai';

// Set your OpenRouter API key
process.env.OPENROUTER_API_KEY = 'your-api-key';

// Generate text
const { text } = await generateText({
  model: openrouter('anthropic/claude-3.5-sonnet'),
  prompt: 'Write a haiku about programming',
});

// Stream text
const { textStream } = await streamText({
  model: openrouter('openai/gpt-4-turbo'),
  prompt: 'Tell me a story',
});

for await (const chunk of textStream) {
  console.log(chunk);
}
```

## Configuration

### Provider Settings

```typescript
import { createOpenRouter } from '@openrouter/ai-provider';

const customProvider = createOpenRouter({
  apiKey: 'your-api-key', // Optional, defaults to OPENROUTER_API_KEY env var
  baseURL: 'https://openrouter.ai/api/v1', // Optional, for proxies
  headers: {
    'X-Custom-Header': 'value', // Optional custom headers
  },
});
```

### Model Settings

```typescript
const model = openrouter('anthropic/claude-3.5-sonnet', {
  // OpenRouter-specific settings
  transforms: ['middle-out'], // Apply transforms to output
  models: ['model1', 'model2'], // Models for routing
  route: 'fallback', // Routing strategy
  provider: 'custom-provider', // Custom provider name for tracking
  structuredOutputs: true, // Enable JSON mode
  user: 'user-123', // User ID for rate limiting
});
```

## Reasoning Support

The provider fully supports reasoning/chain-of-thought for compatible models:

```typescript
const { text, experimental_providerMetadata } = await generateText({
  model: openrouter('openai/o1-preview'),
  messages: [
    {
      role: 'user',
      content: 'Solve this step-by-step: What is 25% of 80?',
    },
  ],
});

// Access reasoning details
const reasoning = experimental_providerMetadata?.openrouter?.reasoning;
if (reasoning) {
  console.log('Reasoning:', reasoning.content);
  console.log('Reasoning tokens:', reasoning.tokens);
}
```

### Streaming with Reasoning

```typescript
const { textStream } = await streamText({
  model: openrouter('anthropic/claude-3.5-sonnet'),
  messages: [
    {
      role: 'user',
      content: 'Think through this problem step by step...',
    },
  ],
});

for await (const part of textStream) {
  // The stream will include both reasoning and regular text
  console.log(part);
}
```

## Tool Calling

```typescript
import { tool } from 'ai';
import { z } from 'zod';

const { text, toolCalls } = await generateText({
  model: openrouter('openai/gpt-4-turbo'),
  prompt: 'What is the weather in San Francisco?',
  tools: {
    getWeather: tool({
      description: 'Get weather information',
      parameters: z.object({
        location: z.string().describe('City name'),
      }),
      execute: async ({ location }) => {
        // Your weather API call here
        return { temperature: 72, condition: 'sunny' };
      },
    }),
  },
  toolChoice: 'auto', // or 'none', 'required', or specific tool
});
```

## Multimodal Input

```typescript
// With image URL
const { text } = await generateText({
  model: openrouter('openai/gpt-4-vision'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this image?' },
        {
          type: 'file',
          data: 'https://example.com/image.jpg',
          mediaType: 'image/jpeg',
        },
      ],
    },
  ],
});

// With base64 image
const { text: base64Response } = await generateText({
  model: openrouter('anthropic/claude-3.5-sonnet'),
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this chart' },
        {
          type: 'file',
          data: base64ImageData, // base64 string or Uint8Array
          mediaType: 'image/png',
        },
      ],
    },
  ],
});
```

## Embeddings

```typescript
import { embed } from 'ai';

// Single embedding
const { embedding } = await embed({
  model: openrouter.textEmbeddingModel('openai/text-embedding-3-small'),
  value: 'Hello, world!',
});

// Batch embeddings
const { embeddings } = await embed({
  model: openrouter.embedding('openai/text-embedding-3-large'),
  values: ['Hello', 'World', 'AI'],
});

// With dimensions
const { embedding: customEmbed } = await embed({
  model: openrouter.embedding('openai/text-embedding-3-small', {
    dimensions: 512, // Reduce dimensions
  }),
  value: 'Dimensionality reduction example',
});
```

## Image Generation

```typescript
import { generateImage } from 'ai';

const { images } = await generateImage({
  model: openrouter.imageModel('openai/dall-e-3'),
  prompt: 'A futuristic city at sunset, digital art',
  n: 1, // Number of images
  size: '1024x1024', // Image size
  quality: 'hd', // 'standard' or 'hd'
  style: 'vivid', // 'vivid' or 'natural'
});

// Access generated images
for (const image of images) {
  console.log('Image URL:', image.url);
  console.log('Revised prompt:', image.revisedPrompt);
}

// With base64 response
const { images: base64Images } = await generateImage({
  model: openrouter.image('stability-ai/stable-diffusion-xl'),
  prompt: 'Abstract art',
  providerOptions: {
    openrouter: {
      response_format: 'b64_json',
    },
  },
});
```

## Advanced Usage

### Model Routing

```typescript
// Use multiple models with fallback
const model = openrouter('openai/gpt-4-turbo', {
  models: [
    'openai/gpt-4-turbo',
    'anthropic/claude-3.5-sonnet',
    'google/gemini-pro',
  ],
  route: 'fallback', // Use fallback routing
});
```

### Transforms

```typescript
// Apply OpenRouter transforms
const model = openrouter('anthropic/claude-3.5-sonnet', {
  transforms: ['middle-out'], // Apply middle-out transform
});
```

### Structured Outputs

```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: openrouter('openai/gpt-4-turbo', {
    structuredOutputs: true,
  }),
  schema: z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email(),
  }),
  prompt: 'Generate a random person profile',
});
```

### Custom Headers and Provider Options

```typescript
const { text } = await generateText({
  model: openrouter('anthropic/claude-3.5-sonnet'),
  prompt: 'Hello',
  providerOptions: {
    openrouter: {
      transforms: ['middle-out'],
      route: 'fallback',
      // Any additional OpenRouter-specific options
    },
  },
});
```

## Error Handling

The provider includes comprehensive error handling with proper error types:

```typescript
import { APICallError, TooManyRequestsError } from '@ai-sdk/provider';

try {
  const { text } = await generateText({
    model: openrouter('anthropic/claude-3.5-sonnet'),
    prompt: 'Hello',
  });
} catch (error) {
  if (error instanceof TooManyRequestsError) {
    // Handle rate limiting
    console.log('Rate limited. Retry after:', error.retryAfter);
  } else if (error instanceof APICallError) {
    // Handle API errors
    console.log('API Error:', error.message);
    if (error.isRetryable) {
      // Retry logic
    }
  }
}
```

## Environment Variables

- `OPENROUTER_API_KEY` - Your OpenRouter API key

## Supported Models

OpenRouter provides access to models from various providers:

- **OpenAI**: GPT-4, GPT-3.5, DALL-E, Embeddings
- **Anthropic**: Claude 3.5, Claude 3, Claude 2
- **Google**: Gemini Pro, PaLM
- **Meta**: Llama 2, Code Llama
- **Mistral**: Mistral, Mixtral
- **And many more...**

Check [OpenRouter's model list](https://openrouter.ai/models) for the complete list of available models.

## TypeScript Support

The provider is fully typed and includes TypeScript definitions for all interfaces:

```typescript
import type {
  OpenRouterProvider,
  OpenRouterChatSettings,
  OpenRouterReasoningDetails,
} from '@openrouter/ai-provider';

// All types are exported and documented
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Links

- [OpenRouter](https://openrouter.ai/)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [API Documentation](https://openrouter.ai/docs)
- [Model List](https://openrouter.ai/models)