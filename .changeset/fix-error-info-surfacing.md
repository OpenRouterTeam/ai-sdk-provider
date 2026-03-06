---
'@openrouter/ai-sdk-provider': patch
---

Surface detailed error information from provider metadata in error messages

When OpenRouter returns an error, the top-level `error.message` is often generic (e.g. "Provider returned error"). The actual error details from the upstream provider are in `error.metadata.raw` but were not being surfaced to users.

Now `extractErrorMessage` recursively extracts meaningful error messages from `metadata.raw` (which can be a string, JSON string, or nested object) and includes the provider name when available. For example, instead of just "Provider returned error", users will now see "[Anthropic] Your credit balance is too low".
