import type {
  JSONObject,
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FinishReason,
  LanguageModelV3FunctionTool,
  LanguageModelV3ResponseMetadata,
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
  SharedV3Headers,
  SharedV3ProviderMetadata,
  SharedV3Warning,
} from '@ai-sdk/provider';
import type { ParseResult } from '@ai-sdk/provider-utils';
import type { z } from 'zod/v4';
import type { ReasoningDetailUnion } from '@/src/schemas/reasoning-details';
import type { OpenRouterUsageAccounting } from '@/src/types/index';
import type { FileAnnotation } from '../schemas/provider-metadata';
import type {
  OpenRouterChatModelId,
  OpenRouterChatSettings,
} from '../types/openrouter-chat-settings';

import {
  APICallError,
  InvalidResponseDataError,
  NoContentGeneratedError,
} from '@ai-sdk/provider';
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  generateId,
  isParsableJson,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { ReasoningDetailType } from '@/src/schemas/reasoning-details';
import { openrouterFailedResponseHandler } from '../schemas/error-response';
import { OpenRouterProviderMetadataSchema } from '../schemas/provider-metadata';
import {
  createFinishReason,
  mapOpenRouterFinishReason,
} from '../utils/map-finish-reason';
import { convertToOpenRouterChatMessages } from './convert-to-openrouter-chat-messages';
import { getBase64FromDataUrl, getMediaType } from './file-url-utils';
import { getChatCompletionToolChoice } from './get-tool-choice';
import {
  OpenRouterNonStreamChatCompletionResponseSchema,
  OpenRouterStreamChatCompletionChunkSchema,
} from './schemas';

