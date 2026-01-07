import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3Content,
  LanguageModelV3FunctionTool,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3ToolChoice,
  SharedV3Warning,
} from '@ai-sdk/provider';
import type { EventStream } from '@openrouter/sdk/lib/event-streams';
import type {
  OpenAIResponsesToolChoiceUnion,
  OpenResponsesNonStreamingResponse,
  OpenResponsesRequest,
  OpenResponsesRequestToolFunction,
  OpenResponsesStreamEvent,
} from '@openrouter/sdk/models';
import type { OpenRouterModelSettings } from '../openrouter-provider.js';
import type { ReasoningOutputItem } from './extract-reasoning-details.js';

import { combineHeaders, normalizeHeaders } from '@ai-sdk/provider-utils';
import { OpenRouter } from '@openrouter/sdk';
import { buildProviderMetadata } from '../utils/build-provider-metadata.js';
import { buildUsage } from '../utils/build-usage.js';
import { convertToOpenRouterMessages } from './convert-to-openrouter-messages.js';
import {
  buildReasoningProviderMetadata,
  extractReasoningDetails,
  hasEncryptedReasoning,
} from './extract-reasoning-details.js';
import { mapOpenRouterFinishReason } from './map-openrouter-finish-reason.js';

/**
 * OpenRouter chat language model implementing AI SDK V3 LanguageModelV3 interface.
 *
 * Uses the OpenRouter Responses API for both streaming and non-streaming requests.
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
    options: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3GenerateResult> {
    const warnings: SharedV3Warning[] = [];

    // Create OpenRouter client
    const client = new OpenRouter({
      apiKey: this.settings.apiKey,
      serverURL: this.settings.baseURL,
      userAgent: this.settings.userAgent,
    });

    // Convert messages to OpenRouter Responses API format
    const openRouterInput = convertToOpenRouterMessages(options.prompt);

    // Convert tools to Responses API format
    const tools = convertToolsToResponsesFormat(options.tools, warnings);

    // Convert toolChoice to Responses API format
    const toolChoice = convertToolChoiceToResponsesFormat(options.toolChoice);

    // Convert responseFormat to Responses API text.format
    const text = convertResponseFormatToText(options.responseFormat);

    // Extract model options from settings
    const modelOptions = this.settings.modelOptions;

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
      ...(tools.length > 0 && { tools }),
      ...(toolChoice !== undefined && { toolChoice }),
      ...(text !== undefined && { text }),
      // Forward model options from settings
      ...(modelOptions?.reasoning !== undefined && {
        reasoning: modelOptions.reasoning as OpenResponsesRequest['reasoning'],
      }),
      ...(modelOptions?.provider !== undefined && {
        provider: modelOptions.provider as OpenResponsesRequest['provider'],
      }),
      ...(modelOptions?.models !== undefined && {
        models: modelOptions.models,
      }),
      ...(modelOptions?.transforms !== undefined && {
        transforms: modelOptions.transforms,
      }),
      ...(modelOptions?.plugins !== undefined && {
        plugins: modelOptions.plugins as OpenResponsesRequest['plugins'],
      }),
      ...(modelOptions?.route !== undefined && {
        route: modelOptions.route,
      }),
    };

    // Make the non-streaming request using Responses API
    const combinedHeaders = normalizeHeaders(
      combineHeaders(this.settings.headers, options.headers),
    );

    const response = (await client.beta.responses.send(requestParams, {
      fetchOptions: {
        signal: options.abortSignal,
        headers: combinedHeaders,
      },
    })) as OpenResponsesNonStreamingResponse;

    // Build content array from Responses API output
    const content: LanguageModelV3Content[] = [];

    // Extract reasoning details for multi-turn conversation support
    // These must be preserved and sent back in subsequent turns for reasoning models
    const reasoningDetails = extractReasoningDetails(response);
    const reasoningMetadata = buildReasoningProviderMetadata(reasoningDetails);

    // Process output items
    for (const outputItem of response.output) {
      if (outputItem.type === 'reasoning') {
        // Extract reasoning text from content array or summary
        const reasoningItem = outputItem as ReasoningOutputItem;
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
          // Attach reasoning_details to the reasoning part for multi-turn support
          content.push({
            type: 'reasoning',
            text: reasoningText,
            ...(reasoningMetadata && { providerMetadata: reasoningMetadata }),
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
          arguments?: string;
        };
        // Attach reasoning_details to tool-call parts for multi-turn support
        // This is critical for Gemini 3 with thoughtSignature
        content.push({
          type: 'tool-call',
          toolCallId: functionCallItem.callId,
          toolName: functionCallItem.name,
          // Default to empty object when arguments is undefined/empty
          // (some providers omit arguments for tools with no parameters)
          input: functionCallItem.arguments || '{}',
          ...(reasoningMetadata && { providerMetadata: reasoningMetadata }),
        });
      }
    }

    // Use outputText as fallback if no text content was extracted
    if (response.outputText && !content.some((c) => c.type === 'text')) {
      content.push({
        type: 'text',
        text: response.outputText,
      });
    }

    // Build finish reason based on response status
    let finishReason = mapOpenRouterFinishReason(
      response.status === 'completed' ? 'stop' : (response.status ?? 'stop'),
    );

    // Gemini 3 thoughtSignature fix: when there are tool calls with encrypted
    // reasoning, the model returns 'completed' but expects continuation.
    // Override to 'tool-calls' so the AI SDK knows to continue the conversation.
    const hasToolCalls = content.some((c) => c.type === 'tool-call');
    if (
      hasToolCalls &&
      hasEncryptedReasoning(reasoningDetails) &&
      finishReason.unified === 'stop'
    ) {
      finishReason = { unified: 'tool-calls', raw: finishReason.raw };
    }

    // Build usage from Responses API format
    const usage = buildUsage(
      response.usage
        ? {
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
          }
        : undefined,
    );

    // Build provider metadata
    // Note: The Responses API doesn't include 'provider' field directly
    // Map Responses API field names to Chat Completions API names
    const providerMetadata = buildProviderMetadata({
      id: response.id,
      provider: undefined, // Responses API doesn't expose provider in response
      usage: response.usage
        ? {
            promptTokens: response.usage.inputTokens,
            completionTokens: response.usage.outputTokens,
            totalTokens: response.usage.totalTokens,
            cost: response.usage.cost ?? undefined,
            // Map inputTokensDetails -> promptTokensDetails
            promptTokensDetails: response.usage.inputTokensDetails
              ? {
                  cachedTokens: response.usage.inputTokensDetails.cachedTokens,
                }
              : undefined,
            // Map outputTokensDetails -> completionTokensDetails
            completionTokensDetails: response.usage.outputTokensDetails
              ? {
                  reasoningTokens:
                    response.usage.outputTokensDetails.reasoningTokens,
                }
              : undefined,
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
    options: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3StreamResult> {
    const warnings: SharedV3Warning[] = [];

    // Create OpenRouter client
    const client = new OpenRouter({
      apiKey: this.settings.apiKey,
      serverURL: this.settings.baseURL,
      userAgent: this.settings.userAgent,
    });

    // Convert messages to OpenRouter Responses API format
    const openRouterInput = convertToOpenRouterMessages(options.prompt);

    // Convert tools to Responses API format
    const tools = convertToolsToResponsesFormat(options.tools, warnings);

    // Convert toolChoice to Responses API format
    const toolChoice = convertToolChoiceToResponsesFormat(options.toolChoice);

    // Convert responseFormat to Responses API text.format
    const text = convertResponseFormatToText(options.responseFormat);

    // Extract model options from settings
    const modelOptions = this.settings.modelOptions;

    // Build request parameters for Responses API (streaming)
    const requestParams: OpenResponsesRequest & { stream: true } = {
      model: this.modelId,
      input: openRouterInput as OpenResponsesRequest['input'],
      stream: true,
      ...(options.maxOutputTokens !== undefined && {
        maxOutputTokens: options.maxOutputTokens,
      }),
      ...(options.temperature !== undefined && {
        temperature: options.temperature,
      }),
      ...(options.topP !== undefined && { topP: options.topP }),
      ...(tools.length > 0 && { tools }),
      ...(toolChoice !== undefined && { toolChoice }),
      ...(text !== undefined && { text }),
      // Forward model options from settings
      ...(modelOptions?.reasoning !== undefined && {
        reasoning: modelOptions.reasoning as OpenResponsesRequest['reasoning'],
      }),
      ...(modelOptions?.provider !== undefined && {
        provider: modelOptions.provider as OpenResponsesRequest['provider'],
      }),
      ...(modelOptions?.models !== undefined && {
        models: modelOptions.models,
      }),
      ...(modelOptions?.transforms !== undefined && {
        transforms: modelOptions.transforms,
      }),
      ...(modelOptions?.plugins !== undefined && {
        plugins: modelOptions.plugins as OpenResponsesRequest['plugins'],
      }),
      ...(modelOptions?.route !== undefined && {
        route: modelOptions.route,
      }),
    };

    // Make the streaming request using Responses API
    const combinedHeaders = normalizeHeaders(
      combineHeaders(this.settings.headers, options.headers),
    );

    const eventStream = (await client.beta.responses.send(requestParams, {
      fetchOptions: {
        signal: options.abortSignal,
        headers: combinedHeaders,
      },
    })) as EventStream<OpenResponsesStreamEvent>;

    // Track state for stream transformation
    const state = createStreamState();

    // Transform the EventStream to AI SDK V3 stream parts
    const transformedStream = new ReadableStream<LanguageModelV3StreamPart>({
      async start(controller) {
        // Emit stream-start first
        controller.enqueue({
          type: 'stream-start',
          warnings,
        });

        try {
          for await (const event of eventStream) {
            const parts = transformResponsesEvent(event, state);
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

/**
 * Stream state for tracking response metadata and content parts.
 */
