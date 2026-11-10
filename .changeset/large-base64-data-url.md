---
'@openrouter/ai-sdk-provider': patch
---

fix: extract base64 from data URLs without running a regex over the payload, which could throw "Maximum call stack size exceeded" on large generated images. Only the data URL header (before the first comma) is now parsed, which also changes a few edge cases: data URLs with parameters (e.g. `data:image/png;charset=utf-8;base64,...`) are now decoded, payloads containing line breaks are now returned instead of the whole URL, a comma in the media type is no longer accepted, and the media type of a generated image is read from the header only.
