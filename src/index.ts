export type {
  OpenRouterModelOptions,
  OpenRouterPluginConfig,
  OpenRouterProviderRoutingConfig,
  OpenRouterProviderSettings,
} from './openrouter-config.js';

export {
  createOpenRouter,
  type OpenRouterModelSettings,
  type OpenRouterProvider,
} from './openrouter-provider.js';
export { VERSION } from './version.js';

// Default instance
import { createOpenRouter } from './openrouter-provider.js';

/**
 * Default OpenRouter provider instance.
 *
 * Uses OPENROUTER_API_KEY environment variable for authentication.
 *
 * @example
 * ```ts
 * import { openrouter } from '@openrouter/ai-sdk-provider';
 *
 * const model = openrouter('anthropic/claude-3.5-sonnet');
 * ```
 */
export const openrouter = createOpenRouter();
