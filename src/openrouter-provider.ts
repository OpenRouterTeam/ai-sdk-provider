import {
  generateId,
  loadApiKey,
  withoutTrailingSlash,
} from '@ai-sdk/provider-utils';
import type { ProviderV2 } from '@ai-sdk/provider';
import { OpenRouterChatLanguageModel } from './openrouter-chat-language-model';
import { OpenRouterEmbeddingModel } from './openrouter-embedding-model';
import { OpenRouterImageModel } from './openrouter-image-model';
import type {
  OpenRouterProviderSettings,
  OpenRouterChatSettings,
  OpenRouterEmbeddingSettings,
  OpenRouterImageSettings,
  OpenRouterModelConfig,
} from './types';

/**
 * OpenRouter provider interface extending ProviderV2
 */
export interface OpenRouterProvider extends ProviderV2 {
  /**
   * Create a chat language model with the specified model ID and settings
   */
  (modelId: string, settings?: OpenRouterChatSettings): OpenRouterChatLanguageModel;

  /**
   * Create a chat language model with the specified model ID and settings
   */
  languageModel(
    modelId: string,
    settings?: OpenRouterChatSettings,
  ): OpenRouterChatLanguageModel;

  /**
   * Create a chat language model with the specified model ID and settings
   * Alias for languageModel
   */
  chat(
    modelId: string,
    settings?: OpenRouterChatSettings,
  ): OpenRouterChatLanguageModel;

  /**
   * Create a text embedding model with the specified model ID and settings
   */
  textEmbeddingModel(
    modelId: string,
    settings?: OpenRouterEmbeddingSettings,
  ): OpenRouterEmbeddingModel;

  /**
   * Create a text embedding model with the specified model ID and settings
   * Alias for textEmbeddingModel
   */
  embedding(
    modelId: string,
    settings?: OpenRouterEmbeddingSettings,
  ): OpenRouterEmbeddingModel;

  /**
   * Create an image generation model with the specified model ID and settings
   */
  imageModel(
    modelId: string,
    settings?: OpenRouterImageSettings,
  ): OpenRouterImageModel;

  /**
   * Create an image generation model with the specified model ID and settings
   * Alias for imageModel
   */
  image(
    modelId: string,
    settings?: OpenRouterImageSettings,
  ): OpenRouterImageModel;
}

/**
 * Create an OpenRouter provider instance
 */
export function createOpenRouter(
  options: OpenRouterProviderSettings = {},
): OpenRouterProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL) ?? 'https://openrouter.ai/api/v1';

  const getHeaders = () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: 'OPENROUTER_API_KEY',
      description: 'OpenRouter',
    })}`,
    'X-Title': 'OpenRouter AI SDK Provider',
    'Content-Type': 'application/json',
    ...options.headers,
  });

  const createModelConfig = (): OpenRouterModelConfig => ({
    provider: 'openrouter',
    baseURL,
    headers: getHeaders,
    generateId: options.generateId ?? generateId,
    fetch: options.fetch,
  });

  const createChatModel = (
    modelId: string,
    settings: OpenRouterChatSettings = {},
  ) => new OpenRouterChatLanguageModel(modelId, settings, createModelConfig());

  const createEmbeddingModel = (
    modelId: string,
    settings: OpenRouterEmbeddingSettings = {},
  ) => new OpenRouterEmbeddingModel(modelId, settings, createModelConfig());

  const createImageModel = (
    modelId: string,
    settings: OpenRouterImageSettings = {},
  ) => new OpenRouterImageModel(modelId, settings, createModelConfig());

  const provider = function (
    modelId: string,
    settings?: OpenRouterChatSettings,
  ) {
    if (new.target) {
      throw new Error(
        'The OpenRouter model factory function cannot be called with the new keyword.',
      );
    }

    return createChatModel(modelId, settings);
  };

  provider.languageModel = createChatModel;
  provider.chat = createChatModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.embedding = createEmbeddingModel;
  provider.imageModel = createImageModel;
  provider.image = createImageModel;

  return provider as OpenRouterProvider;
}

/**
 * Default OpenRouter provider instance
 */
export const openrouter = createOpenRouter();