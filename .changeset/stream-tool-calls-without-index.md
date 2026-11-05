---
'@openrouter/ai-sdk-provider': patch
---

Keep parallel streamed tool calls apart when the provider omits `index` on tool-call deltas. A delta with an id or function name that differs from the last call now starts a new call; previously every unindexed call was merged into one and later calls were lost. Behavior is unchanged when `index` is present.
