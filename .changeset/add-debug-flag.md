---
"@openrouter/ai-sdk-provider": minor
---

Add support for debug flag to echo upstream request body

- Added `debug` option to `OpenRouterChatSettings` with `echo_upstream_body` boolean
- The debug flag is passed through to the OpenRouter API in both streaming and non-streaming requests
- Debug mode only works with streaming requests and returns the upstream request body (with sensitive data redacted) as the first chunk
- Updated README with usage documentation
