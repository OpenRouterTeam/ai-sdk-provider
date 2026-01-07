import type { OpenRouterModelOptions } from '../openrouter-config.js';

/**
 * Chat-specific options for OpenRouter language models.
 * Extends the base model options with chat-specific settings.
 */
export interface OpenRouterChatOptions extends OpenRouterModelOptions {
  // Chat-specific options can be added here as needed
}

/**
 * Settings passed to the chat language model at construction time.
 */
export interface OpenRouterChatSettings {
  /**
   * Model ID to use for chat completions.
   */
  modelId: string;

  /**
   * Model-level options that apply to all calls.
   */
  options?: OpenRouterChatOptions;
}
