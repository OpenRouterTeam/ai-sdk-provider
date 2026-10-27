---
"@openrouter/ai-sdk-provider": patch
---

Preserve `reasoning.server_tool_call` reasoning details. They were previously dropped at parse time, so OpenRouter server-tool calls (e.g. `openrouter:fusion`) were never replayed on later turns. They are now parsed in responses and stream deltas, accumulated during streaming, deduplicated by `tool_call_id` (or `tool_name:arguments`) and sent back in `reasoning_details`.
