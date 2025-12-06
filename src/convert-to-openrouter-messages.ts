/**
 * Message conversion utilities for transforming AI SDK messages to OpenRouter formats.
 *
 * This file re-exports from the modular converters for backwards compatibility.
 * For new code, consider importing directly from './converters' for better tree-shaking.
 *
 * @see ./converters/index.ts for the main conversion functions
 * @see ./converters/types.ts for type utilities
 * @see ./converters/file-parts.ts for file handling
 * @see ./converters/message-parts.ts for message part processing
 * @see ./converters/reasoning.ts for reasoning extraction
 */

// Re-export types
export type {
  ApiReasoningDetailItem,
  ClassifiedFileData,
  ResponsesContentItem,
  ToolOutputResult,
  ToolOutputType,
} from './converters';

// Re-export all public APIs from converters module
export {
  // Type utilities
  assertNever,
  classifyFileData,
  // File part converters
  convertFilePartToChatItem,
  convertFilePartToResponsesItem,
  // Main conversion functions
  convertToOpenRouterMessages,
  convertToResponsesInput,
  extractReasoningDetails,
  // Reasoning utilities
  extractReasoningFromResponse,
  toolOutputToString,
  transformReasoningToApiFormat,
} from './converters';
