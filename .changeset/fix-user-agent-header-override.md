---
"@openrouter/ai-sdk-provider": patch
---

fix: respect user-specified User-Agent headers without modification

Previously, when users provided a custom `User-Agent` header via `createOpenRouter({ headers: { 'User-Agent': 'my-app/1.0' } })`, the SDK would append its identifier to the header, resulting in `my-app/1.0, ai-sdk/openrouter/x.x.x`. This was unexpected behavior.

Now, user-specified `User-Agent` headers are used verbatim without modification. The SDK identifier is only added as the default when no `User-Agent` header is provided.

This also fixes a case-sensitivity bug where `User-Agent` (capitalized) was not recognized as the same header as `user-agent` (lowercase), causing duplicate headers to be sent.

Fixes #300
