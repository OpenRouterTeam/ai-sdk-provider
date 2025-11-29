# OpenRouter Next.js Chat Example

This example demonstrates how to build a streaming chat experience in Next.js using the
[`@openrouter/ai-sdk-provider`](https://www.npmjs.com/package/@openrouter/ai-sdk-provider)
and the Vercel AI SDK. The UI lets you:

- pick an OpenRouter model
- toggle tool usage on or off
- watch streaming assistant replies
- inspect tool invocations and their inputs/outputs in real time

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   pnpm --filter @openrouter/examples-next-chat dev
   ```

   > **Note:** the example is part of the monorepo. You can also `cd examples/next-chat`
   > and run `pnpm install` followed by `pnpm dev`.

2. Copy the example environment file and add your OpenRouter key:

   ```bash
   cp examples/next-chat/.env.local.example examples/next-chat/.env.local
   ```

   At minimum you need `OPENROUTER_API_KEY`. Set `OPENROUTER_BASE_URL` if you proxy requests.

3. Start the development server:

   ```bash
   pnpm --filter @openrouter/examples-next-chat dev
   ```

   Visit `http://localhost:3000` to try the chat experience.

## How It Works

- `app/api/chat/route.ts` configures the OpenRouter provider, streams responses with tools, and
  returns AI SDK UI message streams.
- `app/page.tsx` implements a small client-side state machine that consumes the stream, renders
  messages, and keeps track of tool invocations.
- `lib/tools.ts` defines two sample tools (`getCurrentWeather` and `getCurrentTime`). You can add
  your own tools or wire in real data sources.

This example is intentionally lightweight so you can adapt it for your own projects.
