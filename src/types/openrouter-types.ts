/**
 * OpenRouter provider settings for initializing the provider
 */
export interface OpenRouterProviderSettings {
  /**
   * Base URL for the OpenRouter API.
   * Default: 'https://openrouter.ai/api/v1'
   */
  baseURL?: string;

  /**
   * API key for authenticating with OpenRouter.
   * Can be provided directly or via OPENROUTER_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Custom headers to include with each request
   */
  headers?: Record<string, string>;

  /**
   * Optional custom fetch implementation
   */
  fetch?: typeof fetch;

  /**
   * Custom function for generating IDs
   */
  generateId?: () => string;
}

/**
 * OpenRouter-specific chat settings
 */
export interface OpenRouterChatSettings {
  /**
   * Optional transforms to apply to the model's output.
   * OpenRouter supports various transforms like 'middle-out'
   */
  transforms?: string[];

  /**
   * Models to use for routing. OpenRouter can route between multiple models.
   */
  models?: string[];

  /**
   * Routing strategy
   */
  route?: 'fallback';

  /**
   * Custom provider name for usage tracking
   */
  provider?: string;

  /**
   * Whether to use structured outputs (JSON mode)
   */
  structuredOutputs?: boolean;

  /**
   * User identifier for rate limiting and tracking
   */
  user?: string;

  /**
   * OpenRouter-specific provider options
   */
  providerOptions?: {
    openrouter?: OpenRouterProviderOptions;
  };
}

/**
 * OpenRouter-specific provider options that can be passed at various levels
 */
export interface OpenRouterProviderOptions {
  /**
   * Optional transforms to apply to the model's output
   */
  transforms?: string[];

  /**
   * Models to use for routing
   */
  models?: string[];

  /**
   * Routing strategy
   */
  route?: 'fallback';

  /**
   * Whether to include reasoning details in the response
   */
  includeReasoning?: boolean;
}

/**
 * OpenRouter embedding model settings
 */
export interface OpenRouterEmbeddingSettings {
  /**
   * Dimensions for the embedding vector
   */
  dimensions?: number;

  /**
   * User identifier for rate limiting and tracking
   */
  user?: string;

  /**
   * OpenRouter-specific provider options
   */
  providerOptions?: {
    openrouter?: {
      /**
       * Custom parameters for the embedding model
       */
      [key: string]: unknown;
    };
  };
}

/**
 * OpenRouter image generation settings
 */
export interface OpenRouterImageSettings {
  /**
   * Size of the generated image
   */
  size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792';

  /**
   * Quality of the generated image
   */
  quality?: 'standard' | 'hd';

  /**
   * Style preset for the generated image
   */
  style?: 'vivid' | 'natural';

  /**
   * Number of images to generate
   */
  n?: number;

  /**
   * User identifier for rate limiting and tracking
   */
  user?: string;

  /**
   * OpenRouter-specific provider options
   */
  providerOptions?: {
    openrouter?: {
      /**
       * Custom parameters for the image model
       */
      [key: string]: unknown;
    };
  };
}

/**
 * Configuration for OpenRouter models
 */
export interface OpenRouterModelConfig {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  generateId: () => string;
  fetch?: typeof fetch;
}

/**
 * OpenRouter API response for chat completions
 */
export interface OpenRouterChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content?: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
      reasoning_content?: string; // OpenRouter's reasoning details
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number; // Tokens used for reasoning
    cached_tokens?: number;
  };
  system_fingerprint?: string;
  // OpenRouter-specific fields
  reasoning_details?: {
    content: string;
    tokens: number;
  };
  provider?: string;
  model_id?: string;
}

/**
 * OpenRouter streaming chunk
 */
export interface OpenRouterStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
      reasoning_content?: string; // Streaming reasoning content
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    reasoning_tokens?: number;
    cached_tokens?: number;
  };
  // OpenRouter-specific fields for streaming
  reasoning_details?: {
    content?: string;
    tokens?: number;
  };
}

/**
 * OpenRouter embedding response
 */
export interface OpenRouterEmbeddingResponse {
  object: 'list';
  data: Array<{
    object: 'embedding';
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenRouter image generation response
 */
export interface OpenRouterImageResponse {
  created: number;
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
}

/**
 * Reasoning details that will be stored in provider metadata
 */
export interface OpenRouterReasoningDetails {
  content: string;
  tokens: number;
}

/**
 * Provider metadata specific to OpenRouter
 */
export interface OpenRouterProviderMetadata {
  openrouter?: {
    reasoning?: OpenRouterReasoningDetails;
    model_id?: string;
    provider?: string;
    cached_tokens?: number;
  };
  [key: string]: unknown;
}