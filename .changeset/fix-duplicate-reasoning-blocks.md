---
'@openrouter/ai-sdk-provider': patch
---

Fixed duplicate reasoning blocks when signature-only reasoning_details arrive after text content has started. Late-arriving signatures are still accumulated for multi-turn roundtrip via the finish event's providerMetadata, but no longer start a new reasoning block.
