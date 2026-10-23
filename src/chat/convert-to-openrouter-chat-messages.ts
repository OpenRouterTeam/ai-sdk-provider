import type {
  LanguageModelV4FilePart,
  LanguageModelV4Prompt,
  LanguageModelV4TextPart,
  LanguageModelV4ToolResultOutput,
  LanguageModelV4ToolResultPart,
  SharedV4ProviderMetadata,
} from '@ai-sdk/provider';
import type { ReasoningDetailUnion } from '../schemas/reasoning-details';
import type {
  ChatCompletionContentPart,
  ChatCompletionContentPartText,
  OpenRouterChatCompletionsInput,
} from '../types/openrouter-chat-completions-input';

import { DEFAULT_REASONING_FORMAT, ReasoningFormat } from '../schemas/format';
import { OpenRouterProviderOptionsSchema } from '../schemas/provider-metadata';
import { ReasoningDetailType } from '../schemas/reasoning-details';
import { deterministicStringify } from '../utils/deterministic-stringify';
import { ReasoningDetailsDuplicateTracker } from '../utils/reasoning-details-duplicate-tracker';
import {
  getBase64FromDataUrl,
  getFileDataUrl,
  getFileUrl,
  getInputAudioData,
  MIME_TO_FORMAT,
} from './file-url-utils';
import { isUrl } from './is-url';

// Type for OpenRouter Cache Control following Anthropic's pattern
export type OpenRouterCacheControl = { type: 'ephemeral'; ttl?: '5m' | '1h' };

export function getCacheControl(
  providerMetadata: SharedV4ProviderMetadata | undefined,
): OpenRouterCacheControl | undefined {
  const anthropic = providerMetadata?.anthropic;
  const openrouter = providerMetadata?.openrouter;

  // Allow both cacheControl and cache_control:
  return (openrouter?.cacheControl ??
    openrouter?.cache_control ??
    anthropic?.cacheControl ??
    anthropic?.cache_control) as OpenRouterCacheControl | undefined;
}

function getImageDetail(
  providerOptions: SharedV4ProviderMetadata | undefined,
): 'auto' | 'low' | 'high' | undefined {
  const detail = providerOptions?.openrouter?.imageDetail;
  return detail === 'auto' || detail === 'low' || detail === 'high'
    ? detail
    : undefined;
}

function getVideoProcessing(
  providerOptions: SharedV4ProviderMetadata | undefined,
): 'agentic' | 'static' | undefined {
  const processing = providerOptions?.openrouter?.videoProcessing;
  return processing === 'agentic' || processing === 'static'
    ? processing
    : undefined;
}

