---
'@openrouter/ai-sdk-provider': patch
---

fix: preserve reasoning_details with `bedrock-openai-responses-v1`, `bedrock-xai-responses-v1`, `meta-responses-v1` and unrecognised future formats instead of dropping them at parse time
