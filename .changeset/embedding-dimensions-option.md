---
'@openrouter/ai-sdk-provider': patch
---

Forward the AI SDK `dimensions` call option of `embed` / `embedMany` to the `/embeddings` request. It was dropped, so the model returned its default vector size. `providerOptions.openrouter.dimensions` still takes precedence.
