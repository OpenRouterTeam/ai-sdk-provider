---
'@openrouter/ai-sdk-provider': patch
---

Fix console.warn for signature stripping to respect `AI_SDK_LOG_WARNINGS=false`, preventing warnings from bleeding through TUI and worker threads. Also generate unique IDs for reasoning and text stream events to avoid downstream ID collisions.
