/**
 * Message conversion utilities for transforming AI SDK messages to OpenRouter formats.
 *
 * OpenRouter supports two API formats:
 * 1. Chat API - OpenAI-compatible format with messages array
 * 2. Responses API - OpenRouter's native format with richer features
 *
 * This module provides converters for both formats.
 */

import type {
  LanguageModelV2Message,
  LanguageModelV2Prompt,
} from '@ai-sdk/provider';
import type {
  Message,
  OpenResponsesEasyInputMessage,
  OpenResponsesFunctionCallOutput,
  OpenResponsesFunctionToolCall,
  OpenResponsesInput,
  ResponseInputText,
} from '@openrouter/sdk/esm/models';

import { type ResponsesContentItem } from './file-parts';
import {
  buildResponsesContent,
  collapseChatContent,
  convertUserPart,
  createEmptyAssistantResult,
  processAssistantPart,
  type AssistantContentPart,
} from './message-parts';
import { extractReasoningDetails, type ApiReasoningDetailItem } from './reasoning';
import { assertNever, isKnownToolOutputType, toolOutputToString, type ToolOutputResult } from './types';

// Re-export types and utilities that consumers might need
export { assertNever, classifyFileData, toolOutputToString } from './types';
export type { ClassifiedFileData, ToolOutputResult, ToolOutputType } from './types';
export { extractReasoningFromResponse, extractReasoningDetails, transformReasoningToApiFormat } from './reasoning';
export type { ApiReasoningDetailItem } from './reasoning';
export { convertFilePartToChatItem, convertFilePartToResponsesItem } from './file-parts';
export type { ResponsesContentItem } from './file-parts';

// =============================================================================
// Message Role Type
// =============================================================================

type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

// =============================================================================
// Chat API Converters
// =============================================================================

/**
 * Convert user message to OpenRouter Chat API format.
 */
function convertUserMessage(
  message: LanguageModelV2Message & { role: 'user' },
): Message {
  if (typeof message.content === 'string') {
    return {
      role: 'user',
      content: message.content,
    };
  }

  const contentItems: import('@openrouter/sdk/esm/models').ChatMessageContentItem[] = [];

  for (const part of message.content) {
    const { chatItem } = convertUserPart(part);
    if (chatItem) {
      contentItems.push(chatItem);
    }
  }

  return {
    role: 'user',
    content: collapseChatContent(contentItems) ?? '',
  };
}

/**
 * Convert assistant message to OpenRouter Chat API format.
 */
function convertAssistantMessage(
  message: LanguageModelV2Message & { role: 'assistant' },
): Message {
  const result = createEmptyAssistantResult();

  for (const part of message.content) {
    // Filter to only assistant-relevant parts (skip tool-result which belongs in tool messages)
    if (part.type === 'tool-result') {
      continue;
    }
    processAssistantPart(part as AssistantContentPart, result);
  }

  // Add accumulated text content
  if (result.textContent) {
    result.chatContentItems.push({
      type: 'text',
      text: result.textContent,
    });
  }

  const assistantMessage: Extract<Message, { role: 'assistant' }> = {
    role: 'assistant',
  };

  const content = collapseChatContent(result.chatContentItems);
  if (content !== undefined) {
    assistantMessage.content = content;
  } else if (result.chatToolCalls.length === 0) {
    assistantMessage.content = '';
  }

  if (result.reasoningContent) {
    assistantMessage.reasoning = result.reasoningContent;
  }

  if (result.chatToolCalls.length > 0) {
    assistantMessage.toolCalls = result.chatToolCalls;
  }

  return assistantMessage;
}

/**
 * Convert tool message to OpenRouter Chat API format.
 */
function convertToolMessage(
  message: LanguageModelV2Message & { role: 'tool' },
): Message[] {
  return message.content
    .filter(
      (part): part is typeof part & { type: 'tool-result' } => part.type === 'tool-result',
    )
    .map((part) => {
      const output = part.output as { type: string; value: unknown };
      const content = isKnownToolOutputType(output.type)
        ? toolOutputToString(output as ToolOutputResult)
        : JSON.stringify(output);

      return {
        role: 'tool' as const,
        content,
        toolCallId: part.toolCallId,
      };
    });
}

/**
 * Convert AI SDK V2 prompt to OpenRouter Chat API messages.
 *
 * This format is compatible with OpenAI's Chat Completions API.
 */
export function convertToOpenRouterMessages(prompt: LanguageModelV2Prompt): Message[] {
  const messages: Message[] = [];

  for (const message of prompt) {
    const role = message.role as MessageRole;

    switch (role) {
      case 'system':
        messages.push({
          role: 'system',
          content: (message as LanguageModelV2Message & { role: 'system' }).content,
        });
        break;

      case 'user':
        messages.push(
          convertUserMessage(message as LanguageModelV2Message & { role: 'user' }),
        );
        break;

      case 'assistant':
        messages.push(
          convertAssistantMessage(message as LanguageModelV2Message & { role: 'assistant' }),
        );
        break;

      case 'tool':
        messages.push(
          ...convertToolMessage(message as LanguageModelV2Message & { role: 'tool' }),
        );
        break;

      default:
        assertNever(role, `Unsupported message role: ${role}`);
    }
  }

  return messages;
}

// =============================================================================
// Responses API Converters
// =============================================================================

/**
 * Convert user message to Responses API format.
 */
function convertUserToResponsesInput(
  message: LanguageModelV2Message & { role: 'user' },
): OpenResponsesEasyInputMessage {
  if (typeof message.content === 'string') {
    return {
      type: 'message',
      role: 'user',
      content: message.content,
    };
  }

  const content: ResponsesContentItem[] = [];

  for (const part of message.content) {
    const { responsesItem } = convertUserPart(part);
    if (responsesItem) {
      content.push(responsesItem);
    }
  }

  return {
    type: 'message',
    role: 'user',
    content: buildResponsesContent(content),
  };
}

