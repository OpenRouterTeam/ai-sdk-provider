import type { OpenRouterModelOptions } from '../openrouter-config.js';

/**
 * Result of parsing provider options, including any warnings.
 */
export interface ParsedProviderOptions {
  /**
   * The merged options.
   */
  options: OpenRouterModelOptions;

  /**
   * Warnings generated during parsing (e.g., unknown keys).
   */
  warnings: Array<{
    type: 'unsupported';
    feature: string;
    details?: string;
  }>;
}

/**
 * Parses and merges provider options from model-level and call-time sources.
 *
 * Call-time options override model-level options for the same keys.
 * Unknown keys pass through with a warning.
 *
 * @param modelOptions - Options set at model creation time.
 * @param callOptions - Options set at call time via providerOptions.openrouter.
 * @returns The merged options and any warnings.
 */
export function parseOpenRouterOptions(
  _modelOptions: OpenRouterModelOptions | undefined,
  _callOptions: Record<string, unknown> | undefined
): ParsedProviderOptions {
  throw new Error('Not implemented');
}
