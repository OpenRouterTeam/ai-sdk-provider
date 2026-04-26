---
"@openrouter/ai-sdk-provider": patch
---

fix: stop emitting duplicate `tool-call` events when a trailing-whitespace argument delta arrives after a complete tool call

In the streaming chat handler, the merge-into-existing-tool-call path enqueues a `tool-call` stream event whenever the accumulated `function.arguments` is parsable JSON. Because `JSON.parse` accepts trailing whitespace, any subsequent argument delta for the same tool-call `index` (e.g. a stray space, newline, or closing-token chunk) leaves the arguments parsable and would re-trigger the emit, producing a second `tool-call` event with the same `toolCallId`. Downstream tool runners (e.g. Vercel AI SDK `streamText`) then execute the tool twice. Observed in production with `moonshotai/kimi-k2.6` via OpenRouter, where the user-visible effect was every outbound message being delivered twice.

**`src/chat/index.ts`:**

- Merge-path `tool-call` emit is now gated on `!toolCall.sent`, mirroring the new-path behavior. The `sent` flag was already being set after the first emit but was never read on this path.

**`src/chat/index.test.ts`:**

- Adds a regression test that streams a complete tool call followed by a trailing-whitespace-only argument delta for the same `index` and asserts exactly one `tool-call` event is emitted.
