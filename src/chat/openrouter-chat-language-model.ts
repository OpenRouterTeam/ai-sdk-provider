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
  ChatGenerationParams,
  ChatResponse,
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

    // Convert messages to OpenRouter format
    const openRouterMessages = convertToOpenRouterMessages(options.prompt);

    // Build request parameters (non-streaming)
    const requestParams: ChatGenerationParams & { stream: false } = {
      model: this.modelId,
      messages: openRouterMessages as ChatGenerationParams['messages'],
      stream: false,
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

    // Make the non-streaming request
    const combinedHeaders = normalizeHeaders(
      combineHeaders(this.settings.headers, options.headers)
    );

    const response = (await client.chat.send(requestParams, {
      fetchOptions: {
        signal: options.abortSignal,
        headers: combinedHeaders,
      },
    })) as ChatResponse;

    // Extract choice data
    const choice = response.choices[0];
    const message = choice?.message;

    // Build content array
    const content: LanguageModelV3Content[] = [];

    // Add reasoning if present
    if (message?.reasoning) {
      content.push({
        type: 'reasoning',
        text: message.reasoning,
      });
    }

    // Add text content if present
    if (message?.content) {
      const textContent =
        typeof message.content === 'string'
          ? message.content
          : message.content
              .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
              .map((c) => c.text)
              .join('');

      if (textContent) {
        content.push({
          type: 'text',
          text: textContent,
        });
      }
    }

    // Add tool calls if present
    if (message?.toolCalls) {
      for (const toolCall of message.toolCalls) {
        content.push({
          type: 'tool-call',
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          input: toolCall.function.arguments,
        });
      }
    }

    // Build finish reason
    const finishReason = mapOpenRouterFinishReason(choice?.finishReason);

    // Build usage
    const usage = buildUsage(
      response.usage
        ? {
            inputTokens: response.usage.promptTokens,
            outputTokens: response.usage.completionTokens,
          }
        : undefined
    );

    // Build provider metadata
    // Note: The SDK types don't include 'provider' but the API returns it
    const providerMetadata = buildProviderMetadata({
      id: response.id,
      provider: (response as typeof response & { provider?: string }).provider,
      usage: response.usage,
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
        timestamp: new Date(response.created * 1000),
        modelId: response.model,
      },
    };
  }

  async doStream(
    options: LanguageModelV3CallOptions
  ): Promise<LanguageModelV3StreamResult> {
    const warnings: SharedV3Warning[] = [];

    // Convert messages to OpenRouter format
    const openRouterMessages = convertToOpenRouterMessages(options.prompt);

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

    async function* parseSSEStream(): AsyncGenerator<ChatStreamingResponseChunkData> {
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
              yield parsed as ChatStreamingResponseChunkData;
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
  chunk: ChatStreamingResponseChunkData,
  state: StreamState
): LanguageModelV3StreamPart[] {
  const parts: LanguageModelV3StreamPart[] = [];

  // Capture response metadata
  // Note: The SDK types don't include 'provider' but the API returns it on each chunk
  const chunkWithProvider = chunk as typeof chunk & { provider?: string };

  if (chunk.id && !state.getResponseId()) {
    state.setResponseId(chunk.id);
  }
  if (chunk.model && !state.getResponseModel()) {
    state.setResponseModel(chunk.model);
  }
  if (chunk.created && !state.getResponseCreated()) {
    state.setResponseCreated(chunk.created);
  }
  if (chunkWithProvider.provider && !state.getResponseProvider()) {
    state.setResponseProvider(chunkWithProvider.provider);
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
    // The SDK types don't include annotations but the API returns them for web search
    const deltaWithAnnotations = delta as typeof delta & {
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

    if (deltaWithAnnotations.annotations) {
      for (const annotation of deltaWithAnnotations.annotations) {
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
    if (choice.finishReason !== null && !state.getFinishReason()) {
      state.setFinishReason(choice.finishReason);

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

    // Build usage
    const usage = buildUsage({
      inputTokens: chunk.usage.promptTokens,
      outputTokens: chunk.usage.completionTokens,
    });

    // Build provider metadata with full usage data
    const providerMetadata = buildProviderMetadata({
      id: state.getResponseId(),
      provider: state.getResponseProvider(),
      usage: chunk.usage,
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
