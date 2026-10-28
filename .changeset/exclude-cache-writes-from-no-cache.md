---
'@openrouter/ai-sdk-provider': patch
---

Exclude cache-write tokens from `usage.inputTokens.noCache`, so `noCache + cacheRead + cacheWrite` matches `total` when `prompt_tokens_details.cache_write_tokens` is reported
