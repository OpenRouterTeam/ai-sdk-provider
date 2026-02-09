import type {
  LanguageModelV3FilePart,
  LanguageModelV3Prompt,
  LanguageModelV3TextPart,
  LanguageModelV3ToolResultPart,
  SharedV3ProviderMetadata,
} from '@ai-sdk/provider';
import type { ReasoningDetailUnion } from '../schemas/reasoning-details';
import type {
  ChatCompletionContentPart,
  OpenRouterChatCompletionsInput,
} from '../types/openrouter-chat-completions-input';

import { OpenRouterProviderOptionsSchema } from '../schemas/provider-metadata';
import { ReasoningDetailsDuplicateTracker } from '../utils/reasoning-details-duplicate-tracker';
import { getFileUrl, getInputAudioData } from './file-url-utils';
import { isUrl } from './is-url';

// Type for OpenRouter Cache Control following Anthropic's pattern
export type OpenRouterCacheControl = { type: 'ephemeral' };

function getCacheControl(
  providerMetadata: SharedV3ProviderMetadata | undefined,
): OpenRouterCacheControl | undefined {
  const anthropic = providerMetadata?.anthropic;
  const openrouter = providerMetadata?.openrouter;

  // Allow both cacheControl and cache_control:
  return (openrouter?.cacheControl ??
    openrouter?.cache_control ??
    anthropic?.cacheControl ??
    anthropic?.cache_control) as OpenRouterCacheControl | undefined;
}

export function convertToOpenRouterChatMessages(
  prompt: LanguageModelV3Prompt,
): OpenRouterChatCompletionsInput {
  const messages: OpenRouterChatCompletionsInput = [];

  // Track reasoning_details across all messages in this conversion to prevent duplicates.
  // This fixes issue #254 where the same reasoning ID appears in multiple
  // assistant messages during multi-turn conversations, causing the API
  // to reject the request with "Duplicate item found with id" error.
  const reasoningDetailsTracker = new ReasoningDetailsDuplicateTracker();

  for (const { role, content, providerOptions } of prompt) {
    switch (role) {
      case 'system': {
        const cacheControl = getCacheControl(providerOptions);
        messages.push({
          role: 'system',
          content: [
            {
              type: 'text' as const,
              text: content,
              ...(cacheControl && { cache_control: cacheControl }),
            },
          ],
        });
        break;
      }

      case 'user': {
        if (content.length === 1 && content[0]?.type === 'text') {
          const cacheControl =
            getCacheControl(providerOptions) ??
            getCacheControl(content[0].providerOptions);
          const contentWithCacheControl: string | ChatCompletionContentPart[] =
            cacheControl
              ? [
                  {
                    type: 'text',
                    text: content[0].text,
                    cache_control: cacheControl,
                  },
                ]
              : content[0].text;
          messages.push({
            role: 'user',
            content: contentWithCacheControl,
          });
          break;
        }

        // Get message level cache control
        const messageCacheControl = getCacheControl(providerOptions);

        // Find the index of the last text part for applying message-level cache control
        let lastTextPartIndex = -1;
        for (let i = content.length - 1; i >= 0; i--) {
          if (content[i]?.type === 'text') {
            lastTextPartIndex = i;
            break;
          }
        }

        const contentParts: ChatCompletionContentPart[] = content.map(
          (part: LanguageModelV3TextPart | LanguageModelV3FilePart, index) => {
            const isLastTextPart =
              part.type === 'text' && index === lastTextPartIndex;
            const partCacheControl = getCacheControl(part.providerOptions);

            const cacheControl =
              part.type === 'text'
                ? (partCacheControl ??
                  (isLastTextPart ? messageCacheControl : undefined))
                : partCacheControl;

            switch (part.type) {
              case 'text':
                return {
                  type: 'text' as const,
                  text: part.text,
                  ...(cacheControl && { cache_control: cacheControl }),
                };
              case 'file': {
                if (part.mediaType?.startsWith('image/')) {
                  const url = getFileUrl({
                    part,
                    defaultMediaType: 'image/jpeg',
                  });
                  return {
                    type: 'image_url' as const,
                    image_url: {
                      url,
                    },
                    ...(cacheControl && { cache_control: cacheControl }),
                  };
                }

                // Handle audio files for input_audio format
                if (part.mediaType?.startsWith('audio/')) {
                  return {
                    type: 'input_audio' as const,
                    input_audio: getInputAudioData(part),
                    ...(cacheControl && { cache_control: cacheControl }),
                  };
                }

                const fileName = String(
                  part.providerOptions?.openrouter?.filename ??
                    part.filename ??
                    '',
                );

                const fileData = getFileUrl({
                  part,
                  defaultMediaType: 'application/pdf',
                });

                if (
                  isUrl({
                    url: fileData,
                    protocols: new Set(['http:', 'https:'] as const),
                  })
                ) {
                  return {
                    type: 'file' as const,
                    file: {
                      filename: fileName,
                      file_data: fileData,
                    },
                  } satisfies ChatCompletionContentPart;
                }

                return {
                  type: 'file' as const,
                  file: {
                    filename: fileName,
                    file_data: fileData,
                  },
                  ...(cacheControl && { cache_control: cacheControl }),
                } satisfies ChatCompletionContentPart;
              }
              default: {
                return {
                  type: 'text' as const,
                  text: '',
                  ...(cacheControl && { cache_control: cacheControl }),
                };
              }
            }
          },
        );

        // For multi-part messages, don't add cache_control at the root level
        messages.push({
          role: 'user',
          content: contentParts,
        });

        break;
      }

      case 'assistant': {
        let text = '';
        let reasoning = '';
        const toolCalls: Array<{
          id: string;
          type: 'function';
          function: { name: string; arguments: string };
        }> = [];

        for (const part of content) {
          switch (part.type) {
            case 'text': {
              text += part.text;
              break;
            }
            case 'tool-call': {
              toolCalls.push({
                id: part.toolCallId,
                type: 'function',
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(part.input),
                },
              });
              break;
            }
            case 'reasoning': {
              reasoning += part.text;
              break;
            }
            case 'file':
              break;
            default: {
              break;
            }
          }
        }

        // Check message-level providerOptions for preserved reasoning_details and annotations
        const parsedProviderOptions =
          OpenRouterProviderOptionsSchema.safeParse(providerOptions);
        const messageReasoningDetails = parsedProviderOptions.success
          ? parsedProviderOptions.data?.openrouter?.reasoning_details
          : undefined;
        const messageAnnotations = parsedProviderOptions.success
          ? parsedProviderOptions.data?.openrouter?.annotations
          : undefined;

        // Use message-level reasoning_details if available, otherwise find from parts
        // Priority: message-level > first tool call > first reasoning part
        // This prevents duplicate thinking blocks when Claude makes parallel tool calls
        const candidateReasoningDetails =
          messageReasoningDetails &&
          Array.isArray(messageReasoningDetails) &&
          messageReasoningDetails.length > 0
            ? messageReasoningDetails
            : findFirstReasoningDetails(content);

        // Deduplicate reasoning_details across all messages to prevent
        // "Duplicate item found with id" errors in multi-turn conversations.
        // upsert() returns true only for NEW details (not seen before and has valid key).
        // Details without valid keys or duplicates are skipped.
        let finalReasoningDetails: ReasoningDetailUnion[] | undefined;
        if (candidateReasoningDetails && candidateReasoningDetails.length > 0) {
          const uniqueDetails: ReasoningDetailUnion[] = [];
          for (const detail of candidateReasoningDetails) {
            if (reasoningDetailsTracker.upsert(detail)) {
              uniqueDetails.push(detail);
            }
          }
          finalReasoningDetails =
            uniqueDetails.length > 0 ? uniqueDetails : undefined;
        }

        messages.push({
          role: 'assistant',
          content: text,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          reasoning: reasoning || undefined,
          reasoning_details: finalReasoningDetails,
          annotations: messageAnnotations,
          cache_control: getCacheControl(providerOptions),
        });

        break;
      }

      case 'tool': {
        for (const toolResponse of content) {
          // Skip tool approval responses - only process tool results
          if (toolResponse.type === 'tool-approval-response') {
            continue;
          }
          const content = getToolResultContent(toolResponse);

          messages.push({
            role: 'tool',
            tool_call_id: toolResponse.toolCallId,
            content,
            cache_control:
              getCacheControl(providerOptions) ??
              getCacheControl(toolResponse.providerOptions),
          });
        }
        break;
      }

      default: {
        break;
      }
    }
  }

  return messages;
}

