---
'@openrouter/ai-sdk-provider': patch
---

Forward per-call `providerOptions.openrouter` into the embeddings request body. The embedding model ignored call options entirely, so `embed({ providerOptions: { openrouter: ... } })` had no effect. A runtime `provider` is merged with the configured routing preferences, like the other models.