interface StreamState {
  responseId: string | undefined;
  responseModel: string | undefined;
  responseCreated: number | undefined;
  textStarted: boolean;
  textId: string;
  reasoningStarted: boolean;
  reasoningId: string;
  textEnded: boolean;
  reasoningEnded: boolean;
  sourceIds: string[];
  toolCalls: Map<string, { name?: string; argumentsStarted: boolean }>;
}

function createStreamState(): StreamState {
  return {
    responseId: undefined,
    responseModel: undefined,
    responseCreated: undefined,
    textStarted: false,
    textId: 'text-0',
    reasoningStarted: false,
    reasoningId: 'reasoning-0',
    textEnded: false,
    reasoningEnded: false,
    sourceIds: [],
    toolCalls: new Map(),
  };
}

/**
 * Transform a Responses API stream event to AI SDK V3 stream parts.
 */
function transformResponsesEvent(
  event: OpenResponsesStreamEvent,
  state: StreamState,
): LanguageModelV3StreamPart[] {
  const parts: LanguageModelV3StreamPart[] = [];

  switch (event.type) {
    // Response lifecycle events
    case 'response.created':
    case 'response.in_progress': {
      // Capture response metadata from initial events
      if (event.response) {
        state.responseId = event.response.id;
        state.responseModel = event.response.model;
        state.responseCreated = event.response.createdAt;
      }
      break;
    }

    // Text streaming
    case 'response.output_text.delta': {
      // Emit text-start if not started
      if (!state.textStarted) {
        state.textStarted = true;
        parts.push({
          type: 'text-start',
          id: state.textId,
        });
      }

      // Emit text-delta
      if (event.delta && event.delta.length > 0) {
        parts.push({
          type: 'text-delta',
          id: state.textId,
          delta: event.delta,
        });
      }
      break;
    }

    case 'response.output_text.done': {
      // End text if started and not ended
      if (state.textStarted && !state.textEnded) {
        state.textEnded = true;
        parts.push({
          type: 'text-end',
          id: state.textId,
        });
      }
      break;
    }

    // Reasoning streaming
    case 'response.reasoning_text.delta': {
      // Emit reasoning-start if not started
      if (!state.reasoningStarted) {
        state.reasoningStarted = true;
        parts.push({
          type: 'reasoning-start',
          id: state.reasoningId,
        });
      }

      // Emit reasoning-delta
      if (event.delta && event.delta.length > 0) {
        parts.push({
          type: 'reasoning-delta',
          id: state.reasoningId,
          delta: event.delta,
        });
      }
      break;
    }

    // Function call arguments streaming
    case 'response.function_call_arguments.delta': {
      const toolCallId = event.itemId;
      let toolState = state.toolCalls.get(toolCallId);

      if (!toolState) {
        toolState = { argumentsStarted: false };
        state.toolCalls.set(toolCallId, toolState);
      }

      // Emit tool-input-start if not started
      if (!toolState.argumentsStarted) {
        toolState.argumentsStarted = true;
        parts.push({
          type: 'tool-input-start',
          id: toolCallId,
          toolName: toolState.name ?? '', // Will be filled in by output_item.added
        });
      }

      // Emit tool-input-delta
      if (event.delta && event.delta.length > 0) {
        parts.push({
          type: 'tool-input-delta',
          id: toolCallId,
          delta: event.delta,
        });
      }
      break;
    }

    case 'response.function_call_arguments.done': {
      const toolCallId = event.itemId;
      const toolState = state.toolCalls.get(toolCallId);

      // If we haven't started tool call yet, emit start + delta with full args
      if (!toolState?.argumentsStarted) {
        parts.push({
          type: 'tool-input-start',
          id: toolCallId,
          toolName: event.name,
        });
        // Default to empty object when arguments is undefined/empty
        const args = event.arguments || '{}';
        parts.push({
          type: 'tool-input-delta',
          id: toolCallId,
          delta: args,
        });
      }

      // Emit tool-input-end
      parts.push({
        type: 'tool-input-end',
        id: toolCallId,
      });

      // Emit tool-call with complete tool call data
      // Default to empty object when arguments is undefined/empty
      // (some providers omit arguments for tools with no parameters)
      parts.push({
        type: 'tool-call',
        toolCallId,
        toolName: event.name,
        input: event.arguments || '{}',
      });
      break;
    }

    // Output item events (for function call metadata)
    case 'response.output_item.added': {
      if (event.item.type === 'function_call') {
        const funcItem = event.item as {
          type: 'function_call';
          callId?: string;
          name: string;
        };
        const toolCallId = funcItem.callId ?? `tool-${event.outputIndex}`;
        const toolState = state.toolCalls.get(toolCallId) ?? {
          argumentsStarted: false,
        };
        toolState.name = funcItem.name;
        state.toolCalls.set(toolCallId, toolState);
      }
      break;
    }

    // Annotation events (web search sources)
    case 'response.output_text.annotation.added': {
      const annotation = event.annotation;
      if (annotation.type === 'url_citation') {
        const urlAnnotation = annotation as {
          type: 'url_citation';
          url: string;
          title: string;
        };
        const sourceId = `source-${state.sourceIds.length}`;
        state.sourceIds.push(sourceId);
        parts.push({
          type: 'source',
          sourceType: 'url',
          id: sourceId,
          url: urlAnnotation.url,
          title: urlAnnotation.title,
        });
      }
      break;
    }

    // Response completed - extract final usage data
    case 'response.completed': {
      // End text if started and not ended
      if (state.textStarted && !state.textEnded) {
        state.textEnded = true;
        parts.push({
          type: 'text-end',
          id: state.textId,
        });
      }

      // End reasoning if started and not ended
      if (state.reasoningStarted && !state.reasoningEnded) {
        state.reasoningEnded = true;
        parts.push({
          type: 'reasoning-end',
          id: state.reasoningId,
        });
      }

      // Emit response-metadata
      const response = event.response;
      parts.push({
        type: 'response-metadata',
        id: response.id,
        timestamp: response.createdAt
          ? new Date(response.createdAt * 1000)
          : undefined,
        modelId: response.model,
      });

      // Build finish reason based on response status
      const finishReason = mapOpenRouterFinishReason(
        response.status === 'completed' ? 'stop' : (response.status ?? 'stop'),
      );

      // Build usage
      const usage = buildUsage(
        response.usage
          ? {
              inputTokens: response.usage.inputTokens,
              outputTokens: response.usage.outputTokens,
            }
          : undefined,
      );

      // Build provider metadata
      // Map Responses API field names to Chat Completions API names
      const providerMetadata = buildProviderMetadata({
        id: response.id,
        provider: undefined, // Responses API doesn't expose provider
        usage: response.usage
          ? {
              promptTokens: response.usage.inputTokens,
              completionTokens: response.usage.outputTokens,
              totalTokens: response.usage.totalTokens,
              cost: response.usage.cost ?? undefined,
              // Map inputTokensDetails -> promptTokensDetails
              promptTokensDetails: response.usage.inputTokensDetails
                ? {
                    cachedTokens:
                      response.usage.inputTokensDetails.cachedTokens,
                  }
                : undefined,
              // Map outputTokensDetails -> completionTokensDetails
              completionTokensDetails: response.usage.outputTokensDetails
                ? {
                    reasoningTokens:
                      response.usage.outputTokensDetails.reasoningTokens,
                  }
                : undefined,
            }
          : undefined,
      });

      parts.push({
        type: 'finish',
        finishReason,
        usage,
        providerMetadata,
      });
      break;
    }

    // Response incomplete or failed
    case 'response.incomplete':
    case 'response.failed': {
      // End any open content parts
      if (state.textStarted && !state.textEnded) {
        state.textEnded = true;
        parts.push({
          type: 'text-end',
          id: state.textId,
        });
      }
      if (state.reasoningStarted && !state.reasoningEnded) {
        state.reasoningEnded = true;
        parts.push({
          type: 'reasoning-end',
          id: state.reasoningId,
        });
      }

      const response = event.response;
      parts.push({
        type: 'response-metadata',
        id: response.id,
        timestamp: response.createdAt
          ? new Date(response.createdAt * 1000)
          : undefined,
        modelId: response.model,
      });

      // Map finish reason
      const finishReason =
        event.type === 'response.failed'
          ? mapOpenRouterFinishReason('error')
          : mapOpenRouterFinishReason(response.status ?? 'incomplete');

      const usage = buildUsage(
        response.usage
          ? {
              inputTokens: response.usage.inputTokens,
              outputTokens: response.usage.outputTokens,
            }
          : undefined,
      );

      const providerMetadata = buildProviderMetadata({
        id: response.id,
        provider: undefined,
        usage: response.usage
          ? {
              promptTokens: response.usage.inputTokens,
              completionTokens: response.usage.outputTokens,
              totalTokens: response.usage.totalTokens,
              cost: response.usage.cost ?? undefined,
              // Map inputTokensDetails -> promptTokensDetails
              promptTokensDetails: response.usage.inputTokensDetails
                ? {
                    cachedTokens:
                      response.usage.inputTokensDetails.cachedTokens,
                  }
                : undefined,
              // Map outputTokensDetails -> completionTokensDetails
              completionTokensDetails: response.usage.outputTokensDetails
                ? {
                    reasoningTokens:
                      response.usage.outputTokensDetails.reasoningTokens,
                  }
                : undefined,
            }
          : undefined,
      });

      parts.push({
        type: 'finish',
        finishReason,
        usage,
        providerMetadata,
      });
      break;
    }

    // Error event
    case 'error': {
      const errorEvent = event as {
        type: 'error';
        error?: { message?: string };
      };
      parts.push({
        type: 'error',
        error: new Error(
          errorEvent.error?.message ?? 'Unknown streaming error',
        ),
      });
      break;
    }

    // Ignored events (handled implicitly or not needed)
    case 'response.output_item.done':
    case 'response.content_part.added':
    case 'response.content_part.done':
    case 'response.refusal.delta':
    case 'response.refusal.done':
    case 'response.reasoning_text.done':
    case 'response.reasoning_summary_part.added':
    case 'response.reasoning_summary_part.done':
    case 'response.reasoning_summary_text.delta':
    case 'response.reasoning_summary_text.done':
    case 'response.image_generation_call.in_progress':
    case 'response.image_generation_call.generating':
    case 'response.image_generation_call.partial_image':
    case 'response.image_generation_call.completed':
      // These events are either handled by other events or not relevant for AI SDK
      break;
  }

  return parts;
}

