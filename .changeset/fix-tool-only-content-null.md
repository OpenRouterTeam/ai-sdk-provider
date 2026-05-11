---
'@openrouter/ai-sdk-provider': patch
---

fix: send `content: null` instead of `content: ""` for tool-only assistant messages

Assistant messages containing only tool calls (no text) were serialized with
`content: ""`. Providers that strictly validate the OpenAI chat format
(e.g. AWS Bedrock / Nova) reject blank content with a 400 error. Empty text is
now coerced to `null`, which the spec explicitly allows for assistant messages.
