---
"@openrouter/ai-sdk-provider": patch
---

File annotations from FileParserPlugin are now available in streaming responses.
If you use `streamText()` with PDFs or other files, you can now access parsed file content via `providerMetadata.openrouter.annotations` in the finish event.
This was already available for non-streaming responses.
