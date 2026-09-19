---
'@openrouter/ai-sdk-provider': minor
---

Add `openrouter.evaluationModel()` backed by the OpenRouter Decisions API (`/api/alpha/decisions`), so `experimental_evaluate` from `ai@7.0.103+` runs boolean, choice, and score questions through OpenRouter. Probabilities are mapped onto the AI SDK answer shapes with the API's two-decimal rounding declared on the result, and per-answer confidence, score legends, and cost are exposed under `providerMetadata.openrouter`. Model settings accept `user`, `provider`, `session_id`, `trace`, and `extraBody`; call-level `providerOptions.openrouter` is validated and merged into the request body without being able to override `model`, `state`, or `questions`. A new `decisionsBaseURL` provider setting configures the Decisions endpoint for proxies whose `baseURL` does not end in `/v1`. The `ai` peer dependency range is unchanged; only `evaluationModel()` requires `ai@7.0.103+`.
