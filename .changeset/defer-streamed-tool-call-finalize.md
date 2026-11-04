---
"@openrouter/ai-sdk-provider": patch
---

Finalize streamed tool calls only once the stream completes. Previously a `tool-call` was emitted as soon as the accumulated arguments happened to parse as JSON, so an upstream that closed the root object early (valid JSON prefix followed by more fragments) produced a silently truncated tool call followed by stray `tool-input-delta` parts. Tool calls are now emitted at the end of the stream with their full arguments, so malformed input reaches the AI SDK's tool-call error handling and `experimental_repairToolCall`. Every tool call is still emitted exactly once, including when the stream ends without a `finish_reason`.

Timing change: `tool-input-start` / `tool-input-delta` still stream as arguments arrive, but the `tool-input-end` and `tool-call` parts (and therefore a tool's `onInputAvailable` callback and the UI `tool-input-available` state) now fire at the end of the model stream rather than mid-stream. With ai@7, tool execution timing is unchanged, since tools already run after the model call ends.

Streamed tool-call parsing is also hardened:

- Tool-call deltas without an `index` are now handled: a delta with a new `id` (or a function name) starts a new tool call, and other deltas continue the most recent one. Previously such tool calls were never emitted.
- A delta that reuses an existing `index` with a different `id` starts a new tool call instead of being concatenated onto the previous one.
- An identical resend of already complete JSON arguments is ignored instead of producing `{"a":1}{"a":1}`.
- Tool calls that are dropped because their arguments are incomplete (e.g. `length` or `error` finish) now get a closing `tool-input-end`, so UI parts do not stay in the input-streaming state.
