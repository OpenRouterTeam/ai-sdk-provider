---
"@openrouter/ai-sdk-provider": patch
---

Declare `@ai-sdk/provider` and `@ai-sdk/provider-utils` as `dependencies`. The published type declarations import from both, but they were only devDependencies, so consumers' types silently degraded to `any` or bound to an arbitrary hoisted copy depending on the package manager layout (#621). Both packages are now external in the runtime bundle as well, so the JS and the types resolve the same copy and dedupe with the one used by `ai`.
