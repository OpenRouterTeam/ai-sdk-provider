---
"@openrouter/ai-sdk-provider": patch
---

Add reasoning_details accumulation and providerMetadata support for multi-turn conversations

- Accumulate reasoning_details from reasoning parts when converting messages
- Include reasoning_details in providerMetadata for reasoning delta chunks during streaming
- Enables users to accumulate reasoning_details across multi-turn conversations