/**
 * Convert assistant message to Responses API format.
 */
function convertAssistantToResponsesInput(
  message: LanguageModelV2Message & { role: 'assistant' },
): {
  assistantMessage: OpenResponsesEasyInputMessage;
  functionCalls: OpenResponsesFunctionToolCall[];
  reasoningItems: ApiReasoningDetailItem[];
} {
  const result = createEmptyAssistantResult();

  for (const part of message.content) {
    // Filter to only assistant-relevant parts
    if (part.type === 'tool-result') {
      continue;
    }
    processAssistantPart(part as AssistantContentPart, result);
  }

  // Add accumulated text content
  if (result.textContent) {
    result.responsesContentItems.push({
      type: 'input_text',
      text: result.textContent,
    });
  }

  // Append reasoning content to text if present
  if (result.reasoningContent) {
    const lastTextItem = [...result.responsesContentItems]
      .reverse()
      .find((item): item is ResponseInputText => item.type === 'input_text');

    if (lastTextItem) {
      lastTextItem.text = lastTextItem.text
        ? `${lastTextItem.text}\n${result.reasoningContent}`
        : result.reasoningContent;
    } else {
      result.responsesContentItems.push({
        type: 'input_text',
        text: result.reasoningContent,
      });
    }
  }

  const reasoningItems = extractReasoningDetails(message);

  return {
    assistantMessage: {
      type: 'message',
      role: 'assistant',
      content: buildResponsesContent(result.responsesContentItems),
    },
    functionCalls: result.responsesFunctionCalls,
    reasoningItems,
  };
}

/**
 * Convert tool message to Responses API format.
 */
function convertToolToResponsesInput(
  message: LanguageModelV2Message & { role: 'tool' },
): OpenResponsesFunctionCallOutput[] {
  return message.content
    .filter(
      (part): part is typeof part & { type: 'tool-result' } => part.type === 'tool-result',
    )
    .map((part) => {
      const output = part.output as { type: string; value: unknown };
      const outputString = isKnownToolOutputType(output.type)
        ? toolOutputToString(output as ToolOutputResult)
        : JSON.stringify(output);

      return {
        type: 'function_call_output' as const,
        callId: part.toolCallId,
        id: part.toolCallId,
        output: outputString,
        status: 'completed' as const,
      };
    });
}

/**
 * Convert AI SDK V2 prompt to Responses API input format.
 *
 * This is OpenRouter's native format with richer support for
 * reasoning, function calls, and structured content.
 */
export function convertToResponsesInput(prompt: LanguageModelV2Prompt): OpenResponsesInput {
  type ResponsesArray = Exclude<OpenResponsesInput, string>;
  const messages: ResponsesArray = [];

  for (const message of prompt) {
    const role = message.role as MessageRole;

    switch (role) {
      case 'system':
        messages.push({
          type: 'message',
          role: 'system',
          content: (message as LanguageModelV2Message & { role: 'system' }).content,
        });
        break;

      case 'user':
        messages.push(
          convertUserToResponsesInput(message as LanguageModelV2Message & { role: 'user' }),
        );
        break;

      case 'assistant': {
        const { assistantMessage, functionCalls, reasoningItems } =
          convertAssistantToResponsesInput(
            message as LanguageModelV2Message & { role: 'assistant' },
          );

        // Map reasoning_details to their corresponding function calls by ID
        if (reasoningItems.length > 0 && functionCalls.length > 0) {
          // Group reasoning_details by their id
          const reasoningByToolId = new Map<string, ApiReasoningDetailItem[]>();
          const reasoningWithoutId: ApiReasoningDetailItem[] = [];

          for (const reasoningItem of reasoningItems) {
            if (reasoningItem.id) {
              const existing = reasoningByToolId.get(reasoningItem.id) || [];
              existing.push(reasoningItem);
              reasoningByToolId.set(reasoningItem.id, existing);
            } else {
              reasoningWithoutId.push(reasoningItem);
            }
          }

          // Attach reasoning_details to matching function calls
          for (const functionCall of functionCalls) {
            const functionCallWithReasoning = functionCall as OpenResponsesFunctionToolCall & {
              reasoning_details?: ApiReasoningDetailItem[];
            };
            const matchingReasoning = reasoningByToolId.get(functionCall.callId);
            if (matchingReasoning && matchingReasoning.length > 0) {
              // Only add if not already present (avoid duplicates)
              if (
                !functionCallWithReasoning.reasoning_details ||
                functionCallWithReasoning.reasoning_details.length === 0
              ) {
                functionCallWithReasoning.reasoning_details = matchingReasoning;
              }
            }
          }

          // If there are reasoning_details without IDs, add them to the assistant message
          if (reasoningWithoutId.length > 0) {
            (
              assistantMessage as OpenResponsesEasyInputMessage & {
                reasoning_details?: ApiReasoningDetailItem[];
              }
            ).reasoning_details = reasoningWithoutId;
          }
        } else if (reasoningItems.length > 0) {
          // No function calls, add all reasoning_details to assistant message
          (
            assistantMessage as OpenResponsesEasyInputMessage & {
              reasoning_details?: ApiReasoningDetailItem[];
            }
          ).reasoning_details = reasoningItems;
        }

        messages.push(assistantMessage);
        messages.push(...functionCalls);
        break;
      }

      case 'tool':
        messages.push(
          ...convertToolToResponsesInput(message as LanguageModelV2Message & { role: 'tool' }),
        );
        break;

      default:
        assertNever(role, `Unsupported message role: ${role}`);
    }
  }

  return messages;
}
