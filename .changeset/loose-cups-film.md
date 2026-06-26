---
"@openrouter/ai-sdk-provider": major
---

Support Vercel AI SDK v7 as a v7-only major release.

This is a breaking change because the provider now peers on `ai@^7.0.0`, requires Node.js 22 or newer, and publishes ESM-only output. The provider, language, embedding, image, and video model implementations now target the `@ai-sdk/provider@4` V4 interfaces, with V4 file payloads and provider-defined tool factories.

Consumers should upgrade to `ai@7`, run on Node.js 22+, and import this package from ESM. Usage accounting follows the AI SDK v7 shape: cached input tokens are exposed via `usage.inputTokenDetails.cacheReadTokens`, and reasoning tokens are exposed via `usage.outputTokenDetails.reasoningTokens`. OpenRouter-specific cost, BYOK, reasoning details, annotations, and cache-control metadata remain available under `providerMetadata.openrouter`.
