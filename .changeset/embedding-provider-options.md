---
'@openrouter/ai-sdk-provider': patch
---

Forward call-time `providerOptions.openrouter` in the embedding model (`embed` / `embedMany`). Options such as `provider`, `user`, `dimensions` and `input_type` were previously ignored. Provider routing preferences are now shallow merged from model settings, `extraBody` and `providerOptions` (later wins) instead of `extraBody.provider` replacing `settings.provider` (related to #616).
