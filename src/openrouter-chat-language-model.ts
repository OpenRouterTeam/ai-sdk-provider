import type {
  JSONValue,
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2Content,
  LanguageModelV2FinishReason,
  LanguageModelV2ResponseMetadata,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider';
import type { CallModelTools } from '@openrouter/sdk/esm/funcs/callModel';
import type { OpenResponsesRequest } from '@openrouter/sdk/esm/models';

import { OpenRouter } from '@openrouter/sdk';
import { buildProviderMetadata } from './build-provider-metadata';
import { convertToResponsesInput } from './convert-to-openrouter-messages';
import { filterDefined } from './utils';

/**
 * Model configuration (internal)
 */
export interface OpenRouterModelConfig {
  provider: string;
  baseURL: string;
  apiKey: string;
  generateId: () => string;
  fetch?: typeof fetch;
}

/**
 * Chat settings supported by the provider.
 * These map directly to OpenRouter request fields and a small set of provider-specific options.
 */
export interface OpenRouterChatSettings {
  /**
   * Optional list of transforms to apply to the response (OpenRouter-specific).
   */
  transforms?: string[];
  /**
   * Ordered list of model IDs that OpenRouter can route through for fallbacks.
   */
  models?: OpenResponsesRequest['models'];
  /**
   * Routing strategy. Currently OpenRouter supports 'fallback' to move down the list when a model fails.
   */
  route?: string;
  /**
   * Optional provider configuration sent to OpenRouter's routing engine.
   */
  provider?: OpenResponsesRequest['provider'];
  /**
   * Enable structured JSON outputs when using `generateObject`.
   */
  structuredOutputs?: boolean;
  /**
   * Enable OpenRouter plugins for moderation, web search, or file parsing.
   */
  plugins?: OpenResponsesRequest['plugins'];
  /**
   * Provider-specific options passed through as-is.
   */
  providerOptions?: {
    openrouter?: Record<string, JSONValue>;
  };
  /**
   * Configure usage tracking in the response.
   */
  usage?: {
    /**
     * Include detailed usage information in the response.
     */
    include?: boolean;
  };
}

// Extract the callModel argument type from the SDK client for type safety
type CallModelArguments = Parameters<OpenRouter['callModel']>[0];
// Extend with Record<string,unknown> to allow provider-specific passthrough options
type ExtendedCallModelArguments = CallModelArguments & Record<string, unknown>;

/**
 * OpenRouter chat language model implementation.
 *
 * This class implements the AI SDK's LanguageModelV2 interface, enabling OpenRouter
 * models to be used with generateText(), streamText(), generateObject(), and other
 * AI SDK functions. It handles the translation between AI SDK's message format and
 * OpenRouter's API format, including support for:
 * - Streaming and non-streaming responses
 * - Tool/function calling
 * - Reasoning/chain-of-thought (Claude thinking, o1 models)
 * - Multimodal input (images, PDFs, documents)
 * - Model routing and fallbacks
 */
export class OpenRouterChatLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly provider: string;
  readonly modelId: string;

  // Use 'tool' mode for structured output because OpenRouter's tool_call support
  // is more reliable across providers than JSON mode. The AI SDK will use tool
  // calls to enforce schema compliance when generating objects.
  readonly defaultObjectGenerationMode = 'tool' as const;

  private readonly settings: OpenRouterChatSettings;
  private readonly config: OpenRouterModelConfig;
  private readonly client: OpenRouter;

  constructor(modelId: string, settings: OpenRouterChatSettings, config: OpenRouterModelConfig) {
    this.provider = config.provider;
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;

    this.client = new OpenRouter({
      apiKey: config.apiKey,
      serverURL: config.baseURL,
    });
  }

  /**
   * URL patterns for multimodal input that OpenRouter can process.
   *
   * OpenRouter proxies file URLs to the underlying model provider, so we support
   * both HTTPS and HTTP URLs (HTTP is useful for local development servers).
   * Data URLs are also supported for inline base64-encoded content.
   *
   * Note: Actual file support depends on the specific model being used.
   * Vision models support images, while document models support PDFs.
   */
  get supportedUrls() {
    return {
      'image/*': [
        /^https:\/\/.+/,
        /^http:\/\/.+/,
        /^data:image\/.+/,
      ],
      'application/pdf': [
        /^https:\/\/.+/,
        /^http:\/\/.+/,
      ],
      'document/*': [
        /^https:\/\/.+/,
        /^http:\/\/.+/,
      ],
    };
  }

  /**
   * Build API request arguments from AI SDK call options.
   *
   * This method handles the translation of AI SDK's normalized options into
   * OpenRouter's API format. Settings are merged in priority order:
   * 1. Base model settings (this.settings)
   * 2. Per-call options (options.*)
   * 3. Provider-specific overrides (providerOptions.openrouter)
   */
  private getArgs(options: LanguageModelV2CallOptions): {
    args: ExtendedCallModelArguments;
    warnings: LanguageModelV2CallWarning[];
  } {
    const warnings: LanguageModelV2CallWarning[] = [];
    const input = convertToResponsesInput(options.prompt);

    const args: ExtendedCallModelArguments = {
      model: this.modelId,
      input,
    };

    // Assign options that are defined at call time (filtering out undefined values)
    Object.assign(
      args,
      filterDefined({
        temperature: options.temperature,
        maxOutputTokens: options.maxOutputTokens,
        topP: options.topP,
        topK: options.topK,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        stop: options.stopSequences?.length ? options.stopSequences : undefined,
        seed: options.seed,
        user: (options.providerOptions?.openrouter as Record<string, unknown>)?.user as
          | string
          | undefined,
      }),
    );

    // Assign settings that are defined in the model configuration.
    Object.assign(
      args,
      filterDefined({
        transforms: this.settings.transforms,
        models: this.settings.models,
        route: this.settings.route,
        provider: this.settings.provider,
        plugins: this.settings.plugins,
        usage: this.settings.usage,
      }),
    );

    // Enable JSON mode when structured outputs are requested.
    // OpenRouter normalizes response_format across providers - json_object tells
    // the model to output valid JSON. Note: not all models support this mode.
    if (this.settings.structuredOutputs || options.responseFormat?.type === 'json') {
      args.response_format = {
        type: 'json_object',
      };
    }

    // Convert AI SDK tool definitions to OpenRouter's function calling format.
    // We only support 'function' type tools - other tool types (like 'code_interpreter')
    // would require provider-specific handling.
    if (options.tools && options.tools.length > 0) {
      const toolDefinitions: CallModelTools = options.tools
        .map((tool) => {
          if (tool.type !== 'function') {
            warnings.push({
              type: 'unsupported-tool',
              tool,
            });
            return null;
          }
          return {
            type: 'function',
            name: tool.name,
            description: tool.description ?? null,
            parameters: tool.inputSchema ?? null,
          };
        })
        .filter(Boolean) as CallModelTools;

      args.tools = toolDefinitions as NonNullable<typeof args.tools>;

      if (options.toolChoice?.type === 'tool') {
        args.toolChoice = {
          type: 'function',
          name: options.toolChoice.toolName,
        };
      } else {
        args.toolChoice = options.toolChoice?.type;
      }
    }

    const providerOptions = {
      ...this.settings.providerOptions?.openrouter,
      ...options.providerOptions?.openrouter,
    };
    if (providerOptions && Object.keys(providerOptions).length > 0) {
      Object.assign(args, providerOptions);
    }

    return {
      args,
      warnings,
    };
  }

  async doGenerate(options: LanguageModelV2CallOptions): Promise<{
    content: Array<LanguageModelV2Content>;
    finishReason: LanguageModelV2FinishReason;
    usage: LanguageModelV2Usage;
    providerMetadata?: SharedV2ProviderMetadata;
    request?: {
      body?: unknown;
    };
    response?: LanguageModelV2ResponseMetadata & {
      headers?: Record<string, string>;
      body?: unknown;
    };
    warnings: Array<LanguageModelV2CallWarning>;
  }> {
    const { args, warnings } = this.getArgs(options);
    const responseWrapper = this.client.callModel(args);

    const [message, fullResponse] = await Promise.all([
      responseWrapper.getMessage(),
      responseWrapper.getResponse(),
    ]);

    const content: LanguageModelV2Content[] = [];

    // Extract reasoning_details from the message to preserve for multi-turn conversations.
    //
    // WHY: Claude and other reasoning models (like o1) return encrypted/signed reasoning
    // content that MUST be sent back verbatim in subsequent turns. Without preserving and
    // re-sending reasoning_details, the model loses context about its previous thought
    // process, breaking extended reasoning chains.
    //
    // The details include: reasoning.text (visible thinking), reasoning.encrypted (opaque
    // continuation data), and reasoning.summary (condensed context for the model).
    let reasoningDetails = (
      message as {
        reasoning_details?: JSONValue[];
      }
    ).reasoning_details;

    // Different providers return reasoning in different response locations.
    // Check fullResponse.output as a fallback for providers that structure it there.
    if (!reasoningDetails || reasoningDetails.length === 0) {
      const extractedDetails: JSONValue[] = [];
      for (const outputItem of fullResponse.output) {
        if ('type' in outputItem && outputItem.type === 'reasoning') {
          const reasoningItem = outputItem as {
            type: string;
            id?: string;
            content?: string;
            summary?: unknown;
            encryptedContent?: string;
            signature?: string | null;
            format?: string | null;
          };
          extractedDetails.push({
            type: 'reasoning',
            id: reasoningItem.id,
            content: reasoningItem.content,
            summary: reasoningItem.summary,
            encryptedContent: reasoningItem.encryptedContent,
            signature: reasoningItem.signature,
            format: reasoningItem.format,
          } as JSONValue);
        }
      }
      if (extractedDetails.length > 0) {
        reasoningDetails = extractedDetails;
      }
    }

    if (message.content) {
      if (typeof message.content === 'string') {
        if (message.content) {
          content.push({
            type: 'text',
            text: message.content,
          });
        }
      } else if (Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === 'text' && part.text) {
            content.push({
              type: 'text',
              text: part.text,
            });
          }
        }
      }
    }

    if (message.reasoning) {
      // Include reasoning_details as providerMetadata on the reasoning part
      // This ensures they are preserved when AI SDK constructs messages for multi-turn
      const reasoningPart: LanguageModelV2Content & {
        providerMetadata?: SharedV2ProviderMetadata;
      } = {
        type: 'reasoning',
        text: message.reasoning,
      };
      if (reasoningDetails && reasoningDetails.length > 0) {
        reasoningPart.providerMetadata = {
          openrouter: {
            reasoning_details: reasoningDetails,
          },
        };
      }
      content.push(reasoningPart);
    }

    if (message.toolCalls) {
      for (const toolCall of message.toolCalls) {
        content.push({
          type: 'tool-call',
          toolCallId: toolCall.id,
          toolName: toolCall.function.name,
          input: toolCall.function.arguments,
        });
      }
    }

    const responseUsage = fullResponse.usage;
    const usage: LanguageModelV2Usage = {
      inputTokens: responseUsage?.inputTokens,
      outputTokens: responseUsage?.outputTokens,
      totalTokens: responseUsage?.totalTokens,
      reasoningTokens: responseUsage?.outputTokensDetails?.reasoningTokens,
      cachedInputTokens: responseUsage?.inputTokensDetails?.cachedTokens,
    };

    // Map OpenRouter's response status to AI SDK's finish reasons:
    // 'completed' means the model stopped naturally, 'incomplete' means max tokens was hit
    let finishReason: LanguageModelV2FinishReason = 'unknown';
    if (fullResponse.status === 'completed') {
      finishReason = 'stop';
    } else if (fullResponse.status === 'incomplete') {
      finishReason = 'length';
    }

    return {
      content,
      usage,
      finishReason,
      warnings,
      request: {
        body: args,
      },
      response: {
        body: fullResponse,
      },
      providerMetadata: buildProviderMetadata({
        modelId: fullResponse.model,
        usage: responseUsage,
        output: fullResponse.output,
        messageReasoningDetails: reasoningDetails,
      }),
    };
  }

  async doStream(options: LanguageModelV2CallOptions): Promise<{
    stream: ReadableStream<LanguageModelV2StreamPart>;
    warnings: LanguageModelV2CallWarning[];
  }> {
    const { args, warnings } = this.getArgs(options);
    const responseWrapper = this.client.callModel(args);

    const generateId = this.config.generateId;

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        let isFirstChunk = true;
        let currentTextId: string | undefined;
        let currentReasoningId: string | undefined;

        try {
          for await (const delta of responseWrapper.getTextStream()) {
            if (isFirstChunk) {
              controller.enqueue({
                type: 'stream-start',
                warnings,
              });
              isFirstChunk = false;
              currentTextId = generateId();
              controller.enqueue({
                type: 'text-start',
                id: currentTextId,
              });
            }
            controller.enqueue({
              type: 'text-delta',
              id: currentTextId!,
              delta,
            });
          }

          for await (const delta of responseWrapper.getReasoningStream()) {
            if (!currentReasoningId) {
              currentReasoningId = generateId();
              controller.enqueue({
                type: 'reasoning-start',
                id: currentReasoningId,
              });
            }
            controller.enqueue({
              type: 'reasoning-delta',
              id: currentReasoningId,
              delta,
            });
          }

          const [toolCalls, fullResponse] = await Promise.all([
            responseWrapper.getToolCalls(),
            responseWrapper.getResponse(),
          ]);

          // Extract reasoning_details from the output items for multi-turn support
          // OpenRouter returns reasoning as separate output items with type 'reasoning'
          // containing id, content, summary, encryptedContent, signature, format fields
          const reasoningDetails: JSONValue[] = [];
          for (const outputItem of fullResponse.output) {
            if ('type' in outputItem && outputItem.type === 'reasoning') {
              // Convert reasoning output item to reasoning_details format
              const reasoningItem = outputItem as {
                type: string;
                id?: string;
                content?: string;
                summary?: unknown;
                encryptedContent?: string;
                signature?: string | null;
                format?: string | null;
              };
              reasoningDetails.push({
                type: 'reasoning',
                id: reasoningItem.id,
                content: reasoningItem.content,
                summary: reasoningItem.summary,
                encryptedContent: reasoningItem.encryptedContent,
                signature: reasoningItem.signature,
                format: reasoningItem.format,
              } as JSONValue);
            }
          }
          for (const toolCall of toolCalls) {
            const toolId = generateId();
            controller.enqueue({
              type: 'tool-input-start',
              id: toolId,
              toolName: toolCall.name,
            });
            controller.enqueue({
              type: 'tool-input-delta',
              id: toolId,
              delta: JSON.stringify(toolCall.arguments),
            });
            controller.enqueue({
              type: 'tool-input-end',
              id: toolId,
            });
            controller.enqueue({
              type: 'tool-call',
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              input: JSON.stringify(toolCall.arguments),
            });
          }

          if (currentTextId) {
            controller.enqueue({
              type: 'text-end',
              id: currentTextId,
            });
          }
          if (currentReasoningId) {
            // Include reasoning_details as providerMetadata on reasoning-end
            // This ensures they are preserved when AI SDK constructs messages for multi-turn
            const reasoningEndPart: LanguageModelV2StreamPart & {
              providerMetadata?: SharedV2ProviderMetadata;
            } = {
              type: 'reasoning-end',
              id: currentReasoningId,
            };
            if (reasoningDetails.length > 0) {
              reasoningEndPart.providerMetadata = {
                openrouter: {
                  reasoning_details: reasoningDetails,
                },
              };
            }
            controller.enqueue(reasoningEndPart);
          }
          const responseUsage = fullResponse.usage;

          // Extract sources from annotations
          for (const outputItem of fullResponse.output) {
            if ('type' in outputItem && outputItem.type === 'message' && 'content' in outputItem) {
              const outputMessage = outputItem as {
                content: Array<{
                  type: string;
                  annotations?: Array<{
                    type: string;
                    url?: string;
                    title?: string;
                  }>;
                }>;
              };
              for (const contentPart of outputMessage.content) {
                if (contentPart.type === 'output_text' && contentPart.annotations) {
                  for (const annotation of contentPart.annotations) {
                    if (annotation.type === 'url_citation' && annotation.url) {
                      controller.enqueue({
                        type: 'source',
                        id: generateId(),
                        sourceType: 'url',
                        url: annotation.url,
                        title: annotation.title || '',
                      });
                    }
                  }
                }
              }
            }
          }

          controller.enqueue({
            type: 'response-metadata',
            id: fullResponse.id,
            modelId: fullResponse.model,
            timestamp: new Date(fullResponse.createdAt * 1000),
          });

          const usage: LanguageModelV2Usage = {
            inputTokens: responseUsage?.inputTokens,
            outputTokens: responseUsage?.outputTokens,
            totalTokens: responseUsage?.totalTokens,
            reasoningTokens: responseUsage?.outputTokensDetails?.reasoningTokens,
            cachedInputTokens: responseUsage?.inputTokensDetails?.cachedTokens,
          };

          // Map OpenRouter's response status to AI SDK's finish reasons
          let finishReason: LanguageModelV2FinishReason = 'unknown';
          if (fullResponse.status === 'completed') {
            finishReason = 'stop';
          } else if (fullResponse.status === 'incomplete') {
            finishReason = 'length';
          }

          controller.enqueue({
            type: 'finish',
            finishReason,
            usage,
            providerMetadata: buildProviderMetadata({
              modelId: fullResponse.model,
              usage: responseUsage,
              output: fullResponse.output,
              messageReasoningDetails: reasoningDetails,
            }),
          });

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return {
      stream,
      warnings,
    };
  }
}
