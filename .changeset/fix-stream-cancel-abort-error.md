---
"@openrouter/ai-sdk-provider": patch
---

Fix unhandled `AbortError` rejection when a streaming response is cancelled after its source has already errored (e.g. an aborted fetch)

Also stop reporting a spurious `Controller is already closed` error through the stream error handler when a stream is cancelled while a read is in flight.
