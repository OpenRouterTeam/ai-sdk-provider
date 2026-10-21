---
'@openrouter/ai-sdk-provider': patch
---

Honour part-level `cacheControl` on assistant text parts instead of silently dropping it, consistent with user messages. When an assistant text part carries cache control, the assistant `content` is sent as an array of text blocks with `cache_control` on that specific block; otherwise the content stays a plain string. Message-level assistant cache control is unchanged (related to #498).
