---
"@openrouter/ai-sdk-provider": patch
---

Fix parallel tool calls with Claude models when thinking/reasoning is enabled. Previously, reasoning_details were duplicated across all parallel tool calls, causing Anthropic to reject continuation requests.
