---
'@openrouter/ai-sdk-provider': patch
---

Stop re-parsing the whole accumulated tool-call arguments on every streamed delta. A small incremental scanner now only lets the provider attempt a JSON parse once the arguments may be complete, removing quadratic CPU use for large streamed tool inputs. Emitted events are unchanged.
