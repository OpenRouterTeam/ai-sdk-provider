---
'@openrouter/ai-sdk-provider': patch
---

fix: extract base64 from data URLs without a regex over the payload, which could throw "Maximum call stack size exceeded" on large generated images
