---
'@openrouter/ai-sdk-provider': patch
---

Stop emitting `tool-input-delta` for a streamed tool call after its `tool-input-end` and `tool-call` were sent. Trailing deltas (for example a `"\n"`) previously flipped the AI SDK UI tool part back to `input-streaming`.
