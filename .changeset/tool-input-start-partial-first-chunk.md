---
'@openrouter/ai-sdk-provider': patch
---

Emit `tool-input-start` for a streamed tool call as soon as its id and name arrive, with the first chunk's arguments as its first `tool-input-delta`, even when those arguments are not yet complete JSON. Previously the start was delayed until the next chunk for that call, and if the stream ended first (for example with finish reason `length`) no tool events were emitted at all.
