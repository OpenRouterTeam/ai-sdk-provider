---
'@openrouter/ai-sdk-provider': patch
---

Fix `decisionModel()` / `evaluationModel()` with `ai` 7.0.133 and later, which wrap decision state in typed parts that were forwarded to the Decisions API as-is. Text and json parts are now unwrapped and image file parts are sent as `image_url` entries, while raw state from older `ai@7` releases is passed through unchanged.
