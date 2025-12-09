---
"@openrouter/ai-sdk-provider": patch
---

Fix Gemini 3 tool-call conversations stopping prematurely when thoughtSignature (encrypted reasoning) is present. Override finishReason from 'stop' to 'tool-calls' when tool calls and encrypted reasoning are detected.
