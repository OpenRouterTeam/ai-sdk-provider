---
'@openrouter/ai-sdk-provider': patch
---

Serializing a chat or completion model for `@ai-sdk/workflow` no longer loads the API key, so it works when `OPENROUTER_API_KEY` is not set where the workflow runs. The API key was never persisted. Restored models still read `OPENROUTER_API_KEY` at request time and fail with a clear error if it is missing.
