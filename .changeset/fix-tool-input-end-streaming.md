---
'@openrouter/ai-sdk-provider': patch
---

fix: emit tool-input-end events in streaming tool call lifecycle

Fixes three gaps in the tool call streaming event lifecycle:

1. **Multi-chunk merge path**: When tool call arguments arrive across multiple SSE chunks, the `tool-input-end` event was missing before the `tool-call` event. Now emits the complete lifecycle: `tool-input-start → tool-input-delta(s) → tool-input-end → tool-call`.

2. **Flush path**: When unsent tool calls are forwarded at stream end, the full `tool-input-start → tool-input-delta → tool-input-end` sequence was missing. Now checks `inputStarted` to emit either the full lifecycle (never streamed) or just `tool-input-end` (partially streamed).

3. **Initial chunk arguments**: When the first chunk of a multi-chunk tool call includes partial arguments (e.g. `{"q`), those arguments were silently dropped instead of being emitted as a `tool-input-delta`. Now emits the initial arguments as a delta immediately after `tool-input-start`.
