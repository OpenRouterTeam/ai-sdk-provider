---
'@openrouter/ai-sdk-provider': patch
---

Stop sending call-level `reasoning` as `reasoning.effort` when `reasoning_effort` is set through the provider or model `extraBody`. OpenRouter rejects requests that contain both.
