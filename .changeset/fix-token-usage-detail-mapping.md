---
"@openrouter/ai-sdk-provider": patch
---

Compute missing token usage detail fields from available API data

Previously, `inputTokens.noCache`, `outputTokens.text`, and `inputTokens.cacheWrite` were always `undefined`, even when the data to compute them was available in the API response. This caused downstream dashboards and analytics to receive misleading values.

Now the provider computes these fields:
- `inputTokens.noCache` = `total - cacheRead` (non-cached input tokens)
- `outputTokens.text` = `total - reasoning` (text output tokens)
- `inputTokens.cacheWrite` = passthrough from `cache_write_tokens` when available

This applies to all code paths: chat `doGenerate`, chat `doStream`, completion `doGenerate`, and completion `doStream`.
