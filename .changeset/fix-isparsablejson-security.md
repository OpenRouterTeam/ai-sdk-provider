---
"@openrouter/ai-sdk-provider": patch
---

fix: defer tool call finalization to flush() to prevent premature execution on parsable partial JSON

- Removed inline `isParsableJson` checks from streaming tool call handlers that could prematurely finalize tool calls when partial JSON happened to be valid (e.g., `{"query":"test"}` is valid but incomplete if full object is `{"query":"test","limit":10}`)
- All tool call finalization now occurs in `flush()` after the stream is fully consumed
- Raw arguments are passed through instead of being coerced to `'{}'`, enabling the AI SDK's `experimental_repairToolCall` callback (fixes #74)
- Added empty-string guard to skip meaningless no-op deltas for initial chunks with empty arguments
