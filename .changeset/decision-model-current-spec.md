---
'@openrouter/ai-sdk-provider': minor
---

Align `decisionModel()` / `evaluationModel()` with the decision model spec in `ai` 7.0.144 and later, where passing the model to `experimental_decide` was a type error.

- Implement `doDecide`; `doEvaluate` is kept as an alias for older `ai` releases.
- Support `box` questions and answers, and return `refusal` answers instead of failing to parse the response, so `decide()` throws its refusal error.
- Make `instructions` optional on `boolean`, `choice`, and `score` questions and allow one-sided `boolean` criteria. Whether a question may omit them depends on the model, so the API decides. A `box` question without `instructions` and a `score` question with a `null` level are still rejected before a request is sent.
- Report `maxOutputTokens` and `reasoning` as `unsupported` warnings, since the Decisions API has neither.
- Add response `annotations` and the usage `costDetails`, `inputTokensDetails`, and `isByok` to `providerMetadata.openrouter`.

The `ai` peer dependency is now `^7.0.144` (was `^7.0.0`), and the optional `@ai-sdk/provider` and `@ai-sdk/provider-utils` peers are raised to the versions that release pins (`^4.0.30` and `^5.0.63`). Decision types in earlier `ai` releases predate `box` and `refusal`, so the model no longer type-checks against them.
