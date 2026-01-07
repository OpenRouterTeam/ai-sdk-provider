import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  SharedV3Warning,
} from '@ai-sdk/provider';
import { combineHeaders, normalizeHeaders } from '@ai-sdk/provider-utils';
import { OpenRouter } from '@openrouter/sdk';
import type {
  ChatGenerationParams,
  ChatStreamingResponseChunkData,
} from '@openrouter/sdk/models';

import type { OpenRouterModelSettings } from '../openrouter-provider.js';
import { buildProviderMetadata } from '../utils/build-provider-metadata.js';
import { buildUsage } from '../utils/build-usage.js';
import { convertToOpenRouterMessages } from './convert-to-openrouter-messages.js';
import { mapOpenRouterFinishReason } from './map-openrouter-finish-reason.js';

/**
 * OpenRouter chat language model implementing AI SDK V3 LanguageModelV3 interface.
 *
 * Uses the OpenRouter Chat Completions API for chat completions.
 */
export class OpenRouterChatLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'openrouter';
  readonly modelId: string;

  private readonly settings: OpenRouterModelSettings;

  /**
   * Supported URL patterns by media type.
   * OpenRouter supports image URLs and PDF URLs natively.
   */
  readonly supportedUrls: Record<string, RegExp[]> = {
    'image/*': [/^https?:\/\/.*$/],
    'application/pdf': [/^https?:\/\/.*$/],
  };

  constructor(modelId: string, settings: OpenRouterModelSettings) {
    this.modelId = modelId;
    this.settings = settings;
  }

  async doGenerate(
    _options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3GenerateResult> {
    throw new Error('Not implemented');
  }

  async doStream(
    options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3StreamResult> {
    const warnings: SharedV3Warning[] = [];

    // Create OpenRouter client
    const client = new OpenRouter({
      apiKey: this.settings.apiKey,
      serverURL: this.settings.baseURL,
    });

    // Convert messages to OpenRouter format
    const openRouterMessages = convertToOpenRouterMessages(options.prompt);

    // Build request parameters
    const requestParams: ChatGenerationParams & { stream: true } = {
      model: this.modelId,
      messages: openRouterMessages as ChatGenerationParams['messages'],
      stream: true,
      streamOptions: { includeUsage: true },
      ...(options.maxOutputTokens !== undefined && {
        maxTokens: options.maxOutputTokens,
      }),
      ...(options.temperature !== undefined && {
        temperature: options.temperature,
      }),
      ...(options.topP !== undefined && { topP: options.topP }),
      ...(options.frequencyPenalty !== undefined && {
        frequencyPenalty: options.frequencyPenalty,
      }),
      ...(options.presencePenalty !== undefined && {
        presencePenalty: options.presencePenalty,
      }),
      ...(options.seed !== undefined && { seed: options.seed }),
      ...(options.stopSequences !== undefined &&
        options.stopSequences.length > 0 && {
          stop: options.stopSequences,
        }),
    };

    // Make the streaming request
    const combinedHeaders = normalizeHeaders(
      combineHeaders(this.settings.headers, options.headers)
    );

    const eventStream = await client.chat.send(requestParams, {
      fetchOptions: {
        signal: options.abortSignal,
        headers: combinedHeaders,
      },
    });

    // Track state for stream transformation
    let responseId: string | undefined;
    let responseModel: string | undefined;
    let responseCreated: number | undefined;
    let textStarted = false;
    let textId = 'text-0';
    let reasoningStarted = false;
    let reasoningId = 'reasoning-0';

    // Transform the EventStream to AI SDK V3 stream parts
    const transformedStream = new ReadableStream<LanguageModelV3StreamPart>({
      async start(controller) {
        // Emit stream-start first
        controller.enqueue({
          type: 'stream-start',
          warnings,
        });

        try {
          for await (const chunk of eventStream) {
            const parts = transformChunk(chunk, {
              getResponseId: () => responseId,
              setResponseId: (id: string) => {
                responseId = id;
              },
              getResponseModel: () => responseModel,
              setResponseModel: (model: string) => {
                responseModel = model;
              },
              getResponseCreated: () => responseCreated,
              setResponseCreated: (created: number) => {
                responseCreated = created;
              },
              getTextStarted: () => textStarted,
              setTextStarted: (started: boolean) => {
                textStarted = started;
              },
              getTextId: () => textId,
              getReasoningStarted: () => reasoningStarted,
              setReasoningStarted: (started: boolean) => {
                reasoningStarted = started;
              },
              getReasoningId: () => reasoningId,
            });

            for (const part of parts) {
              controller.enqueue(part);
            }
          }
        } catch (error) {
          controller.enqueue({
            type: 'error',
            error,
          });
        } finally {
          controller.close();
        }
      },
    });

    return {
      stream: transformedStream,
      request: {
        body: requestParams,
      },
    };
  }
}

interface StreamState {
  getResponseId: () => string | undefined;
  setResponseId: (id: string) => void;
  getResponseModel: () => string | undefined;
  setResponseModel: (model: string) => void;
  getResponseCreated: () => number | undefined;
  setResponseCreated: (created: number) => void;
  getTextStarted: () => boolean;
  setTextStarted: (started: boolean) => void;
  getTextId: () => string;
  getReasoningStarted: () => boolean;
  setReasoningStarted: (started: boolean) => void;
  getReasoningId: () => string;
}

/**
 * Transform a streaming chunk from OpenRouter to AI SDK V3 stream parts.
 */
function transformChunk(
  chunk: ChatStreamingResponseChunkData,
  state: StreamState
): LanguageModelV3StreamPart[] {
  const parts: LanguageModelV3StreamPart[] = [];

  // Capture response metadata
  if (chunk.id && !state.getResponseId()) {
    state.setResponseId(chunk.id);
  }
  if (chunk.model && !state.getResponseModel()) {
    state.setResponseModel(chunk.model);
  }
  if (chunk.created && !state.getResponseCreated()) {
    state.setResponseCreated(chunk.created);
  }

  // Process choices
  for (const choice of chunk.choices) {
    const delta = choice.delta;

    // Handle text content
    if (delta.content !== undefined && delta.content !== null) {
      // Emit text-start if not started
      if (!state.getTextStarted()) {
        state.setTextStarted(true);
        parts.push({
          type: 'text-start',
          id: state.getTextId(),
        });
      }

      // Emit text-delta
      if (delta.content.length > 0) {
        parts.push({
          type: 'text-delta',
          id: state.getTextId(),
          delta: delta.content,
        });
      }
    }

    // Handle reasoning content
    if (delta.reasoning !== undefined && delta.reasoning !== null) {
      // Emit reasoning-start if not started
      if (!state.getReasoningStarted()) {
        state.setReasoningStarted(true);
        parts.push({
          type: 'reasoning-start',
          id: state.getReasoningId(),
        });
      }

      // Emit reasoning-delta
      if (delta.reasoning.length > 0) {
        parts.push({
          type: 'reasoning-delta',
          id: state.getReasoningId(),
          delta: delta.reasoning,
        });
      }
    }

    // Handle finish reason
    if (choice.finishReason !== null) {
      // End text if started
      if (state.getTextStarted()) {
        parts.push({
          type: 'text-end',
          id: state.getTextId(),
        });
      }

      // End reasoning if started
      if (state.getReasoningStarted()) {
        parts.push({
          type: 'reasoning-end',
          id: state.getReasoningId(),
        });
      }

      // Emit response-metadata
      const responseCreated = state.getResponseCreated();
      parts.push({
        type: 'response-metadata',
        id: state.getResponseId(),
        timestamp: responseCreated
          ? new Date(responseCreated * 1000)
          : undefined,
        modelId: state.getResponseModel(),
      });

      // Emit finish
      const finishReason = mapOpenRouterFinishReason(choice.finishReason);

      // Build usage from chunk.usage if available
      const usage = buildUsage(
        chunk.usage
          ? {
              inputTokens: chunk.usage.promptTokens,
              outputTokens: chunk.usage.completionTokens,
            }
          : undefined
      );

      // Build provider metadata
      const providerMetadata = buildProviderMetadata({
        id: state.getResponseId(),
        usage: chunk.usage
          ? {
              prompt_tokens: chunk.usage.promptTokens,
              completion_tokens: chunk.usage.completionTokens,
              total_tokens: chunk.usage.totalTokens,
            }
          : undefined,
      });

      parts.push({
        type: 'finish',
        finishReason,
        usage,
        providerMetadata,
      });
    }
  }

  return parts;
}
