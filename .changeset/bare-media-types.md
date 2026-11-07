---
"@openrouter/ai-sdk-provider": patch
---

Handle bare top-level media types (`image`, `video`, `audio`) and wildcards (`image/*`), which AI SDK v7 recommends and uses for `image` parts without a `mediaType`. They are now mapped to `image_url`, `video_url` and `input_audio` in user messages and tool results, the same as `image/png` etc. Previously they were sent as generic `file` parts and `imageDetail` / `videoProcessing` were dropped. For inline data the subtype is detected from the bytes, falling back to `image/jpeg`, `video/mp4` or `audio/mpeg`. The Decisions (`evaluation`) model now also accepts bare `image` state parts.
