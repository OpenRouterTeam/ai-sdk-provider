---
'@openrouter/ai-sdk-provider': patch
---

Map the `error` finish reason to the AI SDK `error` finish reason instead of `other`. A response that ends with `error` and contains tool calls is no longer reported as `tool-calls`, so the AI SDK does not execute those tool calls and a multi-step loop stops at that step.
