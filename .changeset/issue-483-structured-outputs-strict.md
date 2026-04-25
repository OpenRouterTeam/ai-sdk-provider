---
'@openrouter/ai-sdk-provider': minor
---

Add `structuredOutputs.strict` setting to opt out of `response_format.json_schema.strict` (issue #483).

Previously the SDK hardcoded `strict: true` whenever a JSON schema response format was used, which made it impossible to route requests to providers that don't advertise support for strict json_schema. Models like `moonshotai/kimi-k2.6` (routed through Parasail/Venice/Io Net) returned HTTP 404 "No endpoints available matching your guardrail restrictions and data policy" because the strict flag eliminated every eligible endpoint.

Users can now opt out per-model:

```ts
const model = openrouter.chat('moonshotai/kimi-k2.6', {
  structuredOutputs: { strict: false },
});
```

The default remains `strict: true` for backward compatibility.
