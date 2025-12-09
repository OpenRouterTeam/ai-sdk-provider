# @openrouter/ai-sdk-provider

## 1.5.1

### Patch Changes

- [#295](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/295) [`2fbe4e5`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/2fbe4e58e3798790fda99dbde67bc9b3f5e222d0) Thanks [@subtleGradient](https://github.com/subtleGradient)! - Patch transitive security vulnerabilities in glob and js-yaml dev dependencies

## 1.5.0

### Minor Changes

- [#276](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/276) [`eb7d3a2`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/eb7d3a237dadbb09b279fe65cc3c25030d441bc8) Thanks [@jamespsterling](https://github.com/jamespsterling)! - Add TOON encoding/decoding helper functions for token-efficient data serialization

### Patch Changes

- [#291](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/291) [`5f4a9b9`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/5f4a9b993b8d17cb8c23e890269c785cf5396e29) Thanks [@mstykow](https://github.com/mstykow)! - expand supported audio formats

## 1.4.1

### Patch Changes

- [#279](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/279) [`922dc10`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/922dc1082c13b7c810f5adb2c7606868fa0cab84) Thanks [@subtleGradient](https://github.com/subtleGradient)! - Add first-class embedding model support via OpenRouterEmbeddingModel -- Thanks @Loule95450 !

- [#281](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/281) [`4294d67`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/4294d670486d6cf907de6a0cd79ed5866a189b37) Thanks [@subtleGradient](https://github.com/subtleGradient)! - Add `engine` option to `web_search_options` for specifying search engine

  Users can now specify which search engine to use for web search via `web_search_options.engine`:

  - `"native"`: Use provider's built-in web search
  - `"exa"`: Use Exa's search API
  - `undefined`: Native if supported, otherwise Exa

  Thanks to @xdagiz for identifying this missing option in #182.

- [#280](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/280) [`f0d3bc9`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/f0d3bc9b856889ae34fe0bfc54459d029004ebda) Thanks [@subtleGradient](https://github.com/subtleGradient)! - Fix responseFormat and tools working together

  Previously, when both `responseFormat` (with a JSON schema) and `tools` were provided to `doGenerate` or `doStream`, the tools would be silently ignored due to an early return in the `getArgs` method. Now both options work correctly together.

  Thanks to @soksx for identifying and proposing the fix in #175.

- [#170](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/170) [`261d44a`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/261d44acca299f502f96ee616d654208c53f54a3) Thanks [@louisgv](https://github.com/louisgv)! - Add api_keys parameter for provider-specific API key injection via X-OpenRouter-API-Keys header

## 1.4.0

### Minor Changes

- [#272](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/272) [`4c7176e`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/4c7176e92bd864657aef40a6d666a62ba9ccb603) Thanks [@subtleGradient](https://github.com/subtleGradient)! - Add support for FileParser annotations to enable "Skip Parsing Costs" feature

  - Annotations from file parsing are now exposed via `providerMetadata.openrouter.annotations`
  - Pass annotations back via `providerOptions.openrouter.annotations` to skip re-parsing costs
  - See https://openrouter.ai/docs/guides/overview/multimodal/pdfs#skip-parsing-costs

### Patch Changes

- [#274](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/274) [`4b7814b`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/4b7814b33edec022c3fe202ceef5315c0b160246) Thanks [@yogasanas](https://github.com/yogasanas)! - Add supportsImageUrls property to indicate image URL support for all models

## 1.3.0

### Minor Changes

- [#263](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/263) [`ed2bec5`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/ed2bec549c117375ec2d25f3df370cf23b082df8) Thanks [@talos](https://github.com/talos)! - Add support for debug flag to echo upstream request body

  - Added `debug` option to `OpenRouterChatSettings` with `echo_upstream_body` boolean
  - The debug flag is passed through to the OpenRouter API in both streaming and non-streaming requests
  - Debug mode only works with streaming requests and returns the upstream request body (with sensitive data redacted) as the first chunk
  - Updated README with usage documentation

### Patch Changes

- [#266](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/266) [`c3f6381`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/c3f63818b6a432a8fd86cafcf21669d8be18ef71) Thanks [@subtleGradient](https://github.com/subtleGradient)! - Fix token details in providerMetadata to only be included when present in API response. Previously, `promptTokensDetails` and `completionTokensDetails` were always included with default values of 0, which could be misleading. Now they are only included when the API actually returns these details, matching the behavior of `costDetails`.

- [#268](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/268) [`6ac3814`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/6ac38143fba8ae64895c4136662ab751bf54bcea) Thanks [@jamespsterling](https://github.com/jamespsterling)! - Add reasoning_details accumulation and providerMetadata support for multi-turn conversations

  - Accumulate reasoning_details from reasoning parts when converting messages
  - Include reasoning_details in providerMetadata for reasoning delta chunks during streaming
  - Enables users to accumulate reasoning_details across multi-turn conversations

- [#246](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/246) [`78d20ef`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/78d20ef3f87df20cf5ce7807d7a29aff40ebcc80) Thanks [@abromberg](https://github.com/abromberg)! - build was failing due to mismatch with @openrouter/sdk types. simply renamed models.Sort to models.ProviderSort and it now builds

- [#260](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/260) [`c38eade`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/c38eade5fa31435731df20a49ec1b28866102e25) Thanks [@AviVahl](https://github.com/AviVahl)! - adjust sort type to latest @openrouter/sdk

- [#267](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/267) [`89ae694`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/89ae6946ecf8180ec9fdac6c965439ab4519375d) Thanks [@subtleGradient](https://github.com/subtleGradient)! - Adds support for OpenRouter's BYOK usage accounting. If you have a provider's own API key in your OpenRouter account, cost details are now accessible via usage.costDetails.upstreamInferenceCost -- Thanks @abromberg!

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
