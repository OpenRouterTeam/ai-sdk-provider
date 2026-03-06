---
'@openrouter/ai-sdk-provider': patch
---

fix: infer tool-calls finishReason and populate usage from providerMetadata fallback (#419, #420)

- When finishReason is 'other' (unknown/missing) but tool calls are present, infer 'tool-calls' so agentic loops continue correctly
- When standard usage object is unpopulated but openrouterUsage has data, populate usage from openrouterUsage as fallback
- Fixes both streaming (doStream) and non-streaming (doGenerate) paths
