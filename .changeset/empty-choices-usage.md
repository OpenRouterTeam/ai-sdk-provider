---
'@openrouter/ai-sdk-provider': patch
---

Expose the usage of a non-streaming chat response with an empty `choices` array on the thrown `NoContentGeneratedError`. The error still reports "No choice in response", and now also has `usage` (the same shape as `generateText` usage) and `providerMetadata.openrouter` (including `usage.cost`), so the tokens and cost billed for the call can be accounted for. Before, usage was read only after the check, so it was lost.
