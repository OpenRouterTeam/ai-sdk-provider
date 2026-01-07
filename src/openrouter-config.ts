/**
 * Settings for configuring an OpenRouter provider instance.
 *
 * @description
 * Configuration options passed to `createOpenRouter()` to customize the provider behavior.
 * All settings are optional - the provider will use sensible defaults and environment
 * variables when settings are not explicitly provided.
 *
 * @example
 * ```ts
 * import { createOpenRouter } from '@openrouter/ai-sdk-provider';
 *
 * const openrouter = createOpenRouter({
 *   apiKey: process.env.OPENROUTER_API_KEY,
 *   baseURL: 'https://openrouter.ai/api/v1',
 *   headers: {
 *     'X-Title': 'My App',
 *     'HTTP-Referer': 'https://myapp.com',
 *   },
 * });
 * ```
 */
export interface OpenRouterProviderSettings {
  /**
   * API key for OpenRouter. If not provided, will use OPENROUTER_API_KEY env var.
   */
  apiKey?: string;

  /**
   * Base URL for the OpenRouter API.
   * @default 'https://openrouter.ai/api/v1'
   */
  baseURL?: string;

  /**
   * Base URL for the OpenRouter API (alias for baseURL).
   * @default 'https://openrouter.ai/api/v1'
   * @deprecated Use baseURL instead.
   */
  baseUrl?: string;

  /**
   * Custom headers to include in all requests.
   */
  headers?: Record<string, string>;

  /**
   * Custom fetch implementation.
   */
  fetch?: typeof globalThis.fetch;

  /**
   * Extra body parameters to include in all requests.
   */
  extraBody?: Record<string, unknown>;
}

/**
 * Configuration for an OpenRouter plugin.
 *
 * @description
 * Plugins extend OpenRouter functionality with features like web search, code execution,
 * and more. Each plugin has a unique identifier and optional configuration parameters.
 * Additional plugin-specific properties can be included as needed.
 *
 * @example
 * ```ts
 * const model = openrouter('anthropic/claude-3.5-sonnet', {
 *   plugins: [
 *     { id: 'web-search' },
 *     { id: 'code-interpreter', config: { timeout: 30000 } },
 *   ],
 * });
 * ```
 */
export interface OpenRouterPluginConfig {
  /**
   * The plugin identifier.
   */
  id: string;

  /**
   * Plugin-specific configuration.
   */
  config?: Record<string, unknown>;

  /**
   * Allow any additional plugin-specific properties.
   */
  [key: string]: unknown;
}

/**
 * Configuration for OpenRouter's provider routing behavior.
 *
 * @description
 * Controls how OpenRouter selects and falls back between different AI providers
 * when routing requests. Use this to specify provider preferences, enable/disable
 * fallbacks, and require specific provider parameters.
 *
 * @example
 * ```ts
 * const model = openrouter('openai/gpt-4', {
 *   provider: {
 *     order: ['Azure', 'OpenAI'],
 *     allowFallbacks: true,
 *   },
 * });
 * ```
 */
export interface OpenRouterProviderRoutingConfig {
  /**
   * Provider order preference.
   */
  order?: string[];

  /**
   * Allow fallbacks to other providers.
   */
  allowFallbacks?: boolean;

  /**
   * Required provider parameters.
   */
  requireParameters?: boolean;
}

/**
 * Model-specific options for OpenRouter requests.
 *
 * @description
 * Options that can be passed when creating a model to customize its behavior.
 * These include OpenRouter-specific features like plugins, transforms, model
 * fallbacks, and routing configuration. Additional properties are passed through
 * to the underlying API.
 *
 * @example
 * ```ts
 * const model = openrouter('anthropic/claude-3.5-sonnet', {
 *   usage: { include: true },
 *   transforms: ['middle-out'],
 *   models: ['anthropic/claude-3-opus', 'openai/gpt-4'],  // fallbacks
 *   provider: {
 *     order: ['Anthropic'],
 *     allowFallbacks: false,
 *   },
 * });
 * ```
 */
export interface OpenRouterModelOptions {
  /**
   * Usage accounting configuration.
   */
  usage?: {
    /**
     * Whether to include usage information in the response.
     */
    include?: boolean;
  };

  /**
   * OpenRouter plugins to enable.
   */
  plugins?: OpenRouterPluginConfig[];

  /**
   * Message transforms to apply.
   */
  transforms?: string[];

  /**
   * Fallback model IDs.
   */
  models?: string[];

  /**
   * Routing strategy.
   */
  route?: string;

  /**
   * Provider routing configuration.
   */
  provider?: OpenRouterProviderRoutingConfig;

  /**
   * How to handle system messages for reasoning models.
   * - 'system': Standard system message (default)
   * - 'developer': Convert system to developer role for reasoning models
   * - 'remove': Strip system messages entirely
   */
  systemMessageMode?: 'system' | 'developer' | 'remove';

  /**
   * Allow any additional model-specific options.
   * These are passed through to the API.
   */
  [key: string]: unknown;
}
