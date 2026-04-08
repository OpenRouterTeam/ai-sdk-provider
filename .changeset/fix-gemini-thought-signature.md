---
'@openrouter/ai-sdk-provider': patch
---

Fix Gemini "Corrupted thought signature" error in multi-turn conversations (issue #418)

Extend signature validation to also cover google-gemini-v1 format. Previously, only Anthropic-format reasoning entries were validated for signatures. Gemini extended thinking also uses signed thought tokens, and corrupted/missing signatures now get stripped before being sent back to the API.
