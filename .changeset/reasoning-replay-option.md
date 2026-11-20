---
'@openrouter/ai-sdk-provider': minor
---

feat(chat): add opt-in `reasoningReplay` option (`'all' | 'same-family' | 'none'`, model setting or `providerOptions.openrouter.reasoningReplay`) to control which historical `reasoning_details` are replayed, e.g. to drop OpenAI encrypted reasoning when switching to a model from another provider family (#542)
