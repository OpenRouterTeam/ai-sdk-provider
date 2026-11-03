---
"@openrouter/ai-sdk-provider": patch
---

Fix unhandled `AbortError` rejection when a streaming response is cancelled after its source has already errored (e.g. an aborted fetch)
