---
"@openrouter/ai-sdk-provider": patch
---

Fix token details in providerMetadata to only be included when present in API response. Previously, `promptTokensDetails` and `completionTokensDetails` were always included with default values of 0, which could be misleading. Now they are only included when the API actually returns these details, matching the behavior of `costDetails`.
