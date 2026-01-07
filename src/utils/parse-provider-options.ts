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
 * Unknown keys pass through (per design spec - they are passed to the API).
 *
 * @param modelOptions - Options set at model creation time.
 * @param callOptions - Options set at call time via providerOptions.openrouter.
 * @returns The merged options and any warnings.
 */
export function parseOpenRouterOptions(
  modelOptions: OpenRouterModelOptions | undefined,
  callOptions: Record<string, unknown> | undefined
): ParsedProviderOptions {
  // Start with model options as base, shallow merge call options on top
  // Call-time values override model-level for same keys
  const mergedOptions: OpenRouterModelOptions = {
    ...(modelOptions ?? {}),
    ...(callOptions ?? {}),
  };

  // No warnings for unknown keys - they pass through to the API
  // This is by design per the spec: "Unknown keys pass through"
  const warnings: ParsedProviderOptions['warnings'] = [];

  return {
    options: mergedOptions,
    warnings,
  };
}
