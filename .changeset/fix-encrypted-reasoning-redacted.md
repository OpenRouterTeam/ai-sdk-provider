---
"@openrouter/ai-sdk-provider": patch
---

Stop emitting `[REDACTED]` as visible reasoning text for encrypted reasoning details. Encrypted reasoning blobs are opaque data used for multi-turn conversation roundtripping and are already preserved in `providerMetadata.openrouter.reasoning_details`. Previously, the SDK created confusing `[REDACTED]` reasoning content parts for these details; they are now silently skipped while remaining fully available in provider metadata.
