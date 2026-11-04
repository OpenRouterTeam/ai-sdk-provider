---
'@openrouter/ai-sdk-provider': minor
---

Chat and completion models now shallow merge `provider` routing preferences instead of replacing them, matching the image model (#551) and embedding model (#632). Fixes #587.

Plain-object `provider` values are merged in ascending precedence order (later wins):

- Chat: `settings.provider` < factory `extraBody.provider` < model `extraBody.provider` < `providerOptions.openrouter.provider`.
- Completion: factory `extraBody.provider` < model `extraBody.provider` < `providerOptions.openrouter.provider` (completion settings have no typed `provider` field).

The merge is shallow: only top-level keys are combined. Nested values are replaced, not merged, so arrays such as `order`, `only` and `ignore` and objects such as `max_price` come from the highest-precedence source that sets them. For example, configured `{ only: ['a', 'b'], ignore: ['c'] }` plus call-time `{ only: ['c'] }` sends `{ only: ['c'], ignore: ['c'] }`. Non-object values (arrays, primitives, and `null` outside of `providerOptions`) are ignored and never sent as `provider`.

**Behavior change:** a call-time `providerOptions.openrouter.provider` no longer wholesale replaces the configured routing. A model configured with `provider: { order: ['google'], allow_fallbacks: false, sort: 'price' }` and called with `providerOptions.openrouter.provider = { order: ['anthropic'] }` now sends `{ order: ['anthropic'], allow_fallbacks: false, sort: 'price' }`. To change a configured key at call time, set it explicitly (e.g. `allow_fallbacks: true`). To drop all configured routing for one call, pass `providerOptions.openrouter.provider = null`, which omits `provider` from the request entirely.

**Behavior change (image and embedding):** `providerOptions.openrouter.provider = null` previously was ignored by the image model (since #551) and the embedding model (since #632), keeping the configured routing. It now clears provider routing for that call, consistent with chat and completion. Non-object `extraBody.provider` values are also no longer forwarded by the image model.