/**
 * Convert AI SDK tools to OpenRouter Responses API format.
 * Only 'function' type tools are supported.
 */
function convertToolsToResponsesFormat(
  tools: LanguageModelV3CallOptions['tools'],
  warnings: SharedV3Warning[],
): OpenResponsesRequestToolFunction[] {
  if (!tools || tools.length === 0) {
    return [];
  }

  return tools
    .map((tool): OpenResponsesRequestToolFunction | null => {
      if (tool.type !== 'function') {
        warnings.push({
          type: 'unsupported',
          feature: `tool type '${tool.type}'`,
          details: `Only 'function' type tools are supported. Tool '${(tool as { name?: string }).name ?? 'unknown'}' has type '${tool.type}'.`,
        });
        return null;
      }

      const functionTool = tool as LanguageModelV3FunctionTool;
      return {
        type: 'function',
        name: functionTool.name,
        description: functionTool.description ?? null,
        parameters: functionTool.inputSchema as { [k: string]: unknown } | null,
      };
    })
    .filter((tool): tool is OpenResponsesRequestToolFunction => tool !== null);
}

/**
 * Convert AI SDK toolChoice to OpenRouter Responses API format.
 *
 * Mapping:
 * - 'auto' -> 'auto'
 * - 'none' -> 'none'
 * - 'required' -> 'required'
 * - { type: 'tool', toolName } -> { type: 'function', name: toolName }
 */
