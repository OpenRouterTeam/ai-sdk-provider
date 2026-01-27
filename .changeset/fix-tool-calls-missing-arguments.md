---
"@openrouter/ai-sdk-provider": patch
---

fix: handle tool calls with missing arguments field (#287)

Made the arguments field optional in the tool_calls schema and default to '{}' (empty JSON object) when missing. This handles cases where upstream providers may omit the arguments field for tools with no parameters.
