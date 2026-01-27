---
"@openrouter/ai-sdk-provider": patch
---

fix: only apply message-level cache_control to last text part (#341)

When message-level cache_control is set on a user message with multiple parts, it now only applies to the last text part. Non-text parts (images, audio, files) no longer inherit message-level cache_control. Part-specific cache_control still takes precedence and works on all part types.
