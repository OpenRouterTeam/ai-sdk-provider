---
'@openrouter/ai-sdk-provider': patch
---

Preserve reasoning details that have no visible text (e.g. `reasoning.encrypted`) across turns. When no reasoning part or tool call carries them, `doStream` and `doGenerate` now emit an empty reasoning part whose `providerMetadata.openrouter.reasoning_details` holds them, so the AI SDK keeps them in the assistant message and they are sent back on the next request. In `doGenerate` the first reasoning part now carries the full `reasoning_details` array (as the streamed reasoning part already does), so encrypted details next to a summary are no longer dropped in text-only steps.
