---
'@openrouter/ai-sdk-provider': patch
---

fix: infer tool-calls finishReason when tool calls present but finish_reason is unknown (#420)

- When finishReason is 'other' (unknown/missing) but tool calls are present, infer 'tool-calls' so agentic loops continue correctly
- Fixes both streaming (doStream) and non-streaming (doGenerate) paths
