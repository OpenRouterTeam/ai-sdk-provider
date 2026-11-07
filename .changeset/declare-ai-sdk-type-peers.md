---
'@openrouter/ai-sdk-provider': patch
---

Declare `@ai-sdk/provider` and `@ai-sdk/provider-utils` as optional peer dependencies so the published type declarations resolve under strict package managers (e.g. pnpm with `hoist=false`). Previously `tsc` reported TS2307 for these imports, or with `skipLibCheck` silently typed model members as `any`. Runtime code is still bundled, so the JS output is unchanged.
