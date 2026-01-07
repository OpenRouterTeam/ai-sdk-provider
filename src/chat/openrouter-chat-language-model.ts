import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  SharedV3Warning,
} from '@ai-sdk/provider';
import { combineHeaders, normalizeHeaders } from '@ai-sdk/provider-utils';
import { OpenRouter } from '@openrouter/sdk';
import type {
  OpenResponsesRequest,
  OpenResponsesNonStreamingResponse,
} from '@openrouter/sdk/models';

/**
 * Raw streaming chunk from OpenRouter API (snake_case fields).
 */
interface RawStreamingChunk {
  id: string;
  provider?: string;
  model: string;
  object: 'chat.completion.chunk';
  created: number;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string | null;
      reasoning?: string | null;
      annotations?: Array<{
        type: string;
        url_citation?: {
          url: string;
          title: string;
          start_index?: number;
          end_index?: number;
          content?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
      cache_write_tokens?: number;
      audio_tokens?: number;
      video_tokens?: number;
    };
    completion_tokens_details?: {
      reasoning_tokens?: number;
      image_tokens?: number;
    };
  };
}

import type { OpenRouterModelSettings } from '../openrouter-provider.js';
import { buildProviderMetadata } from '../utils/build-provider-metadata.js';
import { buildUsage } from '../utils/build-usage.js';
import { convertToChatCompletionsMessages } from './convert-to-chat-completions-messages.js';
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
   * OpenRouter Chat API only supports image URLs natively.
   * PDF URLs are not supported - use PDF data URIs or the Responses API instead.
   */
  readonly supportedUrls: Record<string, RegExp[]> = {
    'image/*': [/^https?:\/\/.*$/],
  };

  constructor(modelId: string, settings: OpenRouterModelSettings) {
    this.modelId = modelId;
    this.settings = settings;
  }

  async doGenerate(
    options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3GenerateResult> {
    const warnings: SharedV3Warning[] = [];

    // Create OpenRouter client
    const client = new OpenRouter({
      apiKey: this.settings.apiKey,
      serverURL: this.settings.baseURL,
    });

    // Convert messages to OpenRouter Responses API format
    const openRouterInput = convertToOpenRouterMessages(options.prompt);

    // Build request parameters for Responses API (non-streaming)
    const requestParams: OpenResponsesRequest & { stream: false } = {
      model: this.modelId,
      input: openRouterInput as OpenResponsesRequest['input'],
      stream: false,
      ...(options.maxOutputTokens !== undefined && {
        maxOutputTokens: options.maxOutputTokens,
      }),
      ...(options.temperature !== undefined && {
        temperature: options.temperature,
      }),
      ...(options.topP !== undefined && { topP: options.topP }),
    };

    // Make the non-streaming request using Responses API
    const combinedHeaders = normalizeHeaders(
      combineHeaders(this.settings.headers, options.headers)
    );

    const response = (await client.beta.responses.send(requestParams, {
      fetchOptions: {
        signal: options.abortSignal,
        headers: combinedHeaders,
      },
    })) as OpenResponsesNonStreamingResponse;

    // Build content array from Responses API output
    const content: LanguageModelV3Content[] = [];

    // Process output items
    for (const outputItem of response.output) {
      if (outputItem.type === 'reasoning') {
        // Extract reasoning text from content array or summary
        const reasoningItem = outputItem as {
          type: 'reasoning';
          content?: Array<{ type: string; text: string }>;
          summary?: Array<{ type: string; text: string }>;
        };
        const reasoningText =
          reasoningItem.content
            ?.filter((c) => c.type === 'reasoning_text')
            .map((c) => c.text)
            .join('') ||
          reasoningItem.summary
            ?.filter((c) => c.type === 'summary_text')
            .map((c) => c.text)
            .join('') ||
          '';

        if (reasoningText) {
          content.push({
            type: 'reasoning',
            text: reasoningText,
          });
        }
      } else if (outputItem.type === 'message') {
        // Extract text content from message
        const messageItem = outputItem as {
          type: 'message';
          content: Array<{ type: string; text?: string }>;
        };
        for (const contentItem of messageItem.content) {
          if (contentItem.type === 'output_text' && contentItem.text) {
            content.push({
              type: 'text',
              text: contentItem.text,
            });
          }
        }
      } else if (outputItem.type === 'function_call') {
        // Handle tool/function calls
        const functionCallItem = outputItem as {
          type: 'function_call';
          callId: string;
          name: string;
          arguments: string;
        };
        content.push({
          type: 'tool-call',
          toolCallId: functionCallItem.callId,
          toolName: functionCallItem.name,
          input: functionCallItem.arguments,
        });
      }
    }

    // Use outputText as fallback if no text content was extracted
    if (
      response.outputText &&
      !content.some((c) => c.type === 'text')
    ) {
      content.push({
        type: 'text',
        text: response.outputText,
      });
    }

    // Build finish reason based on response status
    const finishReason = mapOpenRouterFinishReason(
      response.status === 'completed' ? 'stop' : response.status ?? 'stop'
    );

    // Build usage from Responses API format
    const usage = buildUsage(
      response.usage
        ? {
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
          }
        : undefined
    );

    // Build provider metadata
    // Note: The Responses API doesn't include 'provider' field directly
    const providerMetadata = buildProviderMetadata({
      id: response.id,
      provider: undefined, // Responses API doesn't expose provider in response
      usage: response.usage
        ? {
            promptTokens: response.usage.inputTokens,
            completionTokens: response.usage.outputTokens,
            totalTokens: response.usage.totalTokens,
            cost: response.usage.cost ?? undefined,
          }
        : undefined,
    });

    return {
      content,
      finishReason,
      usage,
      warnings,
      providerMetadata,
      request: {
        body: requestParams,
      },
      response: {
        id: response.id,
        timestamp: new Date(response.createdAt * 1000),
        modelId: response.model,
      },
    };
  }

  async doStream(
    options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3StreamResult> {
    const warnings: SharedV3Warning[] = [];

    // Convert messages to Chat Completions format (streaming still uses this API)
    const openRouterMessages = convertToChatCompletionsMessages(options.prompt);

    // Build request parameters
    const modelOptions = this.settings.modelOptions;
    const requestParams: Record<string, unknown> = {
      model: this.modelId,
      messages: openRouterMessages,
      stream: true,
      stream_options: { include_usage: true },
      ...(options.maxOutputTokens !== undefined && {
        max_tokens: options.maxOutputTokens,
      }),
      ...(options.temperature !== undefined && {
        temperature: options.temperature,
      }),
      ...(options.topP !== undefined && { top_p: options.topP }),
      ...(options.frequencyPenalty !== undefined && {
        frequency_penalty: options.frequencyPenalty,
      }),
      ...(options.presencePenalty !== undefined && {
        presence_penalty: options.presencePenalty,
      }),
      ...(options.seed !== undefined && { seed: options.seed }),
      ...(options.stopSequences !== undefined &&
        options.stopSequences.length > 0 && {
          stop: options.stopSequences,
        }),
      // OpenRouter-specific options from model settings
      ...(modelOptions?.plugins && { plugins: modelOptions.plugins }),
      ...(modelOptions?.transforms && { transforms: modelOptions.transforms }),
      ...(modelOptions?.models && { models: modelOptions.models }),
      ...(modelOptions?.route && { route: modelOptions.route }),
      ...(modelOptions?.provider && { provider: modelOptions.provider }),
      // Extra body parameters
      ...this.settings.extraBody,
    };

    // Make the streaming request using native fetch
    // (SDK has parsing issues with large annotation chunks)
    const combinedHeaders = normalizeHeaders(
      combineHeaders(this.settings.headers, options.headers)
    );

    const baseUrl = this.settings.baseURL || 'https://openrouter.ai/api/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.settings.apiKey}`,
        ...combinedHeaders,
      },
      body: JSON.stringify(requestParams),
      signal: options.abortSignal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${errorBody}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    // Track state for stream transformation
    let responseId: string | undefined;
    let responseModel: string | undefined;
    let responseCreated: number | undefined;
    let responseProvider: string | undefined;
    let textStarted = false;
    const textId = 'text-0';
    let reasoningStarted = false;
    const reasoningId = 'reasoning-0';
    let finishReason: string | null | undefined;
    let textEnded = false;
    let reasoningEnded = false;
    const sourceIds: string[] = [];

    // Create an async generator from the SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    async function* parseSSEStream(): AsyncGenerator<RawStreamingChunk> {
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) {
            continue;
          }
          if (trimmed === 'data: [DONE]') {
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const parsed = JSON.parse(jsonStr);
              yield parsed as RawStreamingChunk;
            } catch {
              // Skip malformed JSON chunks (e.g., SSE comment lines)
              continue;
            }
          }
        }
      }
    }

    // Transform the EventStream to AI SDK V3 stream parts
    const transformedStream = new ReadableStream<LanguageModelV3StreamPart>({
      async start(controller) {
        // Emit stream-start first
        controller.enqueue({
          type: 'stream-start',
          warnings,
        });

        try {
          for await (const chunk of parseSSEStream()) {
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
              getResponseProvider: () => responseProvider,
              setResponseProvider: (provider: string) => {
                responseProvider = provider;
              },
              getFinishReason: () => finishReason,
              setFinishReason: (reason: string | null) => {
                finishReason = reason;
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
              getTextEnded: () => textEnded,
              setTextEnded: (ended: boolean) => {
                textEnded = ended;
              },
              getReasoningEnded: () => reasoningEnded,
              setReasoningEnded: (ended: boolean) => {
                reasoningEnded = ended;
              },
              getNextSourceId: () => {
                const id = `source-${sourceIds.length}`;
                sourceIds.push(id);
                return id;
              },
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
  getResponseProvider: () => string | undefined;
  setResponseProvider: (provider: string) => void;
  getTextStarted: () => boolean;
  setTextStarted: (started: boolean) => void;
  getTextId: () => string;
  getReasoningStarted: () => boolean;
  setReasoningStarted: (started: boolean) => void;
  getReasoningId: () => string;
  getFinishReason: () => string | null | undefined;
  setFinishReason: (reason: string | null) => void;
  getTextEnded: () => boolean;
  setTextEnded: (ended: boolean) => void;
  getReasoningEnded: () => boolean;
  setReasoningEnded: (ended: boolean) => void;
  getNextSourceId: () => string;
}

/**
 * Transform a streaming chunk from OpenRouter to AI SDK V3 stream parts.
 */
function transformChunk(
  chunk: RawStreamingChunk,
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
  if (chunk.provider && !state.getResponseProvider()) {
    state.setResponseProvider(chunk.provider);
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

    // Handle annotations (web search sources)
    if (delta.annotations) {
      for (const annotation of delta.annotations) {
        if (annotation.type === 'url_citation' && annotation.url_citation) {
          const sourceId = state.getNextSourceId();
          parts.push({
            type: 'source',
            sourceType: 'url',
            id: sourceId,
            url: annotation.url_citation.url,
            title: annotation.url_citation.title,
          });
        }
      }
    }

    // Handle finish reason - record it but don't emit finish yet (usage comes in separate chunk)
    if (choice.finish_reason !== null && !state.getFinishReason()) {
      state.setFinishReason(choice.finish_reason);

      // End text if started and not ended
      if (state.getTextStarted() && !state.getTextEnded()) {
        state.setTextEnded(true);
        parts.push({
          type: 'text-end',
          id: state.getTextId(),
        });
      }

      // End reasoning if started and not ended
      if (state.getReasoningStarted() && !state.getReasoningEnded()) {
        state.setReasoningEnded(true);
        parts.push({
          type: 'reasoning-end',
          id: state.getReasoningId(),
        });
      }
    }
  }

  // Handle usage data - this typically comes in a final chunk AFTER finishReason
  // Only emit finish when we have usage data
  if (chunk.usage) {
    // Emit response-metadata first
    const responseCreated = state.getResponseCreated();
    parts.push({
      type: 'response-metadata',
      id: state.getResponseId(),
      timestamp: responseCreated ? new Date(responseCreated * 1000) : undefined,
      modelId: state.getResponseModel(),
    });

    // Emit finish with usage data
    const storedFinishReason = state.getFinishReason();
    const finishReason = mapOpenRouterFinishReason(storedFinishReason ?? 'stop');

    // Build usage (raw API uses snake_case)
    const usage = buildUsage({
      inputTokens: chunk.usage.prompt_tokens,
      outputTokens: chunk.usage.completion_tokens,
    });

    // Build provider metadata with full usage data (convert to SDK camelCase format)
    const providerMetadata = buildProviderMetadata({
      id: state.getResponseId(),
      provider: state.getResponseProvider(),
      usage: {
        promptTokens: chunk.usage.prompt_tokens,
        completionTokens: chunk.usage.completion_tokens,
        totalTokens: chunk.usage.total_tokens,
        cost: chunk.usage.cost,
        promptTokensDetails: chunk.usage.prompt_tokens_details
          ? {
              cachedTokens: chunk.usage.prompt_tokens_details.cached_tokens,
              cacheWriteTokens: chunk.usage.prompt_tokens_details.cache_write_tokens,
              audioTokens: chunk.usage.prompt_tokens_details.audio_tokens,
              videoTokens: chunk.usage.prompt_tokens_details.video_tokens,
            }
          : undefined,
        completionTokensDetails: chunk.usage.completion_tokens_details
          ? {
              reasoningTokens: chunk.usage.completion_tokens_details.reasoning_tokens,
              imageTokens: chunk.usage.completion_tokens_details.image_tokens,
            }
          : undefined,
      },
    });

    parts.push({
      type: 'finish',
      finishReason,
      usage,
      providerMetadata,
    });
  }

  return parts;
}
