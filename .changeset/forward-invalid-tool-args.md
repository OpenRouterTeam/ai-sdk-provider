---
'@openrouter/ai-sdk-provider': patch
---

Forward complete-but-invalid streamed tool arguments to the AI SDK instead of replacing them with `'{}'` in the stream flush path. The SDK can now surface the model's real payload via `InvalidToolInputError` and run `experimental_repairToolCall`; `'{}'` is only substituted when nothing was streamed (no-argument tool calls).
