---
"@openrouter/ai-sdk-provider": minor
---

Update zod peerDependency from "^3.24.1 || ^v4" to "^3.25.0 || ^4.0.0". This fixes TypeScript errors ("Cannot find module 'zod/v3'") that occur when users have Zod < 3.25.0 installed, as the subpath exports (zod/v3, zod/v4) were only added in Zod 3.25.0.
