/**
 * OpenRouter AI SDK Provider
 *
 * A provider implementation for the Vercel AI SDK that enables
 * integration with OpenRouter's unified API for various AI models.
 */

// Main provider exports
export {
  createOpenRouter,
  openrouter,
  type OpenRouterProvider,
} from './openrouter-provider';

// Model implementations
export { OpenRouterChatLanguageModel } from './openrouter-chat-language-model';
export { OpenRouterEmbeddingModel } from './openrouter-embedding-model';
export { OpenRouterImageModel } from './openrouter-image-model';

// Type exports
export type {
  // Provider settings
  OpenRouterProviderSettings,

  // Model settings
  OpenRouterChatSettings,
  OpenRouterEmbeddingSettings,
  OpenRouterImageSettings,

  // Provider options
  OpenRouterProviderOptions,

  // API response types
  OpenRouterChatResponse,
  OpenRouterStreamChunk,
  OpenRouterEmbeddingResponse,
  OpenRouterImageResponse,

  // Reasoning support
  OpenRouterReasoningDetails,
  OpenRouterProviderMetadata,

  // Model configuration
  OpenRouterModelConfig,
} from './types';

// Utility exports (for advanced users)
export {
  convertToOpenRouterMessages,
  extractReasoningFromResponse,
  type OpenRouterMessage,
  type OpenRouterContentPart,
} from './convert-to-openrouter-messages';

export {
  mapOpenRouterFinishReason,
} from './map-openrouter-finish-reason';

export {
  handleOpenRouterError,
  type OpenRouterErrorResponse,
} from './utils/error-handler';

// Re-export commonly used AI SDK types for convenience
export type {
  LanguageModelV2,
  EmbeddingModelV2,
  ImageModelV2,
  LanguageModelV2Prompt,
  LanguageModelV2Message,
  LanguageModelV2Content,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider';