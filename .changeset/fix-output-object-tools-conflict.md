---
'@openrouter/ai-sdk-provider': patch
---

Prevent response_format conflict with tools. When both Output.object() and tools are present, the SDK now omits response_format from the request body to avoid models dumping tool call arguments as plain text instead of structured tool_calls.
