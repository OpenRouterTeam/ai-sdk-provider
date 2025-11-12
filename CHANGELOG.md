# @openrouter/ai-sdk-provider

## 1.2.2

### Patch Changes

- [#219](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/219) [`8cb1d2d`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/8cb1d2d61ed9b01aa0a1cad630483a3d2792e907) Thanks [@subtleGradient](https://github.com/subtleGradient)! - Replace generic `Error` instances with proper AI SDK error types for improved error handling consistency and debugging.

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

- [#223](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/223) [`9935792`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/9935792f4377a1e461a8b99c71934c3049a47f31) Thanks [@HashimMufti](https://github.com/HashimMufti)! - fix: support file annotation type for file uploads

## 1.2.1

### Patch Changes

- [#214](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/214) [`f29f61f`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/f29f61f298294e7b44fdbc160870e13e6b411117) Thanks [@subtleGradient](https://github.com/subtleGradient)! - Add changeset support for automated release management. This replaces the manual version bump and GitHub Release process with an automated workflow that creates version PRs and publishes to npm when merged.
