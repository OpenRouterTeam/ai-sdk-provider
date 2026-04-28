---
'@openrouter/ai-sdk-provider': patch
---

Fix `supportedUrls['image/*']` regex to accept image URLs with query strings or fragments (e.g. `https://cdn.example.com/photo.png?height=200`, `.../photo.webp#frag`). Previously the `$` anchor on the extension caused such URLs to be treated as unsupported, forcing the AI SDK runtime to download and base64-inline them, which bloated conversation history and inflated token usage.
