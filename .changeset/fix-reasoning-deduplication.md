---
"@openrouter/ai-sdk-provider": patch
---

Fix the reasoning_details duplication issue with multi-turn tool calls. When multiple tool calls were made with reasoning enabled, the same reasoning_details would be attached to each tool call, causing duplicates when sent back in conversation history. This led to `finishReason: "unknown"`, empty `totalUsage` in responses and API errors form Claude.

The fix:
- Remove reasoning_details accumulation from reasoning parts (which can be corrupted/partial during streaming)
- Only accumulate reasoning_details from tool-call parts
- Implement smart deduplication based on provider-specific unique identifiers (signature for Claude, id/data for Gemini)
- Support both Claude (Anthropic) and Gemini (Google) reasoning formats
