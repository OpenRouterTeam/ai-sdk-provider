---
"@openrouter/ai-sdk-provider": patch
---

Replace generic `Error` instances with proper AI SDK error types for improved error handling consistency and debugging.

**Error Type Changes:**
- Use `APICallError` for HTTP 200 responses with error payloads (includes url, requestBody, statusCode, headers, and error data)
- Use `NoContentGeneratedError` when API returns no choices (with custom context messages)
- Use `InvalidResponseDataError` for malformed streaming responses and missing tool calls (with structured data)
- Use `InvalidArgumentError` for invalid function arguments (with argument name and serialized value)

**Benefits:**
- Aligns with AI SDK ecosystem error handling patterns
- Provides structured error data instead of just string messages
- Enables better error handling and debugging for consumers
- Preserves all original error context while adding additional debugging information
