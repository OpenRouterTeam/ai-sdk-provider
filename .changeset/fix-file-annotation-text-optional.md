---
"@openrouter/ai-sdk-provider": patch
---

fix: make text field optional in file annotation content schema

When processing PDFs with the file-parser plugin using Mistral OCR, image elements in the response were failing validation. The schema required a `text` field on all content elements, but image elements (`type: "image_url"`) only have `image_url` data—no text. This made it impossible to process PDFs containing images.

Thanks @smorimoto for the fix! (#235)
