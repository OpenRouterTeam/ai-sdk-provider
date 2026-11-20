---
"@openrouter/ai-sdk-provider": patch
---

Validate `cacheControl` / `cache_control` from `providerOptions` before sending it. Only `{ type: 'ephemeral', ttl?: '5m' | '1h' }` is forwarded; invalid values such as `{ type: 'bogus' }`, `'yes'`, `0`, `''`, `null` or `[]` are now dropped at the tool, part and message level instead of reaching the request body. Sources are checked in order (`openrouter.cacheControl`, `openrouter.cache_control`, `anthropic.cacheControl`, `anthropic.cache_control`) and the first valid one wins, so an empty or invalid `openrouter.cacheControl` no longer hides a valid `anthropic.cacheControl`.
