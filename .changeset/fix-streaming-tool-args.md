---
"@openrouter/ai-sdk-provider": patch
---

Fix streaming tool call arguments not being passed to execute function

OpenRouter Responses API doesn't stream tool arguments via delta events - the complete arguments are only available in the final `response.completed` event. This fix extracts tool call arguments from that event when they weren't received during streaming.
