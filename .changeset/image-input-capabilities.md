---
'@openrouter/ai-sdk-provider': patch
---

Declare `supportsFileInputs: true` and `supportsMaskInputs: false` on the image model, matching what `doGenerate` already does with `files` and `mask`.
