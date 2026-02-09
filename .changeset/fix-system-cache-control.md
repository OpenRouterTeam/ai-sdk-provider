---
"@openrouter/ai-sdk-provider": minor
---

Fix system message cache control to use block-level format

When cache control is specified on a system message via `providerOptions`, the content is now converted to array format with `cache_control` on the text block, matching the existing behavior for user messages. This ensures consistent Anthropic prompt caching behavior across all message types.

Before (message-level cache_control):
```json
{ "role": "system", "content": "...", "cache_control": { "type": "ephemeral" } }
```

After (block-level cache_control):
```json
{ "role": "system", "content": [{ "type": "text", "text": "...", "cache_control": { "type": "ephemeral" } }] }
```

Fixes #389
