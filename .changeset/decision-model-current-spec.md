---
'@openrouter/ai-sdk-provider': minor
---

Align `decisionModel()` / `evaluationModel()` with the decision model spec in `ai` 7.0.144 and later, where passing the model to `experimental_decide` was a type error.

- Implement `doDecide`; `doEvaluate` is kept as an alias for older `ai` releases.
- Support `box` questions and answers, and return `refusal` answers instead of failing to parse the response, so `decide()` throws its refusal error.
- Make `instructions` optional on `boolean`, `choice`, and `score` questions and allow one-sided `boolean` criteria. Whether a question may omit them depends on the model, so the API decides. A `box` question without `instructions` and a `score` question with a `null` level are still rejected before a request is sent.
- Report `maxOutputTokens` and `reasoning` as `unsupported` warnings, since the Decisions API has neither.
- Add response `annotations` and the usage `costDetails`, `inputTokensDetails`, and `isByok` to `providerMetadata.openrouter`.

The decision model types now require `ai` 7.0.144 or later. Earlier releases still work at runtime, but their decision types predate `box` and `refusal`, so passing the model to `experimental_evaluate` or an earlier `experimental_decide` does not type-check.
