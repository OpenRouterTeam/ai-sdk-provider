---
'@openrouter/ai-sdk-provider': patch
---

Report a stream that ends before a tool call's arguments are complete as an error that keeps the raw arguments, instead of finishing with an empty `{}` tool call.
