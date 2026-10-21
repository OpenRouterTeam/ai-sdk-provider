---
'@openrouter/ai-sdk-provider': minor
---

Add `openrouter.decisionModel()` as the preferred name for the Decisions API model. It shares one implementation with `evaluationModel()`, which is kept as the AI SDK-compatible name (the AI SDK calls `evaluationModel()` when resolving string model IDs through a default provider).
