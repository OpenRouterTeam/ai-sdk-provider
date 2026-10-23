---
'@openrouter/ai-sdk-provider': patch
---

Preserve `reasoning_details` that arrive after the reasoning block has closed (e.g. a late `reasoning.encrypted` blob or signature-only delta after text started) across turns. `doStream` now attaches a snapshot of the details to each carrier part and, when details arrived after the last carrier, emits an empty reasoning part carrying the complete array. The message converter replays the most complete carrier, so every detail is sent back exactly once, including when the stream is serialized over the wire (e.g. the UI message stream).
