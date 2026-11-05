---
'@openrouter/ai-sdk-provider': patch
---

Chat and completion models now shallow merge `provider` routing preferences instead of replacing them, matching the image model. Precedence, lowest to highest, is model `provider` settings (chat only), provider `extraBody.provider`, model `extraBody.provider`, then `providerOptions.openrouter.provider`. Non-object values such as `null` are ignored. Behavior change: a runtime `providerOptions.openrouter.provider` no longer drops configured keys it does not set. To remove a configured key, set it explicitly in the runtime object.
