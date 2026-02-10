# @openrouter/ai-sdk-provider

## 2.2.3

### Patch Changes

- [#409](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/409) [`7b21d68`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/7b21d684c11847a7e5dd3fb89bff3374169cc4c6) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Compute missing token usage detail fields from available API data

  Previously, `inputTokens.noCache`, `outputTokens.text`, and `inputTokens.cacheWrite` were always `undefined`, even when the data to compute them was available in the API response. This caused downstream dashboards and analytics to receive misleading values.

  Now the provider computes these fields:

  - `inputTokens.noCache` = `total - cacheRead` (non-cached input tokens)
  - `outputTokens.text` = `total - reasoning` (text output tokens)
  - `inputTokens.cacheWrite` = passthrough from `cache_write_tokens` when available

  This applies to all code paths: chat `doGenerate`, chat `doStream`, completion `doGenerate`, and completion `doStream`.

## 2.2.2

### Patch Changes

- [#405](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/405) [`f7139f1`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/f7139f180803e24858a12559b3389cd16c64c40e) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Support `files` parameter in image generation for image editing and image-to-image use cases

## 2.2.1

### Patch Changes

- [#403](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/403) [`e3908c6`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/e3908c65484a110e6ff6be7fe5669ec68269c1e3) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Add support for `auto-router` plugin to configure allowed models when using `openrouter/auto`

## 2.2.0

### Minor Changes

- [#399](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/399) [`ad0c2e1`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/ad0c2e11ab31fe91e2d1e9ff2f218572f57706be) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Fix system message cache control to use block-level format

  When cache control is specified on a system message via `providerOptions`, the content is now converted to array format with `cache_control` on the text block, matching the existing behavior for user messages. This ensures consistent Anthropic prompt caching behavior across all message types.

  Before (message-level cache_control):

  ```json
  {
    "role": "system",
    "content": "...",
    "cache_control": { "type": "ephemeral" }
  }
  ```

  After (block-level cache_control):

  ```json
  {
    "role": "system",
    "content": [
      {
        "type": "text",
        "text": "...",
        "cache_control": { "type": "ephemeral" }
      }
    ]
  }
  ```

  Fixes #389

## 2.1.3

### Patch Changes

- [#398](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/398) [`50c932c`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/50c932c48d0c4b238a9454e2ba95618495b61810) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Add support for reasoning effort values 'xhigh', 'minimal', and 'none' in the reasoning configuration type. Previously only 'high', 'medium', and 'low' were accepted.

## 2.1.2

### Patch Changes

- [#395](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/395) [`23f02f1`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/23f02f1b7d87cbe9a1fa99d34dcc261ae989c154) Thanks [@robert-j-y](https://github.com/robert-j-y)! - fix: include accumulated reasoning_details with signature in reasoning-end stream event

  When streaming a text-only response (no tool calls) with reasoning enabled, the reasoning-end event now includes the accumulated reasoning_details (with signature) in providerMetadata. This fixes multi-turn conversation failures with Anthropic models where the signature was lost, causing "Invalid signature in thinking block" errors on subsequent turns.

## 2.1.1

### Patch Changes

- [#365](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/365) [`363e232`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/363e232615e3a6430c547a90f45f12b567331911) Thanks [@robert-j-y](https://github.com/robert-j-y)! - fix: deduplicate reasoning_details across multi-turn conversations to prevent duplicate ID errors

## 2.1.0

### Minor Changes

- [#366](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/366) [`f2b78f5`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/f2b78f54f395cd1bce5be9ff3690a8752b991b49) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Add imageModel() method to OpenRouter provider for image generation support

  This adds the `imageModel()` method to the OpenRouter provider, enabling image generation through the AI SDK's `generateImage()` function. The implementation uses OpenRouter's chat completions endpoint with `modalities: ['image', 'text']` to generate images.

  Features:

  - Implements `ImageModelV3` interface from AI SDK
  - Supports `aspectRatio` parameter via `image_config`
  - Supports `seed` parameter for reproducible generation
  - Supports provider routing settings (order, allow_fallbacks, etc.)
  - Returns appropriate warnings for unsupported features (n > 1, size)
  - Throws `UnsupportedFunctionalityError` for image editing (files/mask parameters)

  Usage:

  ```typescript
  import { createOpenRouter } from "@openrouter/ai-sdk-provider";
  import { generateImage } from "ai";

  const openrouter = createOpenRouter();
  const { image } = await generateImage({
    model: openrouter.imageModel("google/gemini-2.5-flash-image"),
    prompt: "A cat wearing a hat",
    aspectRatio: "16:9",
  });
  ```

- [#361](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/361) [`da10f19`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/da10f190cca86fb8c0942033e1af32d1520760db) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Add support for the Response Healing plugin

  The Response Healing plugin automatically validates and repairs malformed JSON responses from AI models. Enable it by adding `{ id: 'response-healing' }` to the plugins array when using structured outputs with `generateObject`.

  ```typescript
  const model = openrouter("openai/gpt-4o", {
    plugins: [{ id: "response-healing" }],
  });

  const { object } = await generateObject({
    model,
    schema: z.object({ name: z.string(), age: z.number() }),
    prompt: "Generate a person.",
  });
  ```

  Note: Response Healing only works with non-streaming requests.

- [#360](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/360) [`b129d36`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/b129d36987e4a635f86f28bead4259f79dc265d3) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Add includeRawChunks support for streaming

  When `includeRawChunks: true` is passed to streaming calls, the provider now emits `{ type: 'raw', rawValue: <parsed chunk> }` stream parts for each SSE event, giving consumers access to the raw provider chunks alongside the processed AI SDK stream parts.

  This feature is available for both chat and completion models.

- [#357](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/357) [`f24fac7`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/f24fac78fb99341698a5f7a5d44484c61644321c) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Remove dependency on @openrouter/sdk

  This change removes the external dependency on `@openrouter/sdk` by inlining the necessary type definitions locally. The types are now defined in `src/types/openrouter-api-types.ts`.

  This reduces the package's dependency footprint and eliminates potential version conflicts with the SDK.

### Patch Changes

- [#359](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/359) [`85d6633`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/85d6633058f8853d66b6a658c33604af1e9c0233) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Fix undefined cost field in providerMetadata causing AI SDK validation failures

- [#362](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/362) [`bd8794a`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/bd8794a86707ae16eb97c16a01b169e00b524b3c) Thanks [@robert-j-y](https://github.com/robert-j-y)! - fix: respect user-specified User-Agent headers without modification

  Previously, when users provided a custom `User-Agent` header via `createOpenRouter({ headers: { 'User-Agent': 'my-app/1.0' } })`, the SDK would append its identifier to the header, resulting in `my-app/1.0, ai-sdk/openrouter/x.x.x`. This was unexpected behavior.

  Now, user-specified `User-Agent` headers are used verbatim without modification. The SDK identifier is only added as the default when no `User-Agent` header is provided.

  This also fixes a case-sensitivity bug where `User-Agent` (capitalized) was not recognized as the same header as `user-agent` (lowercase), causing duplicate headers to be sent.

  Fixes #300

- [#363](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/363) [`f2d5034`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/f2d5034ef85cc5ef5b16283de5ee45fe8bfeaf64) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Populate usage.raw with OpenRouter raw usage accounting object in finish step

- [#364](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/364) [`c6ae94d`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/c6ae94db7b2832fe1bcc6b1722ca7dca9855bc21) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Fix missing web search citations by making url_citation schema fields optional

## 2.0.4

### Patch Changes

- [#352](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/352) [`d76d566`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/d76d566da54c4ac3133c5abc045297fd4da2f11d) Thanks [@robert-j-y](https://github.com/robert-j-y)! - fix: handle tool calls with missing arguments field (#287)

  Made the arguments field optional in the tool_calls schema and default to '{}' (empty JSON object) when missing. This handles cases where upstream providers may omit the arguments field for tools with no parameters.

## 2.0.3

### Patch Changes

- [#351](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/351) [`ac75d1f`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/ac75d1ff825379b918d37ca09a107446fd52cf4c) Thanks [@robert-j-y](https://github.com/robert-j-y)! - fix: only apply message-level cache_control to last text part (#341)

  When message-level cache_control is set on a user message with multiple parts, it now only applies to the last text part. Non-text parts (images, audio, files) no longer inherit message-level cache_control. Part-specific cache_control still takes precedence and works on all part types.

## 2.0.2

### Patch Changes

- [#344](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/344) [`8228294`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/822829423def7a801b8e4e630370ada4386dc89f) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Fix parallel tool calls with Claude models when thinking/reasoning is enabled. Previously, reasoning_details were duplicated across all parallel tool calls, causing Anthropic to reject continuation requests.

## 2.0.1

### Patch Changes

- [#337](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/337) [`09f85dc`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/09f85dccd2db2d81de8dd0f9b0b944a5b01a6d8d) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Fix ai peer dependency from exact version 6.0.3 to ^6.0.0

## 2.0.0

### Major Changes

- [#307](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/307) [`6fd68db`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/6fd68dba222d12a555c08c644e27e18949331dbb) Thanks [@pablof7z](https://github.com/pablof7z)! - Add AI SDK v6 support with LanguageModelV3 and EmbeddingModelV3 interfaces

### Minor Changes

- [#324](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/324) [`d055b96`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/d055b963a16e95beabecb5f880b4b0ec7b0b83c1) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Update zod peerDependency from "^3.24.1 || ^v4" to "^3.25.0 || ^4.0.0". This fixes TypeScript errors ("Cannot find module 'zod/v3'") that occur when users have Zod < 3.25.0 installed, as the subpath exports (zod/v3, zod/v4) were only added in Zod 3.25.0.

### Patch Changes

- [#326](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/326) [`9f7a125`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/9f7a1259e2fd69e670ebb2a14bdcff5d064ad3d5) Thanks [@robert-j-y](https://github.com/robert-j-y)! - Make file content part fields optional and add file_id support. The `filename` and `file_data` fields in `ChatCompletionContentPartFile` are now optional, and a new `file_id` field has been added for OpenAI file uploads support.

## 1.5.4

### Patch Changes

- [#301](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/301) [`3c0ba4c`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/3c0ba4cfdd70aa3a449604e58f1241c88205974f) Thanks [@subtleGradient](https://github.com/subtleGradient)! - Remove TOON encoding/decoding helper functions

  BREAKING CHANGE: Removes @toon-format/toon dependency and related exports (encodeToon, decodeToon, ToonEncodeOptions, ToonDecodeOptions, JsonValue). Users who were using these helpers should import directly from @toon-format/toon instead.

## 1.5.3

### Patch Changes

- [#294](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/294) [`83c6b41`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/83c6b41a0bd9d965ad66117527f2dbf44c3130ec) Thanks [@subtleGradient](https://github.com/subtleGradient)! - File annotations from FileParserPlugin are now available in streaming responses.
  If you use `streamText()` with PDFs or other files, you can now access parsed file content via `providerMetadata.openrouter.annotations` in the finish event.
  This was already available for non-streaming responses.

## 1.5.2

### Patch Changes

- [#288](https://github.com/OpenRouterTeam/ai-sdk-provider/pull/288) [`0caf9f1`](https://github.com/OpenRouterTeam/ai-sdk-provider/commit/0caf9f174a280598aadce27835605e0b6108e2d3) Thanks [@subtleGradient](https://github.com/subtleGradient)! - Fix Gemini 3 tool-call conversations stopping prematurely when thoughtSignature (encrypted reasoning) is present. Override finishReason from 'stop' to 'tool-calls' when tool calls and encrypted reasoning are detected.

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
