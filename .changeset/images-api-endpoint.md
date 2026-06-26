---
'@openrouter/ai-sdk-provider': minor
---

Switch image generation to dedicated `/api/v1/images` endpoint

Migrates `OpenRouterImageModel` from the legacy chat completions path (`/chat/completions` with `modalities: ["image", "text"]`) to OpenRouter's dedicated image generation endpoint (`/images`).

**Request changes:**
- Sends `{ model, prompt, n, size, aspect_ratio, seed, input_references }` directly instead of wrapping in a chat messages array
- `files` are mapped to `input_references` (array of `{ type: "image_url", image_url: { url } }`) instead of inline message content parts
- `aspectRatio` maps to `aspect_ratio` (was `image_config.aspect_ratio`)
- `size` and `n` are now passed through (previously emitted warnings)

**Response changes:**
- Parses `{ created, data: [{ b64_json }], usage }` instead of `{ choices: [{ message: { images } }] }`
- `maxImagesPerCall` updated from 1 to 10 (the new endpoint supports batch generation)
