---
'@openrouter/ai-sdk-provider': minor
---

Add `openrouter.evaluationModel()` backed by the OpenRouter Decisions API, so `experimental_evaluate` from `ai@7.0.103+` runs boolean, choice, and score questions through OpenRouter. Probabilities are mapped onto the AI SDK answer shapes, and per-answer confidence, score legends, and cost are exposed under `providerMetadata.openrouter`.
