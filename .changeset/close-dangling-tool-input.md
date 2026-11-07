---
'@openrouter/ai-sdk-provider': patch
---

Emit `tool-input-end` for streamed tool calls that started but never completed when the stream finishes with a reason other than `tool-calls` (e.g. `length` or `stop`), so every `tool-input-start` has a matching end. No `tool-call` is emitted for the incomplete arguments.
