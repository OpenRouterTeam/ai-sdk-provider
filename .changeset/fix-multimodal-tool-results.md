---
"@openrouter/ai-sdk-provider": patch
---

Fix multimodal tool results being flattened to strings

When a tool returns `output.type = "content"` with structured multimodal parts (text + images), those parts were being JSON.stringified instead of preserved as structured content parts. This prevented models from using vision on images in tool results.

Changes:
- `getToolResultContent()` now maps each content part to the appropriate OpenRouter format (text, image_url, file) instead of stringifying
- `ChatCompletionToolMessageParam.content` type updated to accept `string | Array<ChatCompletionContentPart>`

Fixes #181
