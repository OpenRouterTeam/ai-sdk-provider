# Supported Models

This document provides detailed information about the models supported by the OpenRouter AI SDK Provider.

## Overview

The OpenRouter provider gives you access to over 300 large language models through the OpenRouter API. You can find the complete and up-to-date list of models at [openrouter.ai/models](https://openrouter.ai/models).

## 0G Compute Network Models

The OpenRouter provider supports models from the [0G Compute Network](https://docs.0g.ai/0g-compute/for-developers/inference-sdk), a decentralized AI inference network with verified computation capabilities.

### Available Models

#### Llama 3.3 70B Instruct (`0g/llama-3.3-70b-instruct`)

- **Provider Address**: `0xf07240Efa67755B5311bc75784a061eDB47165Dd`
- **Parameters**: 70 billion
- **Type**: Instruction-tuned language model
- **Verification**: TEE (Trusted Execution Environment) via TeeML
- **Best For**: General AI tasks, conversation, instruction following, creative writing

**Text Generation Capabilities:**

- High-quality conversational responses
- Code generation and explanation
- Creative writing (stories, poems, scripts)
- Educational content and explanations
- Problem-solving and analysis
- Multi-language support

**Example Usage:**

```typescript
import { openrouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

// General conversation
const { text } = await generateText({
  model: openrouter('0g/llama-3.3-70b-instruct'),
  prompt: 'Explain the concept of machine learning to a 10-year-old.',
});

// Code generation
const { text: code } = await generateText({
  model: openrouter('0g/llama-3.3-70b-instruct'),
  prompt: 'Write a Python function to calculate the factorial of a number.',
});

// Creative writing
const { text: story } = await generateText({
  model: openrouter('0g/llama-3.3-70b-instruct'),
  prompt: 'Write a short science fiction story about AI and humans working together.',
});
```

#### DeepSeek R1 70B (`0g/deepseek-r1-70b`)

- **Provider Address**: `0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3`
- **Parameters**: 70 billion
- **Type**: Advanced reasoning model
- **Verification**: TEE (Trusted Execution Environment) via TeeML
- **Best For**: Complex problem solving, mathematical reasoning, logical analysis

**Text Generation Capabilities:**

- Step-by-step reasoning and problem solving
- Mathematical computations and proofs
- Logical analysis and deduction
- Scientific explanations with detailed reasoning
- Code debugging and optimization
- Complex question answering with reasoning chains

**Example Usage:**

```typescript
import { openrouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

// Mathematical reasoning
const { text } = await generateText({
  model: openrouter('0g/deepseek-r1-70b'),
  prompt: 'Solve this step by step: If a train travels 120 km in 2 hours, what is its average speed in km/h and m/s?',
});

// Logical problem solving
const { text: logic } = await generateText({
  model: openrouter('0g/deepseek-r1-70b'),
  prompt: 'Three friends have different ages. Alice is older than Bob but younger than Charlie. If their ages sum to 60 and are consecutive integers, what are their ages?',
});

// Code analysis and debugging
const { text: analysis } = await generateText({
  model: openrouter('0g/deepseek-r1-70b'),
  prompt: `Analyze this code and explain why it might be inefficient:
  
  def find_duplicates(arr):
      duplicates = []
      for i in range(len(arr)):
          for j in range(i+1, len(arr)):
              if arr[i] == arr[j] and arr[i] not in duplicates:
                  duplicates.append(arr[i])
      return duplicates`,
});
```

### Model Configuration Options

Both 0G Compute models support all standard OpenRouter configuration options:

```typescript
import { openrouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

const { text } = await generateText({
  model: openrouter('0g/llama-3.3-70b-instruct', {
    // Control randomness (0.0 = deterministic, 1.0 = very random)
    temperature: 0.7,
    
    // Maximum tokens to generate
    maxTokens: 500,
    
    // Stop generation at these sequences
    stop: ['\n\n', '###'],
    
    // Nucleus sampling parameter
    topP: 0.9,
    
    // Frequency penalty to reduce repetition
    frequencyPenalty: 0.1,
    
    // Presence penalty to encourage new topics
    presencePenalty: 0.1,
  }),
  prompt: 'Write a technical explanation of blockchain technology.',
});
```

### Streaming Text Generation

Both models support streaming for real-time text generation:

```typescript
import { openrouter } from '@openrouter/ai-sdk-provider';
import { streamText } from 'ai';

const { textStream } = await streamText({
  model: openrouter('0g/llama-3.3-70b-instruct'),
  prompt: 'Write a detailed explanation of quantum computing.',
});

for await (const delta of textStream) {
  process.stdout.write(delta);
}
```

### Verification and Trust

All 0G Compute Network models run in Trusted Execution Environments (TEE) using TeeML technology, which provides:

- **Computational Integrity**: Cryptographic proof that computations were performed correctly
- **Data Privacy**: Input and output data is protected during processing
- **Transparency**: Verifiable execution without revealing sensitive information
- **Decentralization**: Distributed across multiple independent providers

### Performance Characteristics

| Model | Latency | Throughput | Context Length | Best Use Cases |
|-------|---------|------------|----------------|----------------|
| `0g/llama-3.3-70b-instruct` | Medium | High | 8K tokens | General chat, creative writing, code generation |
| `0g/deepseek-r1-70b` | Medium-High | Medium | 8K tokens | Complex reasoning, math, analysis, debugging |

### Pricing and Availability

0G Compute Network models are available through OpenRouter's standard pricing model. Check [openrouter.ai/models](https://openrouter.ai/models) for current pricing information.

The decentralized nature of the 0G network often provides competitive pricing compared to centralized alternatives while maintaining high availability through distributed infrastructure.

## Other Supported Models

For a complete list of all supported models including OpenAI, Anthropic, Google, Meta, and other providers, visit [openrouter.ai/models](https://openrouter.ai/models).

Popular model families include:

- **OpenAI**: GPT-4, GPT-3.5, GPT-4 Turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Haiku, Claude 3 Opus  
- **Google**: Gemini Pro, Gemini Flash
- **Meta**: Llama 2, Llama 3, Code Llama
- **Mistral**: Mistral 7B, Mixtral 8x7B, Mistral Large
- **And many more...**

## Tool Support

Many models support function calling and tool use. Check the [tool-supported models list](https://openrouter.ai/models?order=newest&supported_parameters=tools) for models compatible with the AI SDK's tool functionality.

Both 0G Compute models support tool calling for enhanced functionality:

```typescript
import { openrouter } from '@openrouter/ai-sdk-provider';
import { generateText, tool } from 'ai';
import { z } from 'zod';

const { text } = await generateText({
  model: openrouter('0g/llama-3.3-70b-instruct'),
  prompt: 'What is the weather like in San Francisco?',
  tools: {
    getWeather: tool({
      description: 'Get the current weather for a location',
      parameters: z.object({
        location: z.string().describe('The city and state'),
      }),
      execute: async ({ location }) => {
        // Implementation would call a weather API
        return `The weather in ${location} is sunny and 72°F`;
      },
    }),
  },
});
```
