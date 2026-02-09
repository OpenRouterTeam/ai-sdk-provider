---
"@openrouter/ai-sdk-provider": patch
---

fix: include accumulated reasoning_details with signature in reasoning-end stream event

When streaming a text-only response (no tool calls) with reasoning enabled, the reasoning-end event now includes the accumulated reasoning_details (with signature) in providerMetadata. This fixes multi-turn conversation failures with Anthropic models where the signature was lost, causing "Invalid signature in thinking block" errors on subsequent turns.
