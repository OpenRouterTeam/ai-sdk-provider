---
"@openrouter/ai-sdk-provider": patch
---

fix: preserve empty reasoning_details arrays in multi-turn conversations

Some providers (notably DeepSeek V4 in thinking mode) return `reasoning_details: []`
on turns where they produced no visible reasoning tokens. They require this empty array
to be sent back in subsequent requests to maintain conversation state; omitting it
causes 4xx errors on follow-up turns.

**`src/chat/index.ts`:**
- Stream finish event now always sets `openrouterMetadata.reasoning_details`, even when
  the accumulated array is empty (previously guarded by `length > 0`).
- Both `reasoning-end` emit sites now always include `providerMetadata.openrouter.reasoning_details`,
  removing the `length > 0` ternary that would drop the field entirely.

**`src/chat/convert-to-openrouter-chat-messages.ts`:**
- `candidateReasoningDetails` selection now uses `Array.isArray(messageReasoningDetails)`
  instead of `messageReasoningDetails.length > 0` — an explicit `[]` is now treated as
  "metadata was provided" rather than "metadata was absent", and no longer falls through
  to `findFirstReasoningDetails`.
- The top-level `if (candidateReasoningDetails)` guard no longer requires `length > 0`;
  an empty candidate array still triggers the dedup/signature-filter block.
- `finalReasoningDetails` is now always set to `uniqueDetails` (the deduplicated array),
  never collapsed to `undefined`. When all entries were duplicate or signature-stripped,
  the empty array is preserved as a meaningful signal.
- `effectiveReasoning` still requires `finalReasoningDetails.length > 0` — reasoning
  text is never sent alongside an empty details array.
