---
"@openrouter/ai-sdk-provider": patch
---

Pass video URLs through to OpenRouter instead of downloading them. The chat model's `supportedUrls` now has a `video/*` entry for http(s) URLs, so a `video/*` file part with a URL is sent as `video_url.url` unchanged. Previously the AI SDK downloaded the video client-side and sent it as base64, and a YouTube page URL was downloaded as HTML and labelled as video.
