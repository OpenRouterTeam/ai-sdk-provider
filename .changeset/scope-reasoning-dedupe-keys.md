---
'@openrouter/ai-sdk-provider': patch
---

Fix multi-turn `reasoning_details` dedupe dropping distinct blocks: keys are now scoped by detail type, signed `reasoning.text` blocks are keyed by signature (so identical text with different signatures is kept), and Gemini encrypted details are keyed by data (so a reused tool-call-derived id no longer drops a later turn's signature). Repeated OpenAI `rs_` items are still deduplicated by id. Mirrors the OpenRouter API's tracker.
