---
'@openrouter/ai-sdk-provider': minor
---

Implement `rerankingModel` on the provider. `createOpenRouter()` and the default `openrouter` instance now expose `rerankingModel(modelId, settings?)`, which calls the OpenRouter `/rerank` endpoint and works with the AI SDK `rerank()` function. Previously the method existed in the typings but was undefined at runtime.
