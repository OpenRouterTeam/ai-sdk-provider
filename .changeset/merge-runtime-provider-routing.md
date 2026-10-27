---
'@openrouter/ai-sdk-provider': patch
---

Merge runtime `providerOptions.openrouter.provider` with configured provider routing preferences in the chat, completion and reranking models instead of replacing them, matching the image model (#587). Provider objects are shallow merged in the same precedence as the rest of the request body (`settings.provider`, factory `extraBody.provider`, model `extraBody.provider`, then runtime), so a runtime key still overrides the same configured key, but configured keys it does not set (such as `allow_fallbacks` or `sort`) are no longer dropped.
