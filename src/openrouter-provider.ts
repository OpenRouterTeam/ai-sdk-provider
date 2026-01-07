import type { ProviderV3 } from '@ai-sdk/provider';
import { loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';
import { OpenRouterChatLanguageModel } from './chat/openrouter-chat-language-model.js';
import { OpenRouterEmbeddingModel } from './embedding/openrouter-embedding-model.js';
import { OpenRouterImageModel } from './image/openrouter-image-model.js';
import type {
  OpenRouterProviderSettings,
  OpenRouterModelOptions,
} from './openrouter-config.js';

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
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
  extraBody?: Record<string, unknown>;
  modelOptions?: OpenRouterModelOptions;
}

/**
 * Creates an OpenRouter provider instance.
 *
 * @param options - Provider settings including API key, base URL, headers, and fetch implementation.
 * @returns An OpenRouter provider that can create language, embedding, and image models.
 *
 * @example
 * ```ts
 * import { createOpenRouter } from '@openrouter/ai-sdk-provider';
 *
 * const openrouter = createOpenRouter({
 *   apiKey: process.env.OPENROUTER_API_KEY,
 * });
 *
 * const model = openrouter('anthropic/claude-3.5-sonnet');
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

    return {
      apiKey,
      baseURL,
      headers: options.headers,
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
