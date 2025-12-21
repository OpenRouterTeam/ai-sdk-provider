---
"@openrouter/ai-sdk-provider": patch
---

Fix headers being silently modified when user provides custom user-agent

When users provided their own `user-agent` header, it was being overwritten with the SDK version. Now user-provided headers are preserved unchanged, and the SDK version is sent via the `X-OpenRouter-SDK-Version` header instead.
