---
"@openrouter/ai-sdk-provider": patch
---

Support `cache_control` on a tool's `providerOptions` (`openrouter` or `anthropic` namespace, snake_case or camelCase, same resolution as message-level cache control). It is now attached to that tool's entry in the outgoing `tools` array.

Tool-level `cache_control` is passed through as-is. OpenRouter does not document it for the OpenAI-format `tools` array; Anthropic supports it on the last tool definition, so place the breakpoint there. `OpenRouterCacheControl` now also types the optional `ttl` (`'5m' | '1h'`), which was already passed through.
