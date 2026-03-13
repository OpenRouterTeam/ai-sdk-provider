---
"@openrouter/ai-sdk-provider": patch
---

Fix mid-stream socket termination (TypeError: terminated) to emit structured error and finish events instead of throwing a raw TypeError
