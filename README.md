# OpenRouter Provider for Vercel AI SDK

The OpenRouter provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs)
contains 160+ language model support for the OpenRouter chat and completion APIs.

## Setup

```bash
npm install https://github.com/OpenRouterTeam/openrouter-ai-provider.git
```

## Provider Instance

You can import the default provider instance `openrouter` from `openrouter-ai-provider`:

```ts
import { openrouter } from "openrouter-ai-provider";
```

## Example

```ts
import { openrouter } from "openrouter-ai-provider";
import { generateText } from "ai";

const { text } = await generateText({
  model: openrouter("openai/gpt-4o"),
  prompt: "Write a vegetarian lasagna recipe for 4 people.",
});
```