type OpenRouterChatConfig = {
  provider: string;
  compatibility: 'strict' | 'compatible';
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

export class OpenRouterChatLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'openrouter';
  readonly defaultObjectGenerationMode = 'tool' as const;

  readonly modelId: OpenRouterChatModelId;
  readonly supportsImageUrls = true;
  readonly supportedUrls: Record<string, RegExp[]> = {
    'image/*': [
      /^data:image\/[a-zA-Z]+;base64,/,
      /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i,
    ],
    // 'text/*': [/^data:text\//, /^https?:\/\/.+$/],
    'application/*': [/^data:application\//, /^https?:\/\/.+$/],
  };
  readonly settings: OpenRouterChatSettings;

  private readonly config: OpenRouterChatConfig;

  constructor(
    modelId: OpenRouterChatModelId,
    settings: OpenRouterChatSettings,
    config: OpenRouterChatConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  private getArgs({
    prompt,
    maxOutputTokens,
    temperature,
    topP,
    frequencyPenalty,
    presencePenalty,
    seed,
    stopSequences,
    responseFormat,
    topK,
    tools,
    toolChoice,
  }: LanguageModelV3CallOptions) {
    const baseArgs = {
      // model id:
      model: this.modelId,
      models: this.settings.models,

      // model specific settings:
      logit_bias: this.settings.logitBias,
      logprobs:
        this.settings.logprobs === true ||
        typeof this.settings.logprobs === 'number'
          ? true
          : undefined,
      top_logprobs:
        typeof this.settings.logprobs === 'number'
          ? this.settings.logprobs
          : typeof this.settings.logprobs === 'boolean'
            ? this.settings.logprobs
              ? 0
              : undefined
            : undefined,
      user: this.settings.user,
      parallel_tool_calls: this.settings.parallelToolCalls,

      // standardized settings:
      max_tokens: maxOutputTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      seed,

      stop: stopSequences,
      response_format:
        responseFormat?.type === 'json'
          ? responseFormat.schema != null
            ? {
                type: 'json_schema',
                json_schema: {
                  schema: responseFormat.schema,
                  strict: true,
                  name: responseFormat.name ?? 'response',
                  ...(responseFormat.description && {
                    description: responseFormat.description,
                  }),
                },
              }
            : { type: 'json_object' }
          : undefined,
      top_k: topK,

      // messages:
      messages: convertToOpenRouterChatMessages(prompt),

      // OpenRouter specific settings:
      include_reasoning: this.settings.includeReasoning,
      reasoning: this.settings.reasoning,
      usage: this.settings.usage,

      // Web search settings:
      plugins: this.settings.plugins,
      web_search_options: this.settings.web_search_options,
      // Provider routing settings:
      provider: this.settings.provider,
      // Debug settings:
      debug: this.settings.debug,

      // extra body:
      ...this.config.extraBody,
      ...this.settings.extraBody,
    };

    if (tools && tools.length > 0) {
      // TODO: support built-in tools
      const mappedTools = tools
        .filter(
          (tool): tool is LanguageModelV3FunctionTool =>
            tool.type === 'function',
        )
        .map((tool) => ({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        }));

      return {
        ...baseArgs,
        tools: mappedTools,
        tool_choice: toolChoice
          ? getChatCompletionToolChoice(toolChoice)
          : undefined,
      };
    }

    return baseArgs;
  }

  async doGenerate(options: LanguageModelV3CallOptions): Promise<{
    content: Array<LanguageModelV3Content>;
    finishReason: LanguageModelV3FinishReason;
    usage: LanguageModelV3Usage;
    warnings: Array<SharedV3Warning>;
    providerMetadata?: {
      openrouter: {
        provider: string;
        reasoning_details?: ReasoningDetailUnion[];
        usage: OpenRouterUsageAccounting;
      };
    };
    request?: { body?: unknown };
    response?: LanguageModelV3ResponseMetadata & {
      headers?: SharedV3Headers;
      body?: unknown;
    };
  }> {
    const providerOptions = options.providerOptions || {};
    const openrouterOptions = providerOptions.openrouter || {};

    const args = {
      ...this.getArgs(options),
      ...openrouterOptions,
    };

    const { value: responseValue, responseHeaders } = await postJsonToApi({
      url: this.config.url({
        path: '/chat/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: openrouterFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        OpenRouterNonStreamChatCompletionResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    // Check if response is an error (HTTP 200 with error payload)
    if ('error' in responseValue) {
      const errorData = responseValue.error as {
        message: string;
        code?: string;
      };
      throw new APICallError({
        message: errorData.message,
        url: this.config.url({
          path: '/chat/completions',
          modelId: this.modelId,
        }),
        requestBodyValues: args,
        statusCode: 200,
        responseHeaders,
        data: errorData,
      });
    }

    // Now TypeScript knows this is the success response
    const response = responseValue;

    const choice = response.choices[0];

    if (!choice) {
      throw new NoContentGeneratedError({
        message: 'No choice in response',
      });
    }

    // Extract detailed usage information
    const usageInfo: LanguageModelV3Usage = response.usage
      ? {
          inputTokens: {
            total: response.usage.prompt_tokens ?? 0,
            noCache: undefined,
            cacheRead:
              response.usage.prompt_tokens_details?.cached_tokens ?? undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: response.usage.completion_tokens ?? 0,
            text: undefined,
            reasoning:
              response.usage.completion_tokens_details?.reasoning_tokens ??
              undefined,
          },
          raw: response.usage as JSONObject,
        }
      : {
          inputTokens: {
            total: 0,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: 0,
            text: undefined,
            reasoning: undefined,
          },
          raw: undefined,
        };

    const reasoningDetails = choice.message.reasoning_details ?? [];

    const reasoning: Array<LanguageModelV3Content> =
      reasoningDetails.length > 0
        ? (reasoningDetails
            .map((detail) => {
              switch (detail.type) {
                case ReasoningDetailType.Text: {
                  if (detail.text) {
                    return {
                      type: 'reasoning' as const,
                      text: detail.text,
                      providerMetadata: {
                        openrouter: {
                          reasoning_details: [detail],
                        },
                      },
                    };
                  }
                  break;
                }
                case ReasoningDetailType.Summary: {
                  if (detail.summary) {
                    return {
                      type: 'reasoning' as const,
                      text: detail.summary,
                      providerMetadata: {
                        openrouter: {
                          reasoning_details: [detail],
                        },
                      },
                    };
                  }
                  break;
                }
                case ReasoningDetailType.Encrypted: {
                  // For encrypted reasoning, we include a redacted placeholder
                  if (detail.data) {
                    return {
                      type: 'reasoning' as const,
                      text: '[REDACTED]',
                      providerMetadata: {
                        openrouter: {
                          reasoning_details: [detail],
                        },
                      },
                    };
                  }
                  break;
                }
                default: {
                  detail satisfies never;
                }
              }
              return null;
            })
            .filter((p) => p !== null) as Array<LanguageModelV3Content>)
        : choice.message.reasoning
          ? [
              {
                type: 'reasoning' as const,
                text: choice.message.reasoning,
              },
            ]
          : [];

    const content: Array<LanguageModelV3Content> = [];

    // Add reasoning content first
    content.push(...reasoning);

    if (choice.message.content) {
      content.push({
        type: 'text' as const,
        text: choice.message.content,
      });
    }

    if (choice.message.tool_calls) {
      // Only attach reasoning_details to the first tool call to avoid
      // duplicating thinking blocks for parallel tool calls (Claude)
      let reasoningDetailsAttachedToToolCall = false;
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: 'tool-call' as const,
          toolCallId: toolCall.id ?? generateId(),
          toolName: toolCall.function.name,
          input: toolCall.function.arguments ?? '{}',
          providerMetadata: !reasoningDetailsAttachedToToolCall
            ? {
                openrouter: {
                  reasoning_details: reasoningDetails,
                },
              }
            : undefined,
        });
        reasoningDetailsAttachedToToolCall = true;
      }
    }

    if (choice.message.images) {
      for (const image of choice.message.images) {
        content.push({
          type: 'file' as const,
          mediaType: getMediaType(image.image_url.url, 'image/jpeg'),
          data: getBase64FromDataUrl(image.image_url.url),
        });
      }
    }

    if (choice.message.annotations) {
      for (const annotation of choice.message.annotations) {
        if (annotation.type === 'url_citation') {
          content.push({
            type: 'source' as const,
            sourceType: 'url' as const,
            id: annotation.url_citation.url,
            url: annotation.url_citation.url,
            title: annotation.url_citation.title ?? '',
            providerMetadata: {
              openrouter: {
                content: annotation.url_citation.content ?? '',
                startIndex: annotation.url_citation.start_index ?? 0,
                endIndex: annotation.url_citation.end_index ?? 0,
              },
            },
          });
        }
      }
    }

    // Extract file annotations to expose in providerMetadata
    const fileAnnotations = choice.message.annotations?.filter(
      (
        a,
      ): a is {
        type: 'file';
        file: {
          hash: string;
          name: string;
          content?: Array<{ type: string; text?: string }>;
        };
      } => a.type === 'file',
    );

    // Fix for Gemini 3 thoughtSignature: when there are tool calls with encrypted
    // reasoning (thoughtSignature), the model returns 'stop' but expects continuation.
    // Override to 'tool-calls' so the SDK knows to continue the conversation.
    const hasToolCalls =
      choice.message.tool_calls && choice.message.tool_calls.length > 0;
    const hasEncryptedReasoning = reasoningDetails.some(
      (d) => d.type === ReasoningDetailType.Encrypted && d.data,
    );
    const shouldOverrideFinishReason =
      hasToolCalls && hasEncryptedReasoning && choice.finish_reason === 'stop';

    const effectiveFinishReason = shouldOverrideFinishReason
      ? createFinishReason('tool-calls', choice.finish_reason ?? undefined)
      : mapOpenRouterFinishReason(choice.finish_reason);

    return {
      content,
      finishReason: effectiveFinishReason,
      usage: usageInfo,
      warnings: [],
      providerMetadata: {
        openrouter: OpenRouterProviderMetadataSchema.parse({
          provider: response.provider ?? '',
          reasoning_details: choice.message.reasoning_details ?? [],
          annotations:
            fileAnnotations && fileAnnotations.length > 0
              ? fileAnnotations
              : undefined,
          usage: {
            promptTokens: usageInfo.inputTokens.total ?? 0,
            completionTokens: usageInfo.outputTokens.total ?? 0,
            totalTokens:
              (usageInfo.inputTokens.total ?? 0) +
              (usageInfo.outputTokens.total ?? 0),
            ...(response.usage?.cost != null
              ? { cost: response.usage.cost }
              : {}),
            ...(response.usage?.prompt_tokens_details?.cached_tokens != null
              ? {
                  promptTokensDetails: {
                    cachedTokens:
                      response.usage.prompt_tokens_details.cached_tokens,
                  },
                }
              : {}),
            ...(response.usage?.completion_tokens_details?.reasoning_tokens !=
            null
              ? {
                  completionTokensDetails: {
                    reasoningTokens:
                      response.usage.completion_tokens_details.reasoning_tokens,
                  },
                }
              : {}),
            ...(response.usage?.cost_details?.upstream_inference_cost != null
              ? {
                  costDetails: {
                    upstreamInferenceCost:
                      response.usage.cost_details.upstream_inference_cost,
                  },
                }
              : {}),
          },
        }),
      },
      request: { body: args },
      response: {
        id: response.id,
        modelId: response.model,
        headers: responseHeaders,
      },
    };
  }

  async doStream(options: LanguageModelV3CallOptions): Promise<{
    stream: ReadableStream<LanguageModelV3StreamPart>;
    warnings: Array<SharedV3Warning>;
    request?: { body?: unknown };
    response?: LanguageModelV3ResponseMetadata & {
      headers?: SharedV3Headers;
      body?: unknown;
    };
  }> {
    const providerOptions = options.providerOptions || {};
    const openrouterOptions = providerOptions.openrouter || {};

    const args = {
      ...this.getArgs(options),
      ...openrouterOptions,
    };

    const { value: response, responseHeaders } = await postJsonToApi({
      url: this.config.url({
        path: '/chat/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: {
        ...args,
        stream: true,

        // only include stream_options when in strict compatibility mode:
        stream_options:
          this.config.compatibility === 'strict'
            ? {
                include_usage: true,
                // If user has requested usage accounting, make sure we get it in the stream
                ...(this.settings.usage?.include
                  ? { include_usage: true }
                  : {}),
              }
            : undefined,
      },
      failedResponseHandler: openrouterFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        OpenRouterStreamChatCompletionChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const toolCalls: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
      inputStarted: boolean;
      sent: boolean;
    }> = [];

    let finishReason: LanguageModelV3FinishReason = createFinishReason('other');
    const usage: LanguageModelV3Usage = {
      inputTokens: {
        total: undefined,
        noCache: undefined,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: undefined,
        text: undefined,
        reasoning: undefined,
      },
      raw: undefined,
    };

    // Track provider-specific usage information
    const openrouterUsage: Partial<OpenRouterUsageAccounting> = {};

    // Track raw usage from the API response for usage.raw
    let rawUsage: JSONObject | undefined;

    // Track reasoning details to preserve for multi-turn conversations
    const accumulatedReasoningDetails: ReasoningDetailUnion[] = [];

    // Track whether reasoning_details have been attached to a tool call
    // For parallel tool calls (e.g., Claude with thinking), only the first tool call
    // should have reasoning_details to avoid duplicating thinking blocks
    let reasoningDetailsAttachedToToolCall = false;

    // Track file annotations to expose in providerMetadata
    const accumulatedFileAnnotations: FileAnnotation[] = [];

    let textStarted = false;
    let reasoningStarted = false;
    let textId: string | undefined;
    let reasoningId: string | undefined;
    let openrouterResponseId: string | undefined;
    let provider: string | undefined;

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<
            z.infer<typeof OpenRouterStreamChatCompletionChunkSchema>
          >,
          LanguageModelV3StreamPart
        >({
          transform(chunk, controller) {
            // Emit raw chunk if requested (before anything else)
            if (options.includeRawChunks) {
              controller.enqueue({ type: 'raw', rawValue: chunk.rawValue });
            }

            // handle failed chunk parsing / validation:
            if (!chunk.success) {
              finishReason = createFinishReason('error');
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            const value = chunk.value;

            // handle error chunks:
            if ('error' in value) {
              finishReason = createFinishReason('error');
              controller.enqueue({ type: 'error', error: value.error });
              return;
            }

            if (value.provider) {
              provider = value.provider;
            }

            if (value.id) {
              openrouterResponseId = value.id;
              controller.enqueue({
                type: 'response-metadata',
                id: value.id,
              });
            }

            if (value.model) {
              controller.enqueue({
                type: 'response-metadata',
                modelId: value.model,
              });
            }

            if (value.usage != null) {
              usage.inputTokens.total = value.usage.prompt_tokens;
              usage.outputTokens.total = value.usage.completion_tokens;

              // Store raw usage from the API response (cast to JSONObject since schema uses passthrough)
              rawUsage = value.usage as JSONObject;

              // Collect OpenRouter specific usage information
              openrouterUsage.promptTokens = value.usage.prompt_tokens;

              if (value.usage.prompt_tokens_details) {
                const cachedInputTokens =
                  value.usage.prompt_tokens_details.cached_tokens ?? 0;

                usage.inputTokens.cacheRead = cachedInputTokens;
                openrouterUsage.promptTokensDetails = {
                  cachedTokens: cachedInputTokens,
                };
              }

              openrouterUsage.completionTokens = value.usage.completion_tokens;
              if (value.usage.completion_tokens_details) {
                const reasoningTokens =
                  value.usage.completion_tokens_details.reasoning_tokens ?? 0;

                usage.outputTokens.reasoning = reasoningTokens;
                openrouterUsage.completionTokensDetails = {
                  reasoningTokens,
                };
              }

              if (value.usage.cost != null) {
                openrouterUsage.cost = value.usage.cost;
              }
              openrouterUsage.totalTokens = value.usage.total_tokens;
              const upstreamInferenceCost =
                value.usage.cost_details?.upstream_inference_cost;
              if (upstreamInferenceCost != null) {
                openrouterUsage.costDetails = {
                  upstreamInferenceCost,
                };
              }
            }

            const choice = value.choices[0];

            if (choice?.finish_reason != null) {
              finishReason = mapOpenRouterFinishReason(choice.finish_reason);
            }

            if (choice?.delta == null) {
              return;
            }

            const delta = choice.delta;

            const emitReasoningChunk = (
              chunkText: string,
              providerMetadata?: SharedV3ProviderMetadata,
            ) => {
              if (!reasoningStarted) {
                reasoningId = openrouterResponseId || generateId();
                controller.enqueue({
                  providerMetadata,
                  type: 'reasoning-start',
                  id: reasoningId,
                });
                reasoningStarted = true;
              }
              controller.enqueue({
                providerMetadata,
                type: 'reasoning-delta',
                delta: chunkText,
                id: reasoningId || generateId(),
              });
            };

            if (delta.reasoning_details && delta.reasoning_details.length > 0) {
              // Accumulate reasoning_details to preserve for multi-turn conversations
              // Merge consecutive reasoning.text items into a single entry
              for (const detail of delta.reasoning_details) {
                if (detail.type === ReasoningDetailType.Text) {
                  const lastDetail =
                    accumulatedReasoningDetails[
                      accumulatedReasoningDetails.length - 1
                    ];
                  if (lastDetail?.type === ReasoningDetailType.Text) {
                    // Merge with the previous text detail
                    lastDetail.text =
                      (lastDetail.text || '') + (detail.text || '');

                    lastDetail.signature =
                      lastDetail.signature || detail.signature;

                    lastDetail.format = lastDetail.format || detail.format;
                  } else {
                    // Start a new text detail
                    accumulatedReasoningDetails.push({ ...detail });
                  }
                } else {
                  // Non-text details (encrypted, summary) are pushed as-is
                  accumulatedReasoningDetails.push(detail);
                }
              }

              // Emit reasoning_details in providerMetadata for each delta chunk
              // so users can accumulate them on their end before sending back
              const reasoningMetadata: SharedV3ProviderMetadata = {
                openrouter: {
                  reasoning_details: delta.reasoning_details,
                },
              };

              for (const detail of delta.reasoning_details) {
                switch (detail.type) {
                  case ReasoningDetailType.Text: {
                    if (detail.text) {
                      emitReasoningChunk(detail.text, reasoningMetadata);
                    }
                    break;
                  }
                  case ReasoningDetailType.Encrypted: {
                    if (detail.data) {
                      emitReasoningChunk('[REDACTED]', reasoningMetadata);
                    }
                    break;
                  }
                  case ReasoningDetailType.Summary: {
                    if (detail.summary) {
                      emitReasoningChunk(detail.summary, reasoningMetadata);
                    }
                    break;
                  }
                  default: {
                    detail satisfies never;
                    break;
                  }
                }
              }
            } else if (delta.reasoning) {
              emitReasoningChunk(delta.reasoning);
            }

            if (delta.content) {
              // If reasoning was previously active and now we're starting text content,
              // we should end the reasoning first to maintain proper order
              if (reasoningStarted && !textStarted) {
                controller.enqueue({
                  type: 'reasoning-end',
                  id: reasoningId || generateId(),
                  // Include accumulated reasoning_details so the AI SDK can update
                  // the reasoning part's providerMetadata with the correct signature.
                  // The signature typically arrives in the last reasoning delta,
                  // but reasoning-start only carries the first delta's metadata.
                  providerMetadata:
                    accumulatedReasoningDetails.length > 0
                      ? {
                          openrouter: {
                            reasoning_details: accumulatedReasoningDetails,
                          },
                        }
                      : undefined,
                });
                reasoningStarted = false; // Mark as ended so we don't end it again in flush
              }

              if (!textStarted) {
                textId = openrouterResponseId || generateId();
                controller.enqueue({
                  type: 'text-start',
                  id: textId,
                });
                textStarted = true;
              }
              controller.enqueue({
                type: 'text-delta',
                delta: delta.content,
                id: textId || generateId(),
              });
            }

            if (delta.annotations) {
              for (const annotation of delta.annotations) {
                if (annotation.type === 'url_citation') {
                  controller.enqueue({
                    type: 'source',
                    sourceType: 'url' as const,
                    id: annotation.url_citation.url,
                    url: annotation.url_citation.url,
                    title: annotation.url_citation.title ?? '',
                    providerMetadata: {
                      openrouter: {
                        content: annotation.url_citation.content ?? '',
                        startIndex: annotation.url_citation.start_index ?? 0,
                        endIndex: annotation.url_citation.end_index ?? 0,
                      },
                    },
                  });
                } else if (annotation.type === 'file') {
                  // Accumulate file annotations to expose in providerMetadata
                  // Type guard to validate structure matches expected shape
                  const file = (annotation as { file?: unknown }).file;
                  if (
                    file &&
                    typeof file === 'object' &&
                    'hash' in file &&
                    'name' in file
                  ) {
                    accumulatedFileAnnotations.push(
                      annotation as FileAnnotation,
                    );
                  }
                }
              }
            }

            if (delta.tool_calls != null) {
              for (const toolCallDelta of delta.tool_calls) {
                const index = toolCallDelta.index ?? toolCalls.length - 1;

                // Tool call start. OpenRouter returns all information except the arguments in the first chunk.
                if (toolCalls[index] == null) {
                  if (toolCallDelta.type !== 'function') {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function' type.`,
                    });
                  }

                  if (toolCallDelta.id == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'id' to be a string.`,
                    });
                  }

                  if (toolCallDelta.function?.name == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function.name' to be a string.`,
                    });
                  }

                  toolCalls[index] = {
                    id: toolCallDelta.id,
                    type: 'function',
                    function: {
                      name: toolCallDelta.function.name,
                      arguments: toolCallDelta.function.arguments ?? '',
                    },
                    inputStarted: false,
                    sent: false,
                  };

                  const toolCall = toolCalls[index];

                  if (toolCall == null) {
                    throw new InvalidResponseDataError({
                      data: { index, toolCallsLength: toolCalls.length },
                      message: `Tool call at index ${index} is missing after creation.`,
                    });
                  }

                  // check if tool call is complete (some providers send the full tool call in one chunk)
                  if (
                    toolCall.function?.name != null &&
                    toolCall.function?.arguments != null &&
                    isParsableJson(toolCall.function.arguments)
                  ) {
                    toolCall.inputStarted = true;

                    controller.enqueue({
                      type: 'tool-input-start',
                      id: toolCall.id,
                      toolName: toolCall.function.name,
                    });

                    // send delta
                    controller.enqueue({
                      type: 'tool-input-delta',
                      id: toolCall.id,
                      delta: toolCall.function.arguments,
                    });

                    controller.enqueue({
                      type: 'tool-input-end',
                      id: toolCall.id,
                    });

                    // send tool call
                    // Only attach reasoning_details to the first tool call to avoid
                    // duplicating thinking blocks for parallel tool calls (Claude)
                    controller.enqueue({
                      type: 'tool-call',
                      toolCallId: toolCall.id,
                      toolName: toolCall.function.name,
                      input: toolCall.function.arguments,
                      providerMetadata: !reasoningDetailsAttachedToToolCall
                        ? {
                            openrouter: {
                              reasoning_details: accumulatedReasoningDetails,
                            },
                          }
                        : undefined,
                    });

                    reasoningDetailsAttachedToToolCall = true;
                    toolCall.sent = true;
                  }

                  continue;
                }

                // existing tool call, merge
                const toolCall = toolCalls[index];

                if (toolCall == null) {
                  throw new InvalidResponseDataError({
                    data: {
                      index,
                      toolCallsLength: toolCalls.length,
                      toolCallDelta,
                    },
                    message: `Tool call at index ${index} is missing during merge.`,
                  });
                }

                if (!toolCall.inputStarted) {
                  toolCall.inputStarted = true;
                  controller.enqueue({
                    type: 'tool-input-start',
                    id: toolCall.id,
                    toolName: toolCall.function.name,
                  });
                }

                if (toolCallDelta.function?.arguments != null) {
                  toolCall.function.arguments +=
                    toolCallDelta.function?.arguments ?? '';
                }

                // send delta
                controller.enqueue({
                  type: 'tool-input-delta',
                  id: toolCall.id,
                  delta: toolCallDelta.function.arguments ?? '',
                });

                // check if tool call is complete
                if (
                  toolCall.function?.name != null &&
                  toolCall.function?.arguments != null &&
                  isParsableJson(toolCall.function.arguments)
                ) {
                  // Only attach reasoning_details to the first tool call to avoid
                  // duplicating thinking blocks for parallel tool calls (Claude)
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: toolCall.id ?? generateId(),
                    toolName: toolCall.function.name,
                    input: toolCall.function.arguments,
                    providerMetadata: !reasoningDetailsAttachedToToolCall
                      ? {
                          openrouter: {
                            reasoning_details: accumulatedReasoningDetails,
                          },
                        }
                      : undefined,
                  });

                  reasoningDetailsAttachedToToolCall = true;
                  toolCall.sent = true;
                }
              }
            }

            if (delta.images != null) {
              for (const image of delta.images) {
                controller.enqueue({
                  type: 'file',
                  mediaType: getMediaType(image.image_url.url, 'image/jpeg'),
                  data: getBase64FromDataUrl(image.image_url.url),
                });
              }
            }
          },

          flush(controller) {
            // Fix for Gemini 3 thoughtSignature: when there are tool calls with encrypted
            // reasoning (thoughtSignature), the model returns 'stop' but expects continuation.
            // Override to 'tool-calls' so the SDK knows to continue the conversation.
            const hasToolCalls = toolCalls.length > 0;
            const hasEncryptedReasoning = accumulatedReasoningDetails.some(
              (d) => d.type === ReasoningDetailType.Encrypted && d.data,
            );
            if (
              hasToolCalls &&
              hasEncryptedReasoning &&
              finishReason.unified === 'stop'
            ) {
              finishReason = createFinishReason('tool-calls', finishReason.raw);
            }

            // Forward any unsent tool calls if finish reason is 'tool-calls'
            if (finishReason.unified === 'tool-calls') {
              for (const toolCall of toolCalls) {
                if (toolCall && !toolCall.sent) {
                  // Only attach reasoning_details to the first tool call to avoid
                  // duplicating thinking blocks for parallel tool calls (Claude)
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: toolCall.id ?? generateId(),
                    toolName: toolCall.function.name,
                    // Coerce invalid arguments to an empty JSON object
                    input: isParsableJson(toolCall.function.arguments)
                      ? toolCall.function.arguments
                      : '{}',
                    providerMetadata: !reasoningDetailsAttachedToToolCall
                      ? {
                          openrouter: {
                            reasoning_details: accumulatedReasoningDetails,
                          },
                        }
                      : undefined,
                  });
                  reasoningDetailsAttachedToToolCall = true;
                  toolCall.sent = true;
                }
              }
            }

            // End reasoning first if it was started, to maintain proper order
            if (reasoningStarted) {
              controller.enqueue({
                type: 'reasoning-end',
                id: reasoningId || generateId(),
                // Include accumulated reasoning_details so the AI SDK can update
                // the reasoning part's providerMetadata with the correct signature.
                providerMetadata:
                  accumulatedReasoningDetails.length > 0
                    ? {
                        openrouter: {
                          reasoning_details: accumulatedReasoningDetails,
                        },
                      }
                    : undefined,
              });
            }
            if (textStarted) {
              controller.enqueue({
                type: 'text-end',
                id: textId || generateId(),
              });
            }

            const openrouterMetadata: {
              usage: Partial<OpenRouterUsageAccounting>;
              provider?: string;
              reasoning_details?: ReasoningDetailUnion[];
              annotations?: FileAnnotation[];
            } = {
              usage: openrouterUsage,
            };

            // Only include provider if it's actually set
            if (provider !== undefined) {
              openrouterMetadata.provider = provider;
            }

            // Include accumulated reasoning_details if any were received
            if (accumulatedReasoningDetails.length > 0) {
              openrouterMetadata.reasoning_details =
                accumulatedReasoningDetails;
            }

            // Include accumulated file annotations if any were received
            if (accumulatedFileAnnotations.length > 0) {
              openrouterMetadata.annotations = accumulatedFileAnnotations;
            }

            // Set raw usage before emitting finish event
            usage.raw = rawUsage;

            controller.enqueue({
              type: 'finish',
              finishReason,
              usage,
              providerMetadata: {
                openrouter: openrouterMetadata,
              },
            });
          },
        }),
      ),
      warnings: [],
      request: { body: args },
      response: { headers: responseHeaders },
    };
  }
}
