---
"@openrouter/ai-sdk-provider": patch
---

Support `cache_control` (and camelCase `cacheControl`) on a tool's `providerOptions`, in both the `openrouter` and `anthropic` namespaces — mirroring how `convertToOpenRouterChatMessages`' `getCacheControl` already resolves *message*-level cache_control from both namespaces, so tools and messages behave consistently. Anthropic-family models cache tool/function definitions the same way they cache message content, but there was previously no way to attach a cache breakpoint to a tool — the tools array was always sent uncached on every request. Passing `providerOptions: { openrouter: { cache_control: { type: 'ephemeral' } } }` (or `{ anthropic: { cacheControl: { type: 'ephemeral' } } }`) on a tool now attaches `cache_control` to that tool's entry in the outgoing `tools` array; `openrouter` wins if both are set.
