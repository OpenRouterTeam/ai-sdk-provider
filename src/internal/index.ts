// Re-export internal utilities for advanced users
export { buildUsage } from '../utils/build-usage.js';
export { buildProviderMetadata } from '../utils/build-provider-metadata.js';
export { parseOpenRouterOptions } from '../utils/parse-provider-options.js';
export { mapOpenRouterFinishReason } from '../chat/map-openrouter-finish-reason.js';
export { convertToOpenRouterMessages } from '../chat/convert-to-openrouter-messages.js';

// Re-export internal types
export type { OpenRouterRawUsage } from '../utils/build-usage.js';
export type {
  OpenRouterProviderMetadata,
  OpenRouterResponseData,
} from '../utils/build-provider-metadata.js';
export type { ParsedProviderOptions } from '../utils/parse-provider-options.js';
