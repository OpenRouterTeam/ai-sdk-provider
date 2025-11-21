import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2Content,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
} from '@ai-sdk/provider';
import {
  postJsonToApi,
  createJsonResponseHandler,
} from '@ai-sdk/provider-utils';
import type {
  OpenRouterChatSettings,
  OpenRouterModelConfig,
  OpenRouterChatResponse,
  OpenRouterProviderMetadata,
} from './types';
import {
  convertToOpenRouterMessages,
  extractReasoningFromResponse,
} from './convert-to-openrouter-messages';
import { mapOpenRouterFinishReason } from './map-openrouter-finish-reason';
import { OpenRouterStreamTransformer } from './openrouter-stream-transformer';

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

  constructor(
    modelId: string,
    settings: OpenRouterChatSettings,
    config: OpenRouterModelConfig,
  ) {
    this.provider = config.provider;
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  /**
   * Get supported URLs for native file handling
   */
  get supportedUrls() {
    // OpenRouter can handle various image URLs natively
    // Adjust these patterns based on OpenRouter's actual capabilities
    return {
      'image/*': [
        /^https:\/\/.+/,  // Support all HTTPS image URLs
        /^http:\/\/.+/,   // Support HTTP image URLs (will be upgraded)
        /^data:image\/.+/,  // Support data URLs for images
      ],
    };
  }

  /**
   * Prepare the request arguments for OpenRouter API
   */
  private getArgs(options: LanguageModelV2CallOptions): {
    args: Record<string, any>;
    warnings: LanguageModelV2CallWarning[];
  } {
    const warnings: LanguageModelV2CallWarning[] = [];

    // Convert messages to OpenRouter format
    const messages = convertToOpenRouterMessages(options.prompt);

    // Prepare the request body
    const body: Record<string, any> = {
      model: this.modelId,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxOutputTokens,
      top_p: options.topP,
      frequency_penalty: options.frequencyPenalty,
      presence_penalty: options.presencePenalty,
      stop: options.stopSequences,
      seed: options.seed,
      user: this.settings.user,
    };

    // Add OpenRouter-specific parameters
    if (this.settings.transforms) {
      body.transforms = this.settings.transforms;
    }

    if (this.settings.models) {
      body.models = this.settings.models;
    }

    if (this.settings.route) {
      body.route = this.settings.route;
    }

    if (this.settings.provider) {
      body.provider = this.settings.provider;
    }

    // Handle structured outputs
    if (this.settings.structuredOutputs || options.responseFormat?.type === 'json') {
      body.response_format = { type: 'json_object' };
    }

    // Handle tools
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map(tool => {
        if (tool.type !== 'function') {
          warnings.push({
            type: 'unsupported-tool',
            tool,
          } as LanguageModelV2CallWarning);
          return null;
        }

        return {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        };
      }).filter(Boolean);

      // Handle tool choice
      if (options.toolChoice) {
        if (options.toolChoice.type === 'auto') {
          body.tool_choice = 'auto';
        } else if (options.toolChoice.type === 'none') {
          body.tool_choice = 'none';
        } else if (options.toolChoice.type === 'required') {
          body.tool_choice = 'required';
        } else if (options.toolChoice.type === 'tool') {
          body.tool_choice = {
            type: 'function',
            function: { name: options.toolChoice.toolName },
          };
        }
      }
    }

    // Merge provider options
    const providerOptions = {
      ...this.settings.providerOptions?.openrouter,
      ...options.providerOptions?.openrouter,
    };

    if (providerOptions) {
      Object.assign(body, providerOptions);
    }

    return { args: body, warnings };
  }

  /**
   * Generate a non-streaming response
   */
  async doGenerate(
    options: LanguageModelV2CallOptions,
  ): Promise<{
    content: Array<LanguageModelV2Content>;
    finishReason: import('@ai-sdk/provider').LanguageModelV2FinishReason;
    usage: LanguageModelV2Usage;
    providerMetadata?: import('@ai-sdk/provider').SharedV2ProviderMetadata;
    request?: { body?: unknown };
    response?: import('@ai-sdk/provider').LanguageModelV2ResponseMetadata & {
      headers?: Record<string, string>;
      body?: unknown;
    };
    warnings: Array<LanguageModelV2CallWarning>;
  }> {
    const { args, warnings } = this.getArgs(options);

    const { value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: this.config.headers(),
      body: args,
      failedResponseHandler: createJsonResponseHandler({} as any),
      successfulResponseHandler: createJsonResponseHandler({} as any),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const openRouterResponse = response as OpenRouterChatResponse;

    // Extract content and reasoning
    const content: LanguageModelV2Content[] = [];
    let reasoningContent: string | undefined;

    if (openRouterResponse.choices?.[0]) {
      const choice = openRouterResponse.choices[0];
      const message = choice.message;

      // Extract reasoning if present
      const { content: textContent, reasoningContent: reasoning } = extractReasoningFromResponse(message);

      // Add text content if present
      if (textContent) {
        content.push({
          type: 'text',
          text: textContent,
        });
      }

      // Store reasoning content for metadata
      reasoningContent = reasoning;

      // Add reasoning as a content type if present
      if (reasoning) {
        content.push({
          type: 'reasoning',
          text: reasoning,
        } as LanguageModelV2Content);
      }

      // Handle tool calls
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          content.push({
            type: 'tool-call',
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
            input: toolCall.function.arguments,
          });
        }
      }
    }

    // Extract reasoning from response-level fields
    if (openRouterResponse.reasoning_details) {
      reasoningContent = openRouterResponse.reasoning_details.content;
      if (!content.find(c => c.type === 'reasoning')) {
        content.push({
          type: 'reasoning',
          text: reasoningContent,
        } as LanguageModelV2Content);
      }
    }

    // Prepare usage information
    const usage: LanguageModelV2Usage = {
      inputTokens: openRouterResponse.usage?.prompt_tokens,
      outputTokens: openRouterResponse.usage?.completion_tokens,
      totalTokens: openRouterResponse.usage?.total_tokens,
      reasoningTokens: openRouterResponse.usage?.reasoning_tokens,
      cachedInputTokens: openRouterResponse.usage?.cached_tokens,
    };

    // Prepare provider metadata
    const providerMetadata: OpenRouterProviderMetadata = {
      openrouter: {
        ...(reasoningContent && {
          reasoning: {
            content: reasoningContent,
            tokens: openRouterResponse.usage?.reasoning_tokens || 0,
          },
        }),
        ...(openRouterResponse.model_id && { model_id: openRouterResponse.model_id }),
        ...(openRouterResponse.provider && { provider: openRouterResponse.provider }),
        ...(openRouterResponse.usage?.cached_tokens && {
          cached_tokens: openRouterResponse.usage.cached_tokens,
        }),
      },
    };

    return {
      content,
      usage,
      finishReason: mapOpenRouterFinishReason(
        openRouterResponse.choices?.[0]?.finish_reason,
      ),
      warnings,
      request: { body: args },
      response: { body: openRouterResponse },
      providerMetadata: providerMetadata as import('@ai-sdk/provider').SharedV2ProviderMetadata,
    };
  }

  /**
   * Generate a streaming response
   */
  async doStream(
    options: LanguageModelV2CallOptions,
  ): Promise<{
    stream: ReadableStream<LanguageModelV2StreamPart>;
    warnings: LanguageModelV2CallWarning[];
  }> {
    const { args, warnings } = this.getArgs(options);

    // Add stream flag
    const streamArgs = { ...args, stream: true };

    const response = await this.config.fetch?.(
      `${this.config.baseURL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          ...this.config.headers(),
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(streamArgs),
        signal: options.abortSignal,
      },
    ) ?? await fetch(
      `${this.config.baseURL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          ...this.config.headers(),
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(streamArgs),
        signal: options.abortSignal,
      },
    );

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body from OpenRouter API');
    }

    // Create and apply the stream transformer
    const transformer = new OpenRouterStreamTransformer();
    const stream = response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(transformer.createParser())
      .pipeThrough(transformer.createTransformer(warnings));

    return { stream, warnings };
  }
}