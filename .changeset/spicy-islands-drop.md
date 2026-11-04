---
'@openrouter/ai-sdk-provider': patch
---

Report a stream that ends before a tool call's arguments are complete as an error that keeps the raw arguments, instead of finishing with an empty `{}` tool call.

Behaviour change: a stream is only treated as complete when it carries a `finish_reason` or a usage chunk. Against non-OpenRouter OpenAI-compatible endpoints in the default `compatible` mode (where `include_usage` is not sent), a no-argument tool call (empty `arguments`) that arrives with no `finish_reason` and no usage chunk is now reported as an error instead of a `{}` tool call.
