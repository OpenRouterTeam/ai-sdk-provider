import type { ProviderV3 } from '@ai-sdk/provider';
import { loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';
import { SDK_METADATA } from '@openrouter/sdk';
import { OpenRouterChatLanguageModel } from './chat/openrouter-chat-language-model.js';
import { OpenRouterEmbeddingModel } from './embedding/openrouter-embedding-model.js';
import { OpenRouterImageModel } from './image/openrouter-image-model.js';
import type {
  OpenRouterProviderSettings,
  OpenRouterModelOptions,
} from './openrouter-config.js';

declare const __PACKAGE_VERSION__: string;

/**
 * OpenRouter provider interface extending the AI SDK V3 ProviderV3 interface.
 *
 * The provider is callable - calling it directly is equivalent to calling languageModel().
 */
export interface OpenRouterProvider extends ProviderV3 {
  /**
   * Create a language model by calling the provider directly.
   */
  (modelId: string, settings?: OpenRouterModelOptions): OpenRouterChatLanguageModel;

  /**
   * Create a language model.
   */
  languageModel(modelId: string, settings?: OpenRouterModelOptions): OpenRouterChatLanguageModel;

  /**
   * Create a chat model (alias for languageModel).
   */
  chat(modelId: string, settings?: OpenRouterModelOptions): OpenRouterChatLanguageModel;

  /**
   * Create an embedding model.
   */
  embeddingModel(modelId: string, settings?: OpenRouterModelOptions): OpenRouterEmbeddingModel;

  /**
   * Create a text embedding model.
   * @deprecated Use embeddingModel instead.
   */
  textEmbeddingModel(modelId: string, settings?: OpenRouterModelOptions): OpenRouterEmbeddingModel;

  /**
   * Create an image model.
   */
  imageModel(modelId: string, settings?: OpenRouterModelOptions): OpenRouterImageModel;

  /**
   * Create an image model (alias for imageModel).
   */
  image(modelId: string, settings?: OpenRouterModelOptions): OpenRouterImageModel;

  /**
   * Create an embedding model (alias for embeddingModel).
   * @deprecated Use embeddingModel instead.
   */
  embedding(modelId: string, settings?: OpenRouterModelOptions): OpenRouterEmbeddingModel;
}

/**
 * Internal settings passed to model constructors.
 * Contains resolved API key and normalized configuration.
 */
export interface OpenRouterModelSettings {
  apiKey: string;
  baseURL: string;
  /**
   * User-Agent string used by `@openrouter/sdk`.
   *
   * Note: Setting a `User-Agent` header via `fetchOptions.headers` is ineffective because
   * the SDK sets it after merging user headers.
   */
  userAgent: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
  extraBody?: Record<string, unknown>;
  modelOptions?: OpenRouterModelOptions;
}

/**
 * Creates an OpenRouter provider instance for the AI SDK.
 *
 * @description
 * Factory function that creates an OpenRouter provider compatible with the AI SDK v3 provider
 * specification. The provider can create language models, embedding models, and image models
 * that route requests through OpenRouter to various AI providers (OpenAI, Anthropic, Google, etc.).
 *
 * The returned provider is callable - you can use it directly as a function to create language
 * models, or use its methods for specific model types.
 *
 * @param options - Provider settings including API key, base URL, headers, and fetch implementation.
 *   If no API key is provided, it will be loaded from the OPENROUTER_API_KEY environment variable.
 * @returns An OpenRouter provider that can create language, embedding, and image models.
 *
 * @example Basic usage with environment variable
 * ```ts
 * import { createOpenRouter } from '@openrouter/ai-sdk-provider';
 *
 * // Uses OPENROUTER_API_KEY from environment
 * const openrouter = createOpenRouter();
 *
 * const model = openrouter('anthropic/claude-3.5-sonnet');
 * ```
 *
 * @example With explicit API key
 * ```ts
 * import { createOpenRouter } from '@openrouter/ai-sdk-provider';
 *
 * const openrouter = createOpenRouter({
 *   apiKey: process.env.OPENROUTER_API_KEY,
 * });
 *
 * const model = openrouter('anthropic/claude-3.5-sonnet');
 * ```
 *
 * @example Creating different model types
 * ```ts
 * const openrouter = createOpenRouter();
 *
 * // Language model (callable shorthand)
 * const chat = openrouter('anthropic/claude-3.5-sonnet');
 *
 * // Embedding model
 * const embeddings = openrouter.embeddingModel('openai/text-embedding-3-small');
 *
 * // Image model
 * const image = openrouter.imageModel('openai/dall-e-3');
 * ```
 *
 * @example Model variants
 * ```ts
 * const openrouter = createOpenRouter();
 *
 * // Online search variant - model has web search capabilities
 * const online = openrouter('anthropic/claude-3.5-sonnet:online');
 *
 * // Nitro variant - faster inference
 * const nitro = openrouter('anthropic/claude-3.5-sonnet:nitro');
 *
 * // Floor pricing variant - routes to cheapest provider
 * const floor = openrouter('anthropic/claude-3.5-sonnet:floor');
 *
 * // Free tier variant
 * const free = openrouter('meta-llama/llama-3-8b-instruct:free');
 * ```
 */
export function createOpenRouter(
  options: OpenRouterProviderSettings = {}
): OpenRouterProvider {
  // Normalize base URL: accept baseURL or baseUrl, strip trailing slash
  // The fallback ensures we always have a value, so the non-null assertion is safe
  const baseURL = withoutTrailingSlash(
    options.baseURL ?? options.baseUrl ?? 'https://openrouter.ai/api/v1'
  )!;

  /**
   * Resolves model settings at model creation time.
   * API key is loaded here (not at provider creation or request time) per Decision 1 - Fail Fast.
   */
  const getModelSettings = (modelOptions?: OpenRouterModelOptions): OpenRouterModelSettings => {
    // Load API key at model creation time
    const apiKey = loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: 'OPENROUTER_API_KEY',
      description: 'OpenRouter',
    });

    const providerUserAgentPart = `ai-sdk-provider/${__PACKAGE_VERSION__}`;

    // Allow overriding the base UA via headers, but always append our provider token.
    const baseUserAgent =
      options.headers?.['user-agent'] ?? options.headers?.['User-Agent'] ?? SDK_METADATA.userAgent;

    const userAgent = baseUserAgent.includes('ai-sdk-provider/')
      ? baseUserAgent
      : `${baseUserAgent} ${providerUserAgentPart}`;

    const {
      'User-Agent': _ignoredUserAgent,
      'user-agent': _ignoredUserAgentLower,
      ...forwardHeaders
    } = options.headers ?? {};

    return {
      apiKey,
      baseURL,
      userAgent,
      headers: Object.keys(forwardHeaders).length > 0 ? forwardHeaders : undefined,
      fetch: options.fetch,
      extraBody: options.extraBody,
      modelOptions,
    };
  };

  /**
   * Create a language model.
   */
  const languageModel = (
    modelId: string,
    modelOptions?: OpenRouterModelOptions
  ): OpenRouterChatLanguageModel => {
    return new OpenRouterChatLanguageModel(modelId, getModelSettings(modelOptions));
  };

  /**
   * Create an embedding model.
   */
  const embeddingModel = (
    modelId: string,
    modelOptions?: OpenRouterModelOptions
  ): OpenRouterEmbeddingModel => {
    return new OpenRouterEmbeddingModel(modelId, getModelSettings(modelOptions));
  };

  /**
   * Create an image model.
   */
  const imageModel = (
    modelId: string,
    modelOptions?: OpenRouterModelOptions
  ): OpenRouterImageModel => {
    return new OpenRouterImageModel(modelId, getModelSettings(modelOptions));
  };

  // Create the callable provider object
  const provider = Object.assign(
    // Make provider callable - calling it directly creates a language model
    (modelId: string, modelOptions?: OpenRouterModelOptions) => languageModel(modelId, modelOptions),
    {
      specificationVersion: 'v3' as const,
      languageModel,
      chat: languageModel,
      embeddingModel,
      textEmbeddingModel: embeddingModel,
      imageModel,
      image: imageModel,
      embedding: embeddingModel,
    }
  );

  return provider;
}
