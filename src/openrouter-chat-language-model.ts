import type {
  JSONValue,
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2Content,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
  SharedV2ProviderMetadata,
} from '@ai-sdk/provider';
import type { OpenResponsesRequest, OpenResponsesUsage } from '@openrouter/sdk/esm/models';

import { OpenRouter } from '@openrouter/sdk';
import { convertToResponsesInput } from './convert-to-openrouter-messages';

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
   * Associate calls with an end-user identifier.
   */
  user?: OpenResponsesRequest['user'];
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

type CallModelArguments = Parameters<OpenRouter['callModel']>[0];
type ExtendedCallModelArguments = CallModelArguments & Record<string, unknown>;

/**
 * OpenRouter chat language model implementation
 */
export class OpenRouterChatLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly provider: string;
  readonly modelId: string;
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

    if (options.temperature !== undefined) {
      args.temperature = options.temperature;
    }
    if (options.maxOutputTokens !== undefined) {
      args.maxOutputTokens = options.maxOutputTokens;
    }
    if (options.topP !== undefined) {
      args.topP = options.topP;
    }
    if (options.topK !== undefined) {
      args.topK = options.topK;
    }
    if (options.frequencyPenalty !== undefined) {
      args.frequencyPenalty = options.frequencyPenalty;
    }
    if (options.presencePenalty !== undefined) {
      args.presencePenalty = options.presencePenalty;
    }
    if (options.stopSequences?.length) {
      args.stop = options.stopSequences;
    }
    if (options.seed !== undefined) {
      args.seed = options.seed;
    }

    if (this.settings.user) {
      args.user = this.settings.user;
    }
    if (this.settings.transforms) {
      args.transforms = this.settings.transforms;
    }
    if (this.settings.models) {
      args.models = this.settings.models;
    }
    if (this.settings.route) {
      args.route = this.settings.route;
    }
    if (this.settings.provider) {
      args.provider = this.settings.provider;
    }
    if (this.settings.plugins) {
      args.plugins = this.settings.plugins;
    }
    if (this.settings.usage) {
      args.usage = this.settings.usage;
    }

    if (this.settings.structuredOutputs || options.responseFormat?.type === 'json') {
      args.response_format = {
        type: 'json_object',
      };
    }

    if (options.tools && options.tools.length > 0) {
      const toolDefinitions = options.tools
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
        .filter(Boolean);

      if (toolDefinitions.length > 0) {
        args.tools = toolDefinitions as NonNullable<typeof args.tools>;
      }

      if (options.toolChoice) {
        switch (options.toolChoice.type) {
          case 'auto':
            args.toolChoice = 'auto';
            break;
          case 'none':
            args.toolChoice = 'none';
            break;
          case 'required':
            args.toolChoice = 'required';
            break;
          case 'tool':
            args.toolChoice = {
              type: 'function',
              name: options.toolChoice.toolName,
            };
            break;
        }
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
    finishReason: import('@ai-sdk/provider').LanguageModelV2FinishReason;
    usage: LanguageModelV2Usage;
    providerMetadata?: import('@ai-sdk/provider').SharedV2ProviderMetadata;
    request?: {
      body?: unknown;
    };
    response?: import('@ai-sdk/provider').LanguageModelV2ResponseMetadata & {
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

    // Extract reasoning_details from the message to preserve for multi-turn conversations
    // This includes both reasoning.text and reasoning.encrypted items that must be sent back
    let reasoningDetails = (
      message as {
        reasoning_details?: JSONValue[];
      }
    ).reasoning_details;

    // Also check fullResponse.output for reasoning items (some providers return it here)
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

    let finishReason: import('@ai-sdk/provider').LanguageModelV2FinishReason = 'unknown';
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
      providerMetadata: buildProviderMetadata(
        fullResponse.model,
        responseUsage,
        fullResponse.output,
        reasoningDetails,
      ),
    };
  }

  async doStream(options: LanguageModelV2CallOptions): Promise<{
    stream: ReadableStream<LanguageModelV2StreamPart>;
    warnings: LanguageModelV2CallWarning[];
  }> {
    const { args, warnings } = this.getArgs(options);
    console.log('Args:', JSON.stringify(args, null, 2));
    const responseWrapper = this.client.callModel(args);

    const generateId = this.config.generateId;

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      async start(controller) {
        let isFirstChunk = true;
        let currentTextId: string | undefined;
        let currentReasoningId: string | undefined;
        let _accumulatedReasoningText = '';

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
            _accumulatedReasoningText += delta;
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

          let finishReason: import('@ai-sdk/provider').LanguageModelV2FinishReason = 'unknown';
          if (fullResponse.status === 'completed') {
            finishReason = 'stop';
          } else if (fullResponse.status === 'incomplete') {
            finishReason = 'length';
          }

          controller.enqueue({
            type: 'finish',
            finishReason,
            usage,
            providerMetadata: buildProviderMetadata(
              fullResponse.model,
              responseUsage,
              fullResponse.output,
              reasoningDetails,
            ),
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

function buildProviderMetadata(
  modelId: string | undefined,
  usage?: OpenResponsesUsage,
  output?: unknown[],
  messageReasoningDetails?: JSONValue[],
): SharedV2ProviderMetadata {
  const providerRecord: Record<string, JSONValue> = {
    provider: modelId?.split('/')[0] || 'unknown',
  };

  if (modelId) {
    providerRecord.model_id = modelId;
  }

  const usageMetadata = buildUsageMetadata(usage);
  if (usageMetadata) {
    providerRecord.usage = usageMetadata;
  }

  // Include reasoning_details from the message for multi-turn support
  // First try the message's reasoning_details, then fallback to output items
  if (messageReasoningDetails && messageReasoningDetails.length > 0) {
    providerRecord.reasoning_details = messageReasoningDetails;
  } else if (output) {
    // Fallback: extract reasoning_details from output message
    for (const item of output) {
      if (
        typeof item === 'object' &&
        item !== null &&
        'type' in item &&
        (
          item as {
            type: string;
          }
        ).type === 'message'
      ) {
        const msg = item as {
          reasoning_details?: JSONValue[];
        };
        if (
          msg.reasoning_details &&
          Array.isArray(msg.reasoning_details) &&
          msg.reasoning_details.length > 0
        ) {
          providerRecord.reasoning_details = msg.reasoning_details;
          break;
        }
      }
    }
  }

  return {
    openrouter: providerRecord,
  };
}

function buildUsageMetadata(usage?: OpenResponsesUsage): Record<string, JSONValue> | undefined {
  if (!usage) {
    return undefined;
  }

  const metadata: Record<string, JSONValue> = {
    promptTokens: usage.inputTokens,
    completionTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  };

  if (usage.inputTokensDetails) {
    metadata.promptTokensDetails = usage.inputTokensDetails;
  }

  if (usage.outputTokensDetails) {
    metadata.completionTokensDetails = usage.outputTokensDetails;
  }

  if (usage.cost !== undefined && usage.cost !== null) {
    metadata.cost = usage.cost;
  }

  if (usage.isByok !== undefined) {
    metadata.isByok = usage.isByok;
  }

  if (usage.costDetails) {
    metadata.costDetails = pruneUndefined(usage.costDetails);
  }

  return metadata;
}

function pruneUndefined(value: Record<string, unknown>): Record<string, JSONValue> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Record<string, JSONValue>;
}
