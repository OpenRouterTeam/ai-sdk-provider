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
 * OpenRouter provider settings
 */
export interface OpenRouterProviderSettings {
  baseURL?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  generateId?: () => string;
}

/**
 * Embedding settings
 */
export interface OpenRouterEmbeddingSettings {
  dimensions?: number;
  user?: string;
}

/**
 * Image settings
 */
export interface OpenRouterImageSettings {
  size?: string;
  quality?: string;
  style?: string;
  n?: number;
  user?: string;
}

/**
 * OpenRouter provider interface
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
 * Create an OpenRouter provider instance
 */
export function createOpenRouter(options: OpenRouterProviderSettings = {}): OpenRouterProvider {
  const baseURL = withoutTrailingSlash(options.baseURL) ?? 'https://openrouter.ai/api/v1';

  const apiKey = loadApiKey({
    apiKey: options.apiKey,
    environmentVariableName: 'OPENROUTER_API_KEY',
    description: 'OpenRouter',
  });

  const createModelConfig = (): OpenRouterModelConfig => ({
    provider: 'openrouter',
    baseURL,
    apiKey,
    generateId: options.generateId ?? generateId,
    fetch: options.fetch,
  });

  const createChatModel = (modelId: string, settings: OpenRouterChatSettings = {}) =>
    new OpenRouterChatLanguageModel(modelId, settings, createModelConfig());

  const createEmbeddingModel = (modelId: string, settings: OpenRouterEmbeddingSettings = {}) =>
    new OpenRouterEmbeddingModel(modelId, settings, createModelConfig());

  const createImageModel = (modelId: string, settings: OpenRouterImageSettings = {}) =>
    new OpenRouterImageModel(modelId, settings, createModelConfig());

  const provider = function (modelId: string, settings?: OpenRouterChatSettings) {
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
