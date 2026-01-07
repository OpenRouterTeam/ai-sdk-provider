import type { ProviderV3 } from '@ai-sdk/provider';
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
  _options?: OpenRouterProviderSettings
): OpenRouterProvider {
  throw new Error('Not implemented');
}
