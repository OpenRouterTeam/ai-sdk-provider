---
"@openrouter/ai-sdk-provider": patch
---

fix: stop attaching accumulated reasoning_details to reasoning-delta events (#413)

Previously, each reasoning-delta chunk carried a full snapshot of all
accumulatedReasoningDetails in its providerMetadata. For N reasoning
chunks, this caused O(N²) total payload size.

reasoning-start and reasoning-delta events no longer carry providerMetadata.
The full accumulated reasoning_details are still available on reasoning-end,
tool-call, and finish events (unchanged).
