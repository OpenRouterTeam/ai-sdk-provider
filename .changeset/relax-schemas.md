---
"@openrouter/ai-sdk-provider": patch
---

Relax zod schemas with passthrough to allow unexpected API fields

Add `.passthrough()` to all zod object schemas to prevent validation failures when the API returns extra fields not in our schema definitions. This ensures forward compatibility with API changes and prevents breaking when new fields are added to responses.
