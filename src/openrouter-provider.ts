import type { ProviderV2 } from '@ai-sdk/provider';
import type {
  OpenRouterChatSettings,
  OpenRouterModelConfig,
} from './openrouter-chat-language-model';

import { generateId, loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';
import { OpenRouterChatLanguageModel } from './openrouter-chat-language-model';
import { OpenRouterEmbeddingModel } from './openrouter-embedding-model';
import { OpenRouterImageModel } from './openrouter-image-model';

/**
 * OpenRouter provider settings.
 *
 * These settings configure how the provider connects to OpenRouter's API.
 * OpenRouter acts as a unified gateway to multiple AI providers (OpenAI, Anthropic,
 * Google, etc.), allowing you to switch between models without changing your code.
 */
export interface OpenRouterProviderSettings {
  /**
   * Base URL for the OpenRouter API.
   * Defaults to 'https://openrouter.ai/api/v1'.
   * Override this for testing or using a proxy.
   */
  baseURL?: string;
  /**
   * OpenRouter API key. If not provided, reads from OPENROUTER_API_KEY env var.
   * Get your API key from https://openrouter.ai/keys
   */
  apiKey?: string;
  /**
   * Additional headers to include in all requests.
   * Useful for passing custom headers like X-Title for app identification.
   */
  headers?: Record<string, string>;
  /**
   * Custom fetch implementation for environments without global fetch.
   */
  fetch?: typeof fetch;
  /**
   * Custom ID generator for tool calls and streaming chunks.
   * Defaults to the AI SDK's built-in generateId function.
   */
  generateId?: () => string;
}

/**
 * Settings for text embedding models.
 *
 * Embeddings convert text into numerical vectors that capture semantic meaning,
 * useful for similarity search, clustering, and retrieval-augmented generation.
 */
export interface OpenRouterEmbeddingSettings {
  /**
   * Output dimensions for the embedding vector.
   * Lower dimensions reduce storage/compute costs but may lose semantic precision.
   * Not all models support dimension reduction - check model documentation.
   */
  dimensions?: number;
  /**
   * Associate embeddings with a specific end-user for rate limiting and abuse detection.
   */
  user?: string;
}

/**
 * Settings for image generation models.
 *
 * These settings control image output characteristics when using models
 * like DALL-E or Stable Diffusion through OpenRouter.
 */
export interface OpenRouterImageSettings {
  /**
   * Image size in format "WIDTHxHEIGHT" (e.g., "1024x1024").
   * Available sizes depend on the specific model being used.
   */
  size?: string;
  /**
   * Image quality level. Typically "standard" or "hd".
   * Higher quality may increase generation time and cost.
   */
  quality?: string;
  /**
   * Image style preset. Model-specific (e.g., "vivid" or "natural" for DALL-E 3).
   */
  style?: string;
  /**
   * Number of images to generate per request.
   * Limited by model capabilities and rate limits.
   */
  n?: number;
  /**
   * Associate generations with a specific end-user for rate limiting and abuse detection.
   */
  user?: string;
}

/**
 * OpenRouter provider interface.
 *
 * The provider is callable directly for chat models (the most common use case),
 * and exposes methods for other model types. This design follows the Vercel AI SDK
 * pattern where `provider(modelId)` is shorthand for `provider.chat(modelId)`.
 */
export interface OpenRouterProvider extends ProviderV2 {
  (modelId: string, settings?: OpenRouterChatSettings): OpenRouterChatLanguageModel;
  languageModel(modelId: string, settings?: OpenRouterChatSettings): OpenRouterChatLanguageModel;
  chat(modelId: string, settings?: OpenRouterChatSettings): OpenRouterChatLanguageModel;
  textEmbeddingModel(
    modelId: string,
    settings?: OpenRouterEmbeddingSettings,
  ): OpenRouterEmbeddingModel;
  embedding(modelId: string, settings?: OpenRouterEmbeddingSettings): OpenRouterEmbeddingModel;
  imageModel(modelId: string, settings?: OpenRouterImageSettings): OpenRouterImageModel;
  image(modelId: string, settings?: OpenRouterImageSettings): OpenRouterImageModel;
}

/**
 * Create an OpenRouter provider instance.
 *
 * @example
 * ```ts
 * import { createOpenRouter } from '@openrouter/ai-provider';
 *
 * const openrouter = createOpenRouter({ apiKey: 'your-key' });
 * const model = openrouter('anthropic/claude-3.5-sonnet');
 * ```
 */
export function createOpenRouter(options: OpenRouterProviderSettings = {}): OpenRouterProvider {
  // OpenRouter's unified API endpoint - all model providers (OpenAI, Anthropic, Google, etc.)
  // are accessed through this single URL. OpenRouter handles routing to the appropriate backend.
  const baseURL = withoutTrailingSlash(options.baseURL) ?? 'https://openrouter.ai/api/v1';

  // Factory function to create model config - called fresh for each model instance
  // to ensure isolation and allow for future per-model customization.
  // API key loading is deferred to model creation time so environment variables
  // set after provider creation are properly read.
  const createModelConfig = (): OpenRouterModelConfig => ({
    provider: 'openrouter',
    baseURL,
    // Use AI SDK's loadApiKey utility for consistent API key handling across providers.
    // This supports both explicit apiKey option and OPENROUTER_API_KEY environment variable.
    // Loading at model creation time (not provider creation) ensures env vars set after
    // module load are picked up, matching v1 behavior.
    apiKey: loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: 'OPENROUTER_API_KEY',
      description: 'OpenRouter',
    }),
    // Use AI SDK's generateId for consistent ID generation across the SDK ecosystem
    generateId: options.generateId ?? generateId,
    fetch: options.fetch,
  });

  const createChatModel = (modelId: string, settings: OpenRouterChatSettings = {}) =>
    new OpenRouterChatLanguageModel(modelId, settings, createModelConfig());

  const createEmbeddingModel = (modelId: string, settings: OpenRouterEmbeddingSettings = {}) =>
    new OpenRouterEmbeddingModel(modelId, settings, createModelConfig());

  const createImageModel = (modelId: string, settings: OpenRouterImageSettings = {}) =>
    new OpenRouterImageModel(modelId, settings, createModelConfig());

  // The provider is implemented as a callable function for ergonomic usage:
  // `openrouter('model-id')` instead of `openrouter.chat('model-id')`
  // This follows the pattern established by other AI SDK providers.
  const provider = function (modelId: string, settings?: OpenRouterChatSettings) {
    // Prevent accidental `new provider()` calls which would create an object instead of a model
    if (new.target) {
      throw new Error(
        'The OpenRouter model factory function cannot be called with the new keyword.',
      );
    }
    return createChatModel(modelId, settings);
  };

  // Attach model factory methods to the provider function.
  // Both verbose (languageModel, textEmbeddingModel, imageModel) and short (chat, embedding, image)
  // aliases are provided for developer preference and AI SDK compatibility.
  provider.languageModel = createChatModel;
  provider.chat = createChatModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.embedding = createEmbeddingModel;
  provider.imageModel = createImageModel;
  provider.image = createImageModel;

  return provider as OpenRouterProvider;
}

/**
 * Default OpenRouter provider instance.
 *
 * Uses OPENROUTER_API_KEY environment variable for authentication.
 * For custom configuration, use createOpenRouter() instead.
 *
 * @example
 * ```ts
 * import { openrouter } from '@openrouter/ai-provider';
 * import { generateText } from 'ai';
 *
 * const { text } = await generateText({
 *   model: openrouter('anthropic/claude-3.5-sonnet'),
 *   prompt: 'Hello!',
 * });
 * ```
 */
export const openrouter = createOpenRouter();
