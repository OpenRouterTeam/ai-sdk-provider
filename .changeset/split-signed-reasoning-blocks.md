---
'@openrouter/ai-sdk-provider': patch
---

Fix streaming: keep separately signed `reasoning.text` blocks (e.g. multiple Anthropic thinking blocks in one answer) as separate `reasoning_details` entries instead of merging them under the first signature, which made replay fail with "Invalid signature in thinking block".
