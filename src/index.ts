/**
 * OpenRouter AI SDK Provider
 */

// Main provider exports
export {
  createOpenRouter,
  openrouter,
  type OpenRouterProvider,
  type OpenRouterProviderSettings,
  type OpenRouterEmbeddingSettings,
  type OpenRouterImageSettings,
} from './openrouter-provider';

// Model implementations
export {
  OpenRouterChatLanguageModel,
  type OpenRouterChatSettings,
  type OpenRouterModelConfig,
} from './openrouter-chat-language-model';
export { OpenRouterEmbeddingModel } from './openrouter-embedding-model';
export { OpenRouterImageModel } from './openrouter-image-model';

// Utility exports
export {
  convertToOpenRouterMessages,
} from './convert-to-openrouter-messages';

// Re-export AI SDK types for convenience
export type {
  LanguageModelV2,
  EmbeddingModelV2,
  ImageModelV2,
  LanguageModelV2Prompt,
  LanguageModelV2Message,
  LanguageModelV2Content,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider';
