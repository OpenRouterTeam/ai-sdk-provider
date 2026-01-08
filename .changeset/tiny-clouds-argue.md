---
"@openrouter/ai-sdk-provider": patch
---

Make file content part fields optional and add file_id support. The `filename` and `file_data` fields in `ChatCompletionContentPartFile` are now optional, and a new `file_id` field has been added for OpenAI file uploads support.