function getToolResultContent(input: LanguageModelV3ToolResultPart): string {
  switch (input.output.type) {
    case 'text':
    case 'error-text':
      return input.output.value;
    case 'json':
    case 'error-json':
    case 'content':
      return JSON.stringify(input.output.value);
    case 'execution-denied':
      return input.output.reason ?? 'Tool execution denied';
  }
}

/**
 * Find the first reasoning_details from content parts.
 * Priority: tool calls (complete accumulated data) > reasoning parts (delta data)
 *
 * This prevents duplicate thinking blocks when Claude makes parallel tool calls,
 * as each tool call may have the same reasoning_details attached.
 */
function findFirstReasoningDetails(
  content: Array<{
    type: string;
    providerOptions?: Record<string, unknown>;
  }>,
): ReasoningDetailUnion[] | undefined {
  // First, try tool calls - they have complete accumulated reasoning_details
  for (const part of content) {
    if (part.type === 'tool-call') {
      const openrouter = part.providerOptions?.openrouter as
        | Record<string, unknown>
        | undefined;
      const details = openrouter?.reasoning_details;
      if (Array.isArray(details) && details.length > 0) {
        return details as ReasoningDetailUnion[];
      }
    }
  }

  // Fall back to reasoning parts - they have delta reasoning_details
  for (const part of content) {
    if (part.type === 'reasoning') {
      const parsed = OpenRouterProviderOptionsSchema.safeParse(
        part.providerOptions,
      );
      if (
        parsed.success &&
        parsed.data?.openrouter?.reasoning_details &&
        parsed.data.openrouter.reasoning_details.length > 0
      ) {
        return parsed.data.openrouter.reasoning_details;
      }
    }
  }

  return undefined;
}
