---
"@openrouter/ai-sdk-provider": patch
---

fix: preserve thinking block signature in streaming reasoning deltas

Fixed two bugs causing Anthropic thinking block signatures to be lost during streaming:

1. Signature-only deltas (containing a signature but no text) were silently dropped by the `if (detail.text)` guard in the reasoning delta handler. These deltas are now emitted with an empty string text, ensuring the signature propagates to downstream consumers.

2. Per-delta `providerMetadata.reasoning_details` only contained the current chunk's details instead of an accumulated snapshot. This meant the signature (which arrives in a later delta) was never visible in earlier deltas' metadata. Now each reasoning delta carries a snapshot of all accumulated reasoning details.

These fixes prevent "Invalid signature in thinking block" errors in multi-turn conversations with Anthropic models.
