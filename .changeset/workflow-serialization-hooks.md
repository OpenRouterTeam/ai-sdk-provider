---
'@openrouter/ai-sdk-provider': minor
---

Implement `WORKFLOW_SERIALIZE` / `WORKFLOW_DESERIALIZE` hooks on the chat and completion language models so model instances can be used with `@ai-sdk/workflow` durable execution. Fixes the `WorkflowRuntimeError: Failed to serialize step arguments` thrown when a model is passed as a durable step argument (#525).

Secrets are never written to workflow storage. Only `modelId`, settings, `baseURL`, `compatibility`, `extraBody` and the `appName` / `appUrl` headers (`X-OpenRouter-Title`, `HTTP-Referer`) are persisted; all other custom headers are dropped and the SDK user agent is re-applied on restore. A restored model re-reads its API key from `OPENROUTER_API_KEY` at request time, and a model created with BYOK `api_keys` throws a clear error at request time instead of silently falling back to OpenRouter credits.
