---
'@openrouter/ai-sdk-provider': patch
---

Download authenticated video outputs before returning them to AI SDK Core.

The provider now downloads generated video content itself (sending the API key only to the configured OpenRouter origin) and returns the bytes, so the AI SDK `download` option of `experimental_generateVideo` (including the `maxBytes` limit of `createDownload`) no longer applies to OpenRouter videos.
