---
'@openrouter/ai-sdk-provider': patch
---

Fix `decisionModel()` / `evaluationModel()` type errors with the latest `ai` (7.0.148 and later), which made question `instructions` optional and nullable and added `box` questions. The Decisions API requires `instructions`, so a question without them now throws an `InvalidArgumentError` before any request is sent, instead of being sent as `"instructions": null`. `box` questions are not supported yet.

Known limitation of the state-part handling added in #577: with `ai` releases older than 7.0.133, a raw array state whose every element is shaped like a state part (`{ type: 'text', text }`, `{ type: 'json', value }` or a file part) is unwrapped as if the SDK had produced it.
