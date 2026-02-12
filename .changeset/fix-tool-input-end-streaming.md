---
"@openrouter/ai-sdk-provider": patch
---

Fix missing `tool-input-end` event in multi-chunk and flush tool call streaming paths

The multi-chunk tool call merge path and the flush path for unsent tool calls were missing the `tool-input-end` event before emitting `tool-call`. This diverged from the stream event protocol used by `@ai-sdk/openai`, which consistently emits `tool-input-start → tool-input-delta → tool-input-end → tool-call`.

The flush path for unsent tool calls also now emits the full `tool-input-start → tool-input-delta → tool-input-end` sequence before `tool-call`, matching the reference implementation.
