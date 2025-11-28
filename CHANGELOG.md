# @openrouter/ai-sdk-provider

## 1.2.8

### Patch Changes

- [#258](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/258) [`a4ac615`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/a4ac615206276b5c71f1d115dd296fa5408bb149) Thanks [@louisgv](https://github.com/louisgv)! - Fix reasoning details passing backup to include signature for Text part

## 1.2.7

### Patch Changes

- [#255](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/255) [`f48fa96`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/f48fa963428f20c82f6cceb805a084242b7cbe70) Thanks [@subtleGradient](https://github.com/subtleGradient)! - support for audio input with input_audio format (#241) Thanks @Karavil!

## 1.2.6

### Patch Changes

- [#251](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/251) [`c8c639d`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/c8c639d523e38bb20300d127f23cfa2419692e37) Thanks [@subtleGradient](https://github.com/subtleGradient)! - fix: make text field optional in file annotation content schema

  When processing PDFs with the file-parser plugin using Mistral OCR, image elements in the response were failing validation. The schema required a `text` field on all content elements, but image elements (`type: "image_url"`) only have `image_url` data—no text. This made it impossible to process PDFs containing images.

  Thanks @smorimoto for the fix! (#235)

## 1.2.4

### Patch Changes

- [#242](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/242) [`55ac920`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/55ac920ffa386418cdbe9731e5879b2c31259787) Thanks [@subtleGradient](https://github.com/subtleGradient)! - reasoning_details preservation for Gemini 3 multi-turn conversations. Thanks @mattapperson!

## 1.2.3

### Patch Changes

- [#232](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/232) [`2b49df4`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/2b49df448550e393312f129bcfbf260d429e17c7) Thanks [@subtleGradient](https://github.com/subtleGradient)! - Relax zod schemas with passthrough to allow unexpected API fields

  Add `.passthrough()` to all zod object schemas to prevent validation failures when the API returns extra fields not in our schema definitions. This ensures forward compatibility with API changes and prevents breaking when new fields are added to responses.

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
