---
'@openrouter/ai-sdk-provider': minor
---

Support signed image URL responses (`data[].url`, `data[].media_type`, and `expires_at`) in `imageModel()`, downloading image bytes into `Uint8Array` outputs and exposing per-image `url`, `mediaType`, and `expiresAt` in `providerMetadata.openrouter.images`.
