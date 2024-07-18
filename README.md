# OpenRouter Provider for Vercel AI SDK

The OpenRouter provider for the [Vercel AI SDK](https://sdk.vercel.ai/docs)
contains language model support for the OpenRouter chat and completion APIs.

## Setup

The OpenRouter provider is available in the `@ai-sdk/openrouter` module. You can install it with

```bash
npm i @ai-sdk/openrouter
```

## Provider Instance

You can import the default provider instance `openrouter` from `@ai-sdk/openrouter`:

```ts
import { openrouter } from "@ai-sdk/openrouter";
```

## Example

```ts
import { openrouter } from "@ai-sdk/openrouter";
import { generateText } from "ai";

const { text } = await generateText({
  model: openrouter("gpt-4-turbo"),
  prompt: "Write a vegetarian lasagna recipe for 4 people.",
});
```
