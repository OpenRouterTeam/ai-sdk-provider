---
'@openrouter/ai-sdk-provider': patch
---

Fix response_format and tools coexistence. Both response_format and tools are now sent together in the request body, matching the behavior of @ai-sdk/openai. This ensures Output.object() + tools multi-step workflows produce valid structured JSON in the final response. Models that conflict with both fields should be handled at the API adapter layer.
