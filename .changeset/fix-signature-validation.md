---
"@openrouter/ai-sdk-provider": patch
---

fix: strip reasoning.text entries without valid signatures (#423/#439)

When reasoning_details exist but reasoning.text entries lack a signature (lost during custom pruning, DB serialization, or model switching), Anthropic rejects with "Invalid signature in thinking block". This adds validation to filter out signatureless reasoning.text entries before sending to the API.
