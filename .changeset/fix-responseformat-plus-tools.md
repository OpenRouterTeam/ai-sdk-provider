---
"@openrouter/ai-sdk-provider": patch
---

Fix responseFormat and tools working together

Previously, when both `responseFormat` (with a JSON schema) and `tools` were provided to `doGenerate` or `doStream`, the tools would be silently ignored due to an early return in the `getArgs` method. Now both options work correctly together.

Thanks to @soksx for identifying and proposing the fix in #175.
