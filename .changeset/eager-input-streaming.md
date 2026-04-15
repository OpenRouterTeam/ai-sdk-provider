---
"@openrouter/ai-sdk-provider": minor
---

feat: support Anthropic eager_input_streaming parameter via tool providerOptions

Tools can now pass `eager_input_streaming: true` through `providerOptions.openrouter.eager_input_streaming` to enable Anthropic's fine-grained tool streaming, reducing latency for large tool outputs.
