---
'@openrouter/ai-sdk-provider': patch
---

Fix message-level cache_control being applied to all content parts instead of only the last text part, which could exceed Anthropic's 4-segment cache control limit.
