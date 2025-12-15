---
"@openrouter/ai-sdk-provider": patch
---

Remove TOON encoding/decoding helper functions

BREAKING CHANGE: Removes @toon-format/toon dependency and related exports (encodeToon, decodeToon, ToonEncodeOptions, ToonDecodeOptions, JsonValue). Users who were using these helpers should import directly from @toon-format/toon instead.
