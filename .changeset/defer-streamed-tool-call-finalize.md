---
"@openrouter/ai-sdk-provider": patch
---

Finalize streamed tool calls only once the stream completes. Previously a `tool-call` was emitted as soon as the accumulated arguments happened to parse as JSON, so an upstream that closed the root object early (valid JSON prefix followed by more fragments) produced a silently truncated tool call followed by stray `tool-input-delta` parts. Tool calls are now emitted at the end of the stream with their full arguments, so malformed input reaches the AI SDK's tool-call error handling and `experimental_repairToolCall`. Every tool call is still emitted exactly once, including when the stream ends without a `finish_reason`.
