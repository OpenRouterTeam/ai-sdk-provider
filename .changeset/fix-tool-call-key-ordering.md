---
"@openrouter/ai-sdk-provider": patch
---

Fix non-deterministic JSON serialization of tool call arguments that broke prompt caching

When the AI SDK deserializes and re-serializes tool call arguments across turns, the key insertion order may change. `JSON.stringify()` follows insertion order, so semantically identical objects could produce different strings, causing cache misses. This adds a recursive key-sorting utility (`deterministicStringify`) to ensure consistent serialization regardless of key order.