function convertToolChoiceToResponsesFormat(
  toolChoice: LanguageModelV3ToolChoice | undefined,
): OpenAIResponsesToolChoiceUnion | undefined {
  if (!toolChoice) {
    return undefined;
  }

  switch (toolChoice.type) {
    case 'auto':
      return 'auto';
    case 'none':
      return 'none';
    case 'required':
      return 'required';
    case 'tool':
      return {
        type: 'function',
        name: toolChoice.toolName,
      };
    default:
      return undefined;
  }
}

/**
 * Convert AI SDK responseFormat to OpenRouter Responses API text.format.
 *
 * Mapping:
 * - { type: 'text' } -> { type: 'text' }
 * - { type: 'json' } -> { type: 'json_object' } (no schema)
 * - { type: 'json', schema, name } -> { type: 'json_schema', name, schema } (with schema)
 */
function convertResponseFormatToText(
  responseFormat: LanguageModelV3CallOptions['responseFormat'],
): OpenResponsesRequest['text'] | undefined {
  if (!responseFormat) {
    return undefined;
  }

  if (responseFormat.type === 'text') {
    return {
      format: { type: 'text' },
    };
  }

  if (responseFormat.type === 'json') {
    // If a schema is provided, use json_schema format
    if (responseFormat.schema) {
      return {
        format: {
          type: 'json_schema',
          name: responseFormat.name ?? 'response',
          description: responseFormat.description,
          schema: responseFormat.schema as { [k: string]: unknown },
        },
      };
    }
    // No schema - use simple json_object format
    return {
      format: { type: 'json_object' },
    };
  }

  return undefined;
}
