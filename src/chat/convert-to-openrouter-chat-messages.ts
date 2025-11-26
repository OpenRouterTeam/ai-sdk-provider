import type {
  LanguageModelV2FilePart,
  LanguageModelV2Prompt,
  LanguageModelV2TextPart,
  LanguageModelV2ToolResultPart,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider';
import type {
  ChatCompletionContentPart,
  OpenRouterChatCompletionsInput,
} from '../types/openrouter-chat-completions-input';

import { OpenRouterProviderOptionsSchema } from '../schemas/provider-metadata';
import { getFileUrl, getBase64FromDataUrl } from './file-url-utils';
import { isUrl } from './is-url';

/**
 * Converts an audio file part to OpenRouter's input_audio data format.
 *
 * This function extracts base64-encoded audio data from a file part and
 * normalizes the format to one of the supported OpenRouter audio formats.
 *
 * @param part - The file part containing audio data. Must have a mediaType
 *   starting with "audio/" and contain either base64 data or a data URL.
 *
 * @returns An object with `data` (base64-encoded audio) and `format` ("mp3" or "wav")
 *   suitable for use in OpenRouter's `input_audio` field.
 *
 * @throws {Error} When audio is provided as an HTTP/HTTPS URL. OpenRouter requires
 *   audio to be base64-encoded inline. The error message includes instructions for
 *   downloading and encoding the audio locally.
 *
 * @throws {Error} When the audio format is not supported. OpenRouter only accepts
 *   MP3 and WAV formats. Supported MIME types:
 *   - MP3: "audio/mpeg", "audio/mp3"
 *   - WAV: "audio/wav", "audio/x-wav", "audio/wave"
 *
 * @example
 * ```ts
 * const audioData = getInputAudioData(filePart);
 * // Returns: { data: "base64string...", format: "mp3" }
 * ```
 */
function getInputAudioData(part: LanguageModelV2FilePart): {
  data: string;
  format: 'mp3' | 'wav';
} {
  const fileData = getFileUrl({
    part,
    defaultMediaType: 'audio/mpeg',
  });

  // OpenRouter's input_audio doesn't support URLs directly
  if (
    isUrl({
      url: fileData,
      protocols: new Set(['http:', 'https:'] as const),
    })
  ) {
    throw new Error(
      `Audio files cannot be provided as URLs.\n\n` +
        `OpenRouter requires audio to be base64-encoded. Please:\n` +
        `1. Download the audio file locally\n` +
        `2. Read it as a Buffer or Uint8Array\n` +
        `3. Pass it as the data parameter\n\n` +
        `The AI SDK will automatically handle base64 encoding.\n\n` +
        `Learn more: https://openrouter.ai/docs/features/multimodal/audio`,
    );
  }

  // Extract base64 data (handles both data URLs and raw base64)
  const data = getBase64FromDataUrl(fileData);

  // Map media type to format
  const mediaType = part.mediaType || 'audio/mpeg';
  let format = mediaType.replace('audio/', '');

  // Normalize format names for OpenRouter
  // Common MIME types: audio/mpeg, audio/mp3 -> mp3
  // audio/wav, audio/x-wav, audio/wave -> wav
  if (format === 'mpeg' || format === 'mp3') {
    format = 'mp3';
  } else if (format === 'x-wav' || format === 'wave' || format === 'wav') {
    format = 'wav';
  }

  // Validate format - OpenRouter only supports mp3 and wav
  if (format !== 'mp3' && format !== 'wav') {
    throw new Error(
      `Unsupported audio format: "${mediaType}"\n\n` +
        `OpenRouter only supports MP3 and WAV audio formats.\n` +
        `• For MP3: use "audio/mpeg" or "audio/mp3"\n` +
        `• For WAV: use "audio/wav" or "audio/x-wav"\n\n` +
        `Learn more: https://openrouter.ai/docs/features/multimodal/audio`,
    );
  }

  return { data, format };
}

// Type for OpenRouter Cache Control following Anthropic's pattern
export type OpenRouterCacheControl = { type: 'ephemeral' };

function getCacheControl(
  providerMetadata: SharedV2ProviderMetadata | undefined,
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
  prompt: LanguageModelV2Prompt,
): OpenRouterChatCompletionsInput {
  const messages: OpenRouterChatCompletionsInput = [];
  for (const { role, content, providerOptions } of prompt) {
    switch (role) {
      case 'system': {
        messages.push({
          role: 'system',
          content,
          cache_control: getCacheControl(providerOptions),
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
        const contentParts: ChatCompletionContentPart[] = content.map(
          (part: LanguageModelV2TextPart | LanguageModelV2FilePart) => {
            const cacheControl =
              getCacheControl(part.providerOptions) ?? messageCacheControl;

            switch (part.type) {
              case 'text':
                return {
                  type: 'text' as const,
                  text: part.text,
                  // For text parts, only use part-specific cache control
                  cache_control: cacheControl,
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
                    // For image parts, use part-specific or message-level cache control
                    cache_control: cacheControl,
                  };
                }

                // Handle audio files for input_audio format
                if (part.mediaType?.startsWith('audio/')) {
                  return {
                    type: 'input_audio' as const,
                    input_audio: getInputAudioData(part),
                    cache_control: cacheControl,
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
                  cache_control: cacheControl,
                } satisfies ChatCompletionContentPart;
              }
              default: {
                return {
                  type: 'text' as const,
                  text: '',
                  cache_control: cacheControl,
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

        // Check if we have preserved reasoning_details from the original OpenRouter response
        // OpenRouter requires reasoning_details to be passed back unmodified for multi-turn conversations
        // If we don't have the preserved version (AI SDK doesn't pass providerOptions back),
        // we should NOT send reconstructed reasoning_details as they won't match the original
        // Instead, only use the legacy reasoning field
        const parsedProviderOptions =
          OpenRouterProviderOptionsSchema.safeParse(providerOptions);
        const preservedReasoningDetails = parsedProviderOptions.success
          ? parsedProviderOptions.data?.openrouter?.reasoning_details
          : undefined;

        messages.push({
          role: 'assistant',
          content: text,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          reasoning: reasoning || undefined,
          // Only include reasoning_details if we have the preserved original version
          reasoning_details:
            preservedReasoningDetails &&
            Array.isArray(preservedReasoningDetails) &&
            preservedReasoningDetails.length > 0
              ? preservedReasoningDetails
              : undefined,
          cache_control: getCacheControl(providerOptions),
        });

        break;
      }

      case 'tool': {
        for (const toolResponse of content) {
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

function getToolResultContent(input: LanguageModelV2ToolResultPart): string {
  return input.output.type === 'text'
    ? input.output.value
    : JSON.stringify(input.output.value);
}
