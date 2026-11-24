---
'@openrouter/ai-sdk-provider': patch
---

Accept usage details that leave out `cached_tokens` or `reasoning_tokens`, for example `"prompt_tokens_details": {}` or `"completion_tokens_details": {}`. Before, such a response failed validation: `generateText` rejected with `Invalid JSON response` and `streamText` lost usage and cost on the final chunk. The missing counts are now read as 0, for both chat and completion models (#644).
