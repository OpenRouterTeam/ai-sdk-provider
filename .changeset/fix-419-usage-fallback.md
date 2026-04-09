---
"@openrouter/ai-sdk-provider": patch
---

fix: add defensive usage fallback in streaming flush handler (#419)

When the standard usage object has undefined totals but openrouterUsage
has valid token data, the flush handler now copies values from
openrouterUsage as a fallback. This ensures usage.inputTokens.total and
usage.outputTokens.total are populated even when providers deliver usage
data in non-standard chunk formats.
