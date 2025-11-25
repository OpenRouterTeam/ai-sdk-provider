/**
 * OpenRouter AI SDK Provider
 */

// Re-export AI SDK types for convenience
export type {
  EmbeddingModelV2,
  ImageModelV2,
  LanguageModelV2,
  LanguageModelV2Content,
  LanguageModelV2Message,
  LanguageModelV2Prompt,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider';

// Utility exports
export { convertToOpenRouterMessages } from './convert-to-openrouter-messages';
// Model implementations
export {
  OpenRouterChatLanguageModel,
  type OpenRouterChatSettings,
  type OpenRouterModelConfig,
} from './openrouter-chat-language-model';
export { OpenRouterEmbeddingModel } from './openrouter-embedding-model';
export { OpenRouterImageModel } from './openrouter-image-model';
// Main provider exports
export {
  createOpenRouter,
  type OpenRouterEmbeddingSettings,
  type OpenRouterImageSettings,
  type OpenRouterProvider,
  type OpenRouterProviderSettings,
  openrouter,
} from './openrouter-provider';
