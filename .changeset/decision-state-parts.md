---
'@openrouter/ai-sdk-provider': patch
---

Send the caller's state to the Decisions API when used with `ai` 7.0.133 or later. Those releases normalize decision state into typed parts before calling a provider, and the model forwarded that wrapper as the state, so `{ ticket: '...' }` reached the API as `[{ "type": "json", "value": { "ticket": "..." } }]`. Text and json parts are now unwrapped, image file parts are sent as `image_url` entries, other files are rejected with `UnsupportedFunctionalityError`, and raw state from older `ai@7` releases is passed through unchanged. This also makes `decisionModel()` / `evaluationModel()` type-check against `experimental_decide` on those releases.
