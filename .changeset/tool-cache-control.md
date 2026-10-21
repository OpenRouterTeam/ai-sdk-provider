---
"@openrouter/ai-sdk-provider": patch
---

Support `cache_control` on a tool's `providerOptions` (`openrouter` or `anthropic` namespace, snake_case or camelCase, same resolution as message-level cache control). It is now attached to that tool's entry in the outgoing `tools` array.
