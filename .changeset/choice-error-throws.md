---
'@openrouter/ai-sdk-provider': patch
---

Throw an `APICallError` when a non-streaming chat response reports a provider failure on the choice (`choices[0].error`, sent with HTTP 200 and `finish_reason: "error"`), the same way a top-level `error` body is already handled. Before, the partial output was returned as a successful result. The error message includes the upstream provider's detail when the API sends it, as for HTTP errors. The error has `statusCode: 200`, the API's error object in `data`, and the full response, including any partial output, in `responseBody`.
