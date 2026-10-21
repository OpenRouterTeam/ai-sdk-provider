---
'@openrouter/ai-sdk-provider': patch
---

Implement `WORKFLOW_SERIALIZE` / `WORKFLOW_DESERIALIZE` hooks on the chat and completion language models so model instances can be used with `@ai-sdk/workflow` durable execution. Mirrors the first-party AI SDK providers and fixes the `WorkflowRuntimeError: Failed to serialize step arguments` thrown when a model is passed as a durable step argument (#525).

Credentials are never written to workflow storage: the `Authorization` and `X-Provider-API-Keys` headers are omitted when serializing, and a deserialized model re-reads its API key from `OPENROUTER_API_KEY` at request time.
