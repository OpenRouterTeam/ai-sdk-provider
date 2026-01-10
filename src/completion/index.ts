import type { z } from 'zod/v4';
import type { LLMGatewayChatModelId } from '@/src/types/llmgateway-chat-settings';
import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2FinishReason,
  LanguageModelV2StreamPart,
  LanguageModelV2Usage,
} from '@ai-sdk/provider';
import type { ParseResult } from '@ai-sdk/provider-utils';
import type { LLMGatewayUsageAccounting } from '../types';
import type { LLMGatewayCompletionSettings } from '../types/llmgateway-completion-settings';

import { UnsupportedFunctionalityError } from '@ai-sdk/provider';
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  generateId,
  postJsonToApi,
} from '@ai-sdk/provider-utils';

import { llmgatewayFailedResponseHandler } from '../schemas/error-response';
import { mapLLMGatewayFinishReason } from '../utils/map-finish-reason';
import { convertToLLMGatewayCompletionPrompt } from './convert-to-llmgateway-completion-prompt';
import { LLMGatewayCompletionChunkSchema } from './schemas';

type LLMGatewayCompletionConfig = {
  provider: string;
  compatibility: 'strict' | 'compatible';
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

export class LLMGatewayCompletionLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'v2' as const;
  readonly provider = 'llmgateway';
  readonly modelId: LLMGatewayChatModelId;
  readonly supportedUrls: Record<string, RegExp[]> = {
    'image/*': [
      /^data:image\/[a-zA-Z]+;base64,/,
      /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i,
    ],
    'text/*': [/^data:text\//, /^https?:\/\/.+$/],
    'application/*': [/^data:application\//, /^https?:\/\/.+$/],
  };
  readonly defaultObjectGenerationMode = undefined;
  readonly settings: LLMGatewayCompletionSettings;

  private readonly config: LLMGatewayCompletionConfig;

  constructor(
    modelId: LLMGatewayChatModelId,
    settings: LLMGatewayCompletionSettings,
    config: LLMGatewayCompletionConfig,
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
    responseFormat,
    topK,
    stopSequences,
    tools,
    toolChoice,
  }: LanguageModelV2CallOptions) {
    const { prompt: completionPrompt } = convertToLLMGatewayCompletionPrompt({
      prompt,
      inputFormat: 'prompt',
    });

    if (tools?.length) {
      throw new UnsupportedFunctionalityError({
        functionality: 'tools',
      });
    }

    if (toolChoice) {
      throw new UnsupportedFunctionalityError({
        functionality: 'toolChoice',
      });
    }

    return {
      // model id:
      model: this.modelId,
      models: this.settings.models,

      // model specific settings:
      logit_bias: this.settings.logitBias,
      logprobs:
        typeof this.settings.logprobs === 'number'
          ? this.settings.logprobs
          : typeof this.settings.logprobs === 'boolean'
            ? this.settings.logprobs
              ? 0
              : undefined
            : undefined,
      suffix: this.settings.suffix,
      user: this.settings.user,

      // standardized settings:
      max_tokens: maxOutputTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      seed,

      stop: stopSequences,
      response_format: responseFormat,
      top_k: topK,

      // prompt:
      prompt: completionPrompt,

      // LLMGateway specific settings:
      include_reasoning: this.settings.includeReasoning,
      reasoningText: this.settings.reasoningText,

      // extra body:
      ...this.config.extraBody,
      ...this.settings.extraBody,
    };
  }

  async doGenerate(
    options: LanguageModelV2CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV2['doGenerate']>>> {
    const providerOptions = options.providerOptions || {};
    const llmgatewayOptions = providerOptions.llmgateway || {};

    const args = {
      ...this.getArgs(options),
      ...llmgatewayOptions,
    };

    const { value: response, responseHeaders } = await postJsonToApi({
      url: this.config.url({
        path: '/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: llmgatewayFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        LLMGatewayCompletionChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    if ('error' in response) {
      throw new Error(`${response.error.message}`);
    }

    const choice = response.choices[0];

    if (!choice) {
      throw new Error('No choice in LLMGateway completion response');
    }

    return {
      content: [
        {
          type: 'text',
          text: choice.text ?? '',
        },
      ],
      finishReason: mapLLMGatewayFinishReason(choice.finish_reason),
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        totalTokens:
          (response.usage?.prompt_tokens ?? 0) +
          (response.usage?.completion_tokens ?? 0),
        reasoningTokens:
          response.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
        cachedInputTokens:
          response.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      },
      warnings: [],
      response: {
        headers: responseHeaders,
      },
    };
  }

  async doStream(
    options: LanguageModelV2CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV2['doStream']>>> {
    const providerOptions = options.providerOptions || {};
    const llmgatewayOptions = providerOptions.llmgateway || {};

    const args = {
      ...this.getArgs(options),
      ...llmgatewayOptions,
    };

    const { value: response, responseHeaders } = await postJsonToApi({
      url: this.config.url({
        path: '/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: {
        ...args,
        stream: true,

        // only include stream_options when in strict compatibility mode:
        stream_options:
          this.config.compatibility === 'strict'
            ? { include_usage: true }
            : undefined,
      },
      failedResponseHandler: llmgatewayFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        LLMGatewayCompletionChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let finishReason: LanguageModelV2FinishReason = 'other';
    const usage: LanguageModelV2Usage = {
      inputTokens: Number.NaN,
      outputTokens: Number.NaN,
      totalTokens: Number.NaN,
      reasoningTokens: Number.NaN,
      cachedInputTokens: Number.NaN,
    };

    const llmgatewayUsage: Partial<LLMGatewayUsageAccounting> = {};
    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof LLMGatewayCompletionChunkSchema>>,
          LanguageModelV2StreamPart
        >({
          transform(chunk, controller) {
            // handle failed chunk parsing / validation:
            if (!chunk.success) {
              finishReason = 'error';
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            const value = chunk.value;

            // handle error chunks:
            if ('error' in value) {
              finishReason = 'error';
              controller.enqueue({ type: 'error', error: value.error });
              return;
            }

            if (value.usage != null) {
              usage.inputTokens = value.usage.prompt_tokens;
              usage.outputTokens = value.usage.completion_tokens;
              usage.totalTokens =
                value.usage.prompt_tokens + value.usage.completion_tokens;

              // Collect LLMGateway specific usage information
              llmgatewayUsage.promptTokens = value.usage.prompt_tokens;

              if (value.usage.prompt_tokens_details) {
                const cachedInputTokens =
                  value.usage.prompt_tokens_details.cached_tokens ?? 0;

                usage.cachedInputTokens = cachedInputTokens;
                llmgatewayUsage.promptTokensDetails = {
                  cachedTokens: cachedInputTokens,
                };
              }

              llmgatewayUsage.completionTokens = value.usage.completion_tokens;
              if (value.usage.completion_tokens_details) {
                const reasoningTokens =
                  value.usage.completion_tokens_details.reasoning_tokens ?? 0;

                usage.reasoningTokens = reasoningTokens;
                llmgatewayUsage.completionTokensDetails = {
                  reasoningTokens,
                };
              }

              llmgatewayUsage.cost = value.usage.cost;
              llmgatewayUsage.totalTokens = value.usage.total_tokens;
            }

            const choice = value.choices[0];

            if (choice?.finish_reason != null) {
              finishReason = mapLLMGatewayFinishReason(choice.finish_reason);
            }

            if (choice?.text != null) {
              controller.enqueue({
                type: 'text-delta',
                delta: choice.text,
                id: generateId(),
              });
            }
          },

          flush(controller) {
            controller.enqueue({
              type: 'finish',
              finishReason,
              usage,
              providerMetadata: {
                llmgateway: {
                  usage: llmgatewayUsage,
                },
              },
            });
          },
        }),
      ),
      response: {
        headers: responseHeaders,
      },
    };
  }
}