export function convertToOpenRouterChatMessages(
  prompt: LanguageModelV4Prompt,
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
          (part: LanguageModelV4TextPart | LanguageModelV4FilePart, index) => {
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
                  const detail = getImageDetail(part.providerOptions);
                  return {
                    type: 'image_url' as const,
                    image_url: {
                      url,
                      ...(detail && { detail }),
                    },
                    ...(cacheControl && { cache_control: cacheControl }),
                  };
                }

                // Handle video files for video_url format
                if (part.mediaType?.startsWith('video/')) {
                  const url = getFileUrl({
                    part,
                    defaultMediaType: 'video/mp4',
                  });
                  const processing = getVideoProcessing(part.providerOptions);
                  return {
                    type: 'video_url' as const,
                    video_url: {
                      url,
                      ...(processing && { processing }),
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
        // Text parts are kept as blocks so that part-level cache control can
        // be placed on the exact part, mirroring user messages.
        const textParts: ChatCompletionContentPartText[] = [];
        let hasPartCacheControl = false;
        const toolCalls: Array<{
          id: string;
          type: 'function';
          function: { name: string; arguments: string };
        }> = [];

        for (const part of content) {
          switch (part.type) {
            case 'text': {
              text += part.text;
              const partCacheControl = getCacheControl(part.providerOptions);
              if (partCacheControl) {
                hasPartCacheControl = true;
              }
              textParts.push({
                type: 'text',
                text: part.text,
                ...(partCacheControl && { cache_control: partCacheControl }),
              });
              break;
            }
            case 'tool-call': {
              toolCalls.push({
                id: part.toolCallId,
                type: 'function',
                function: {
                  name: part.toolName,
                  arguments: deterministicStringify(part.input),
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

        // Use message-level reasoning_details if available, otherwise the most
        // complete carrier among the parts (see findMostCompleteReasoningDetails)
        //
        // NOTE: treat an empty array as a meaningful signal — some providers (e.g.
        // DeepSeek V4) return `reasoning_details: []` on turns where they produced no
        // visible reasoning tokens, and they expect to receive that empty array back in
        // subsequent turns to maintain the conversation state.  Falling back to
        // `findMostCompleteReasoningDetails` when the array exists-but-is-empty would silently
        // drop this signal and cause those providers to error on follow-up requests.
        const candidateReasoningDetails =
          messageReasoningDetails && Array.isArray(messageReasoningDetails)
            ? messageReasoningDetails
            : findMostCompleteReasoningDetails(content);

        // Strip reasoning.text entries that would cause signature errors
        // when sent back to the upstream provider.
        //
        // Anthropic (issue #423): Uses an explicit `signature` field on
        // reasoning.text entries. When the signature is lost during message
        // serialization, custom pruning, or DB storage, sending the entry
        // back causes "Invalid signature in thinking block".
        //
        // Google Gemini (issue #418): Does NOT use the SDK `signature`
        // field, but Google internally signs thought tokens. When
        // reasoning text is modified during roundtripping (serialization,
        // encoding changes, field reordering), Google rejects with
        // "Corrupted thought signature". Since the SDK cannot verify
        // whether the text is intact, Gemini reasoning.text entries are
        // always stripped on roundtrip — the encrypted reasoning blob
        // (reasoning.encrypted) handles multi-turn continuity instead.
        //
        // Other formats (OpenAI, xAI, Azure) and non-text detail types
        // pass through unchanged.
        //
        // This runs BEFORE deduplication so that signatureless entries are
        // never registered in the tracker — otherwise a signatureless entry
        // in an earlier turn would suppress a valid signed copy in a later turn.
        let finalReasoningDetails: ReasoningDetailUnion[] | undefined;
        if (candidateReasoningDetails) {
          const validDetails = candidateReasoningDetails.filter((detail) => {
            if (detail.type !== ReasoningDetailType.Text) {
              return true;
            }
            const format = detail.format ?? DEFAULT_REASONING_FORMAT;
            if (
              format !== ReasoningFormat.AnthropicClaudeV1 &&
              format !== ReasoningFormat.GoogleGeminiV1
            ) {
              return true;
            }
            return !!detail.signature;
          });

          if (validDetails.length < candidateReasoningDetails.length) {
            // Respect the AI SDK's warning suppression system.
            // When false, warnings are fully suppressed.
            // When a function, the app has a custom handler — suppress
            // console output since our plain-text warning doesn't match
            // the structured format the handler expects.
            const logger = globalThis.AI_SDK_LOG_WARNINGS;
            if (logger !== false && typeof logger !== 'function') {
              // biome-ignore lint/suspicious/noConsole: intentional warning for stripped reasoning data
              console.warn(
                '[openrouter] Some reasoning_details entries were removed because they were missing signatures. See https://github.com/OpenRouterTeam/ai-sdk-provider/issues/423 and https://github.com/OpenRouterTeam/ai-sdk-provider/issues/418 for more details.',
              );
            }
          }

          // Deduplicate reasoning_details across all messages to prevent
          // "Duplicate item found with id" errors in multi-turn conversations.
          // upsert() returns true only for NEW details (not seen before and has valid key).
          // Details without valid keys or duplicates are skipped.
          const uniqueDetails: ReasoningDetailUnion[] = [];
          for (const detail of validDetails) {
            if (reasoningDetailsTracker.upsert(detail)) {
              uniqueDetails.push(detail);
            }
          }
          // Preserve the empty-array signal: when candidateReasoningDetails existed but
          // all entries were duplicate or signature-stripped, still emit [] so downstream
          // providers that require the field (e.g. DeepSeek) receive it.
          finalReasoningDetails = uniqueDetails;
        }

        // Only include reasoning text if we have valid, non-empty reasoning_details.
        // When providerMetadata is lost during message serialization or
        // custom pruning (e.g., stripping providerOptions from reasoning
        // parts), or when switching between models mid-conversation,
        // reasoning text may exist without corresponding reasoning_details.
        // Sending reasoning without reasoning_details causes the API to
        // construct thinking blocks without valid signatures, which
        // Anthropic rejects with "Invalid signature in thinking block"
        // (issue #423).
        //
        // Note: an empty finalReasoningDetails ([]) means the provider explicitly
        // returned no reasoning tokens this turn — do not send reasoning text in
        // that case either.
        const effectiveReasoning =
          reasoning && finalReasoningDetails && finalReasoningDetails.length > 0
            ? reasoning
            : undefined;

        messages.push({
          role: 'assistant',
          // Without part-level cache control, keep the single-string content
          // so the wire format is unchanged.
          content: hasPartCacheControl ? textParts : text || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          reasoning: effectiveReasoning,
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
            name: toolResponse.toolName,
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

function getToolResultContent(
  input: LanguageModelV4ToolResultPart,
): string | ChatCompletionContentPart[] {
  switch (input.output.type) {
    case 'text':
    case 'error-text':
      return input.output.value;
    case 'json':
    case 'error-json':
      return JSON.stringify(input.output.value);
    case 'content':
      return mapToolResultContentParts(input.output.value);
    case 'execution-denied':
      return input.output.reason ?? 'Tool execution denied';
  }
}

type ToolResultContentPart = Extract<
  LanguageModelV4ToolResultOutput,
  { type: 'content' }
>['value'][number];

function mapToolResultContentParts(
  parts: ReadonlyArray<ToolResultContentPart>,
): ChatCompletionContentPart[] {
  return parts.map((part): ChatCompletionContentPart => {
    switch (part.type) {
      case 'text':
        return { type: 'text', text: part.text };

      case 'file': {
        const dataUrl = getFileDataUrl({
          data: part.data,
          mediaType: part.mediaType,
          defaultMediaType: 'application/octet-stream',
        });

        if (part.mediaType?.startsWith('image/')) {
          const detail = getImageDetail(part.providerOptions);
          return {
            type: 'image_url',
            image_url: { url: dataUrl, ...(detail && { detail }) },
          };
        }

        if (part.mediaType?.startsWith('video/')) {
          const processing = getVideoProcessing(part.providerOptions);
          return {
            type: 'video_url',
            video_url: {
              url: dataUrl,
              ...(processing && { processing }),
            },
          };
        }

        if (part.mediaType?.startsWith('audio/')) {
          const rawFormat = part.mediaType.replace('audio/', '');
          const format = MIME_TO_FORMAT[rawFormat];
          if (format !== undefined) {
            return {
              type: 'input_audio',
              input_audio: {
                data: getBase64FromDataUrl(dataUrl),
                format,
              },
            };
          }
        }

        return {
          type: 'file',
          file: {
            filename: part.filename ?? '',
            file_data: dataUrl,
          },
        };
      }

      case 'custom':
        return { type: 'text', text: JSON.stringify(part) };

      default: {
        const _exhaustiveCheck: never = part;
        return { type: 'text', text: JSON.stringify(_exhaustiveCheck) };
      }
    }
  });
}

/**
 * Find the most complete reasoning_details carried by the content parts.
 *
 * Streamed carriers (reasoning parts and the first tool call) each hold a
 * cumulative snapshot, and an empty reasoning part emitted at the end of the
 * stream carries details that arrived after the earlier carriers. Picking the
 * carrier with the most entries (the later one on a tie, since in-place merges
 * such as a late signature keep the length) replays every detail exactly once.
 * Parallel tool calls after the first carry none, so thinking blocks are not
 * duplicated.
 */
function findMostCompleteReasoningDetails(
  content: Array<{
    type: string;
    providerOptions?: Record<string, unknown>;
  }>,
): ReasoningDetailUnion[] | undefined {
  let mostComplete: ReasoningDetailUnion[] | undefined;
  for (const part of content) {
    if (part.type !== 'tool-call' && part.type !== 'reasoning') {
      continue;
    }
    const parsed = OpenRouterProviderOptionsSchema.safeParse(
      part.providerOptions,
    );
    const details = parsed.success
      ? parsed.data?.openrouter?.reasoning_details
      : undefined;
    if (
      details &&
      details.length > 0 &&
      details.length >= (mostComplete?.length ?? 0)
    ) {
      mostComplete = details;
    }
  }

  return mostComplete;
}
