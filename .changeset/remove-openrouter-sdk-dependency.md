---
"@openrouter/ai-sdk-provider": minor
---

Remove dependency on @openrouter/sdk

This change removes the external dependency on `@openrouter/sdk` by inlining the necessary type definitions locally. The types are now defined in `src/types/openrouter-api-types.ts`.

This reduces the package's dependency footprint and eliminates potential version conflicts with the SDK.

