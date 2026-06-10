---
'@openrouter/ai-sdk-provider': patch
---

Send `content: null` instead of `content: ""` for assistant messages that contain only tool calls. Fixes AWS Bedrock Nova rejecting requests with "The text field in the ContentBlock object is blank."
