---
"@openrouter/ai-sdk-provider": minor
---

Add includeRawChunks support for streaming

When `includeRawChunks: true` is passed to streaming calls, the provider now emits `{ type: 'raw', rawValue: <parsed chunk> }` stream parts for each SSE event, giving consumers access to the raw provider chunks alongside the processed AI SDK stream parts.

This feature is available for both chat and completion models.
