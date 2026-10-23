---
'@openrouter/ai-sdk-provider': patch
---

Keep the `ai-sdk/openrouter/<version>` user agent identifier on requests made through the AI SDK (`generateText`, `embed`, `generateImage`, and so on). The AI SDK sends its own `user-agent` call header, which used to replace the provider identifier. The identifier is now appended to it, so requests carry both `ai/<version>` and `ai-sdk/openrouter/<version>`. A `User-Agent` set in `createOpenRouter({ headers })` is still not modified.
