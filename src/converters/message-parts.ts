/**
 * Message part converters for user and assistant messages.
 *
 * This module handles the conversion of individual message content parts
 * (text, files, tool calls, reasoning) to OpenRouter API formats.
 */

import type {
  LanguageModelV2FilePart,
  LanguageModelV2ReasoningPart,
  LanguageModelV2TextPart,
  LanguageModelV2ToolCallPart,
} from '@ai-sdk/provider';
import type {
  ChatMessageContentItem,
  ChatMessageToolCall,
  OpenResponsesFunctionToolCall,
  OpenResponsesReasoning,
  ResponseInputText,
} from '@openrouter/sdk/esm/models';

import {
  convertFilePartToChatItem,
  convertFilePartToResponsesItem,
  type ResponsesContentItem,
} from './file-parts';
import { transformReasoningToApiFormat, type ApiReasoningDetailItem } from './reasoning';
import { assertNever } from './types';

// =============================================================================
// User Message Part Types
// =============================================================================

export type UserContentPart = LanguageModelV2TextPart | LanguageModelV2FilePart;

export interface ConvertedUserPart {
  chatItem: ChatMessageContentItem | null;
  responsesItem: ResponsesContentItem | null;
}

// =============================================================================
// User Part Converters
// =============================================================================

function convertUserTextPart(part: LanguageModelV2TextPart): ConvertedUserPart {
  // Extract cache_control from provider options for prompt caching
  const providerOpts = part.providerOptions as
    | { openrouter?: { cache_control?: unknown } }
    | undefined;
  const cacheControl = providerOpts?.openrouter?.cache_control;

  const chatItem: ChatMessageContentItem & { cache_control?: unknown } = {
    type: 'text',
    text: part.text,
  };
  const responsesItem: ResponseInputText & { cache_control?: unknown } = {
    type: 'input_text',
    text: part.text,
  };

  if (cacheControl) {
    chatItem.cache_control = cacheControl;
    responsesItem.cache_control = cacheControl;
  }

  return { chatItem, responsesItem };
}

function convertUserFilePart(part: LanguageModelV2FilePart): ConvertedUserPart {
  const chatItem = convertFilePartToChatItem(part);
  const responsesItem = convertFilePartToResponsesItem(part);
  return { chatItem, responsesItem };
}

/**
 * Convert a user message content part to both Chat and Responses API formats.
 */
export function convertUserPart(part: UserContentPart): ConvertedUserPart {
  switch (part.type) {
    case 'text':
      return convertUserTextPart(part);

    case 'file':
      return convertUserFilePart(part);

    default:
      return assertNever(
        part,
        `Unsupported user message part type: ${(part as { type: string }).type}`,
      );
  }
}

// =============================================================================
// Assistant Message Part Types
// =============================================================================

export type AssistantContentPart =
  | LanguageModelV2TextPart
  | LanguageModelV2ReasoningPart
  | LanguageModelV2ToolCallPart
  | LanguageModelV2FilePart;

export interface AssistantPartResult {
  textContent: string;
  reasoningContent: string;
  chatContentItems: ChatMessageContentItem[];
  responsesContentItems: ResponsesContentItem[];
  chatToolCalls: ChatMessageToolCall[];
  responsesFunctionCalls: OpenResponsesFunctionToolCall[];
}

export function createEmptyAssistantResult(): AssistantPartResult {
  return {
    textContent: '',
    reasoningContent: '',
    chatContentItems: [],
    responsesContentItems: [],
    chatToolCalls: [],
    responsesFunctionCalls: [],
  };
}

// =============================================================================
// Assistant Part Processors
// =============================================================================

function processAssistantTextPart(
  part: LanguageModelV2TextPart,
  result: AssistantPartResult,
): void {
  result.textContent += part.text;
}

function processAssistantReasoningPart(
  part: LanguageModelV2ReasoningPart,
  result: AssistantPartResult,
): void {
  result.reasoningContent += part.text;
}

function processAssistantToolCallPart(
  part: LanguageModelV2ToolCallPart,
  result: AssistantPartResult,
): void {
  const args = typeof part.input === 'string' ? part.input : JSON.stringify(part.input);

  // Add to Chat API format
  result.chatToolCalls.push({
    id: part.toolCallId,
    type: 'function',
    function: {
      name: part.toolName,
      arguments: args,
    },
  });

  // Extract reasoning details from tool call part for Responses API
  const partWithMeta = part as LanguageModelV2ToolCallPart & {
    providerOptions?: { openrouter?: { reasoning_details?: OpenResponsesReasoning[] } };
    providerMetadata?: { openrouter?: { reasoning_details?: OpenResponsesReasoning[] } };
    experimental_providerMetadata?: { openrouter?: { reasoning_details?: OpenResponsesReasoning[] } };
  };

  const sdkReasoningDetails =
    partWithMeta.providerOptions?.openrouter?.reasoning_details ??
    partWithMeta.providerMetadata?.openrouter?.reasoning_details ??
    partWithMeta.experimental_providerMetadata?.openrouter?.reasoning_details;

  const reasoningItems = transformReasoningToApiFormat(sdkReasoningDetails ?? []);

  const functionCall: OpenResponsesFunctionToolCall & {
    reasoning_details?: ApiReasoningDetailItem[];
  } = {
    type: 'function_call',
    callId: part.toolCallId,
    id: part.toolCallId,
    name: part.toolName,
    arguments: args,
    status: 'completed',
  };

  if (reasoningItems.length > 0) {
    functionCall.reasoning_details = reasoningItems;
  }

  result.responsesFunctionCalls.push(functionCall);
}

function processAssistantFilePart(
  part: LanguageModelV2FilePart,
  result: AssistantPartResult,
): void {
  const chatItem = convertFilePartToChatItem(part);
  const responsesItem = convertFilePartToResponsesItem(part);

  if (chatItem) {
    result.chatContentItems.push(chatItem);
  }
  if (responsesItem) {
    result.responsesContentItems.push(responsesItem);
  }
}

/**
 * Process an assistant message content part, accumulating results.
 */
export function processAssistantPart(
  part: AssistantContentPart,
  result: AssistantPartResult,
): void {
  switch (part.type) {
    case 'text':
      processAssistantTextPart(part, result);
      break;

    case 'reasoning':
      processAssistantReasoningPart(part, result);
      break;

    case 'tool-call':
      processAssistantToolCallPart(part, result);
      break;

    case 'file':
      processAssistantFilePart(part, result);
      break;

    default:
      // Silently ignore unknown part types for forward compatibility
      break;
  }
}

// =============================================================================
// Content Collapse Utilities
// =============================================================================

/**
 * Collapse Chat API content items to the simplest representation.
 *
 * If there's only a single text item, return the string directly.
 * Otherwise return the array of content items.
 */
export function collapseChatContent(
  items: ChatMessageContentItem[],
): string | ChatMessageContentItem[] | undefined {
  if (items.length === 0) {
    return undefined;
  }

  if (items.length === 1 && items[0].type === 'text') {
    return items[0].text;
  }

  return items;
}

/**
 * Build Responses API content from content items.
 *
 * Only collapse to string if single text item without extra properties
 * like cache_control.
 */
export function buildResponsesContent(
  items: ResponsesContentItem[],
): string | ResponsesContentItem[] {
  if (items.length === 0) {
    return '';
  }

  // Only collapse to string if single text item without extra properties
  if (items.length === 1 && items[0].type === 'input_text') {
    const item = items[0] as ResponseInputText & { cache_control?: unknown };
    if (!item.cache_control) {
      return item.text;
    }
  }

  return items;
}
