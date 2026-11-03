---
'@openrouter/ai-sdk-provider': minor
---

Chat and completion models now shallow merge `provider` routing preferences instead of replacing them, matching the image model (#551). Plain-object `provider` values are merged in precedence order `settings.provider` < `extraBody.provider` (provider-level) < `extraBody.provider` (model-level) < `providerOptions.openrouter.provider`; `null` and array values are ignored. Fixes #587.

**Behavior change:** a call-time `providerOptions.openrouter.provider` no longer wholesale replaces the configured provider routing. For example, a model configured with `provider: { order: ['google'], allow_fallbacks: false, sort: 'price' }` and called with `providerOptions.openrouter.provider = { order: ['anthropic'] }` now sends `{ order: ['anthropic'], allow_fallbacks: false, sort: 'price' }`. To drop a configured key at call time, override it explicitly (e.g. `allow_fallbacks: true`).
