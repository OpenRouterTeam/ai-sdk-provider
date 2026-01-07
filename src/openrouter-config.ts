/**
 * Settings for the OpenRouter provider.
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
 * Plugin configuration for OpenRouter.
 *
 * Plugins can have arbitrary configuration properties in addition to the id.
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
 * Provider routing configuration.
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
 * Model-specific options for OpenRouter.
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
