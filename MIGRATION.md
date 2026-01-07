# Migration Guide: v1.x to v6.x

Migrating from `@openrouter/ai-sdk-provider` v1.x (AI SDK 5) to v6.x (AI SDK 6).

## Package Updates

```bash
# Remove old versions
bun remove @openrouter/ai-sdk-provider ai

# Install v6
bun add @openrouter/ai-sdk-provider@6.0.0-alpha.1 ai@^6.0.0
```

**package.json diff:**
```diff
- "ai": "^5.0.0",
- "@openrouter/ai-sdk-provider": "^1.0.0"
+ "ai": "^6.0.0",
+ "@openrouter/ai-sdk-provider": "^6.0.0-alpha.1"
```

## Breaking Changes

### 1. Usage Object Structure

The biggest user-facing change. Usage data is now nested.

**Before (v5):**
```typescript
const { usage } = await generateText({...});

console.log(usage.promptTokens);      // number
console.log(usage.completionTokens);  // number
console.log(usage.totalTokens);       // number
```

**After (v6):**
```typescript
const { usage } = await generateText({...});

console.log(usage.inputTokens.total);      // number
console.log(usage.inputTokens.cached);     // number | undefined
console.log(usage.outputTokens.total);     // number
console.log(usage.outputTokens.reasoning); // number | undefined
console.log(usage.totalTokens);            // number
```

**Migration pattern:**
```typescript
// If you have code like this:
const cost = usage.promptTokens * inputPrice + usage.completionTokens * outputPrice;

// Change to:
const cost = usage.inputTokens.total * inputPrice + usage.outputTokens.total * outputPrice;
```

### 2. Structured Outputs

`generateObject()` is replaced by `generateText()` with an `output` option.

**Before (v5):**
```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

const { object } = await generateObject({
  model: openrouter('openai/gpt-4o'),
  schema: z.object({
    recipe: z.string(),
    ingredients: z.array(z.string()),
  }),
  prompt: 'Generate a recipe for chocolate cake.',
});
```

**After (v6):**
```typescript
import { generateText, Output } from 'ai';
import { z } from 'zod';

const { output } = await generateText({
  model: openrouter('openai/gpt-4o'),
  output: Output.object({
    schema: z.object({
      recipe: z.string(),
      ingredients: z.array(z.string()),
    }),
  }),
  prompt: 'Generate a recipe for chocolate cake.',
});
```

### 3. Interface Versions (Internal)

Only relevant if you're extending provider internals.

| v5 | v6 |
|----|-----|
| `LanguageModelV2` | `LanguageModelV3` |
| `ProviderV2` | `ProviderV3` |
| `specificationVersion: 'v2'` | `specificationVersion: 'v3'` |

**Before (v5):**
```typescript
import type { LanguageModelV2 } from '@ai-sdk/provider';

const model: LanguageModelV2 = openrouter('anthropic/claude-sonnet-4');
```

**After (v6):**
```typescript
import type { LanguageModelV3 } from '@ai-sdk/provider';

const model: LanguageModelV3 = openrouter('anthropic/claude-sonnet-4');
```

## No Changes Required

These APIs work the same in both versions:

### Provider Creation

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter();
// or with API key:
const openrouter = createOpenRouter({ apiKey: 'sk-or-...' });
```

### Basic Generation

```typescript
const { text } = await generateText({
  model: openrouter('anthropic/claude-sonnet-4'),
  prompt: 'Hello!',
});
```

### Streaming

```typescript
const { textStream } = streamText({
  model: openrouter('openai/gpt-4o'),
  prompt: 'Write a haiku.',
});

for await (const chunk of textStream) {
  process.stdout.write(chunk);
}
```

### Provider Metadata

```typescript
const { providerMetadata } = await generateText({
  model: openrouter('anthropic/claude-sonnet-4'),
  prompt: 'Hello!',
});

const openrouterData = providerMetadata?.openrouter;
// { id, model, provider, cost, ... }
```

### Tool Calling

```typescript
const { toolCalls } = await generateText({
  model: openrouter('openai/gpt-4o'),
  tools: {
    weather: tool({
      description: 'Get weather',
      parameters: z.object({ city: z.string() }),
      execute: async ({ city }) => `Sunny in ${city}`,
    }),
  },
  prompt: 'What is the weather in Tokyo?',
});
```

## Checklist

- [ ] Update `package.json` dependencies
- [ ] Find/replace `usage.promptTokens` → `usage.inputTokens.total`
- [ ] Find/replace `usage.completionTokens` → `usage.outputTokens.total`
- [ ] Replace `generateObject()` calls with `generateText()` + `Output.object()`
- [ ] Update any `LanguageModelV2` type annotations to `LanguageModelV3`
- [ ] Run tests

## Links

- [AI SDK 6.0 Announcement](https://vercel.com/blog/ai-sdk-6)
- [OpenRouter Models](https://openrouter.ai/models)
