---
"@openrouter/ai-sdk-provider": patch
---

Fix tool calls missing arguments field causing AI_TypeValidationError

When using Anthropic Claude models through OpenRouter, parameterless tool calls would fail validation because the `arguments` field was missing from the response. The non-streaming schema now accepts optional arguments, and a fallback to `'{}'` is applied during response processing.
