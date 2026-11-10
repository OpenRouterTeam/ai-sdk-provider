---
"@openrouter/ai-sdk-provider": minor
---

Declare `@ai-sdk/provider` and `@ai-sdk/provider-utils` as optional `peerDependencies` (#621). The published type declarations import both, but they were undeclared, so under strict layouts (pnpm with `hoist=false` or the global virtual store) the imports failed with `TS2307` or silently degraded provider types to `any`.

As optional peers, the type imports now resolve to the exact `@ai-sdk/provider` / `@ai-sdk/provider-utils` copies that your installed `ai` version pins, so `generateText({ model: openrouter.chat(...) })` and friends type-check with `skipLibCheck: false` on every supported `ai` version (`^7.0.0`; checked against 7.0.0, 7.0.103 and latest) under npm, pnpm (isolated, hoisted, global virtual store) and pnpm with `auto-install-peers=false`. You do not need to install either package yourself; `ai` already brings them. The runtime JS still bundles both packages, so runtime behavior is unchanged.
