---
"@openrouter/ai-sdk-provider": major
---

# v6 Alpha Release

Major version upgrade to support AI SDK v6 (LanguageModelV3 interface).

## Breaking Changes

- Package now uses AI SDK v6 interfaces (`LanguageModelV3`, `EmbeddingModelV3`)
- `ai` package moved from peer dependency to dev dependency
- Exports cleanup (model classes no longer exported)

## New Features

- Full Responses API support (provider field, cost in usage)
- Tool calling with streaming support
- Reasoning details extraction and multi-turn preservation
- Structured outputs (JSON schema) pass-through
- Assistant prefill support
- Model variants (`:online`, `:nitro`, `:floor`) documented

## Internal Changes

- Uses `@openrouter/sdk@^0.3.11`
- Uses `@effect-native/fetch-hooks@^0.1.0` for E2E testing
- Upgraded to Zod v4
