---
"@openrouter/ai-sdk-provider": minor
---

Add imageModel() method to OpenRouter provider for image generation support

This adds the `imageModel()` method to the OpenRouter provider, enabling image generation through the AI SDK's `generateImage()` function. The implementation uses OpenRouter's chat completions endpoint with `modalities: ['image', 'text']` to generate images.

Features:
- Implements `ImageModelV3` interface from AI SDK
- Supports `aspectRatio` parameter via `image_config`
- Supports `seed` parameter for reproducible generation
- Supports provider routing settings (order, allow_fallbacks, etc.)
- Returns appropriate warnings for unsupported features (n > 1, size)
- Throws `UnsupportedFunctionalityError` for image editing (files/mask parameters)

Usage:
```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateImage } from 'ai';

const openrouter = createOpenRouter();
const { image } = await generateImage({
  model: openrouter.imageModel('google/gemini-2.5-flash-image'),
  prompt: 'A cat wearing a hat',
  aspectRatio: '16:9',
});
```

