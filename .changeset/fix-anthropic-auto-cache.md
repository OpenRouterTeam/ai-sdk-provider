---
'@openrouter/ai-sdk-provider': minor
---

feat: add explicit cache_control support for Anthropic automatic prompt caching (#424)

- Added `cache_control` field to `OpenRouterChatSettings` for typed, discoverable configuration
- Supports both `cache_control` (snake_case) and `cacheControl` (camelCase) in `providerOptions.openrouter`
- Enables Anthropic automatic caching via top-level request body directive
