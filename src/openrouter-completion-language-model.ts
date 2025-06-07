import type {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider';

import type { ParseResult } from '@ai-sdk/provider-utils';
import type {
  OpenRouterCompletionModelId,
  OpenRouterCompletionSettings,
} from './openrouter-completion-settings';

import { ReasoningDetailArraySchema } from '@/src/schemas/reasoning-details';
import { UnsupportedFunctionalityError } from '@ai-sdk/provider';
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  postJsonToApi,
} from '@ai-sdk/provider-utils';
import { z } from 'zod';

import { convertToOpenRouterCompletionPrompt } from './convert-to-openrouter-completion-prompt';

import { mapOpenRouterFinishReason } from './map-openrouter-finish-reason';
import {
  OpenRouterErrorResponseSchema,
  openrouterFailedResponseHandler,
} from './openrouter-error';

type OpenRouterCompletionConfig = {
  provider: string;
  compatibility: 'strict' | 'compatible';
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

export class OpenRouterCompletionLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = 'V2' as const;
  readonly provider = 'openrouter';
  readonly modelId: OpenRouterCompletionModelId;
  readonly supportedUrls: Record<string, RegExp[]> = {
    'image': [/^data:image\/[a-zA-Z]+;base64,/, /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i],
    'file': [/^data:/, /^https?:\/\/.+$/]
  };
  readonly defaultObjectGenerationMode = undefined;
  readonly settings: OpenRouterCompletionSettings;

  private readonly config: OpenRouterCompletionConfig;

  constructor(
    modelId: OpenRouterCompletionModelId,
    settings: OpenRouterCompletionSettings,
    config: OpenRouterCompletionConfig,
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

    const { prompt: completionPrompt } = convertToOpenRouterCompletionPrompt({
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

      // OpenRouter specific settings:
      include_reasoning: this.settings.includeReasoning,
      reasoning: this.settings.reasoning,

      // extra body:
      ...this.config.extraBody,
      ...this.settings.extraBody,
    };
  }

  async doGenerate(
    options: LanguageModelV2CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV2['doGenerate']>>> {
    const args = this.getArgs(options);

    const { value: response } = await postJsonToApi({
      url: this.config.url({
        path: '/completions',
        modelId: this.modelId,
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: openrouterFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        OpenRouterCompletionChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    if ('error' in response) {
      throw new Error(`${response.error.message}`);
    }

    const choice = response.choices[0];

    if (!choice) {
      throw new Error('No choice in OpenRouter completion response');
    }

    return {
      content: [
        {
          type: 'text',
          text: choice.text ?? '',
        },
      ],
      finishReason: mapOpenRouterFinishReason(choice.finish_reason),
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0),
      },
      warnings: [],
    };
  }

  async doStream(
    options: LanguageModelV2CallOptions,
  ): Promise<Awaited<ReturnType<LanguageModelV2['doStream']>>> {
    const args = this.getArgs(options);

    const { value: response } = await postJsonToApi({
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
      failedResponseHandler: openrouterFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        OpenRouterCompletionChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    let finishReason: any = 'other';
    let usage: any = {
      inputTokens: Number.NaN,
      outputTokens: Number.NaN,
      totalTokens: Number.NaN,
    };
    let responseId: string | undefined;
    let responseModel: string | undefined;

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof OpenRouterCompletionChunkSchema>>,
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
              usage = {
                inputTokens: value.usage.prompt_tokens,
                outputTokens: value.usage.completion_tokens,
                totalTokens: value.usage.prompt_tokens + value.usage.completion_tokens,
              };
            }

            if (value.id) {
              responseId = value.id;
            }
            if (value.model) {
              responseModel = value.model;
            }

            const choice = value.choices[0];

            if (choice?.finish_reason != null) {
              finishReason = mapOpenRouterFinishReason(choice.finish_reason);
            }

            if (choice?.text != null) {
              controller.enqueue({
                type: 'content-delta',
                delta: {
                  type: 'text',
                  text: choice.text,
                },
              });
            }


          },

          flush(controller) {
            controller.enqueue({
              type: 'finish',
              finishReason,
              usage,
              warnings: [],
              response: {
                id: responseId,
                modelId: responseModel,
                headers: {},
              },
            });
          },
        }),
      ),
      warnings: [],
    };
  }
}

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const OpenRouterCompletionChunkSchema = z.union([
  z.object({
    id: z.string().optional(),
    model: z.string().optional(),
    choices: z.array(
      z.object({
        text: z.string(),
        reasoning: z.string().nullish().optional(),
        reasoning_details: ReasoningDetailArraySchema.nullish(),

        finish_reason: z.string().nullish(),
        index: z.number(),
        logprobs: z
          .object({
            tokens: z.array(z.string()),
            token_logprobs: z.array(z.number()),
            top_logprobs: z.array(z.record(z.string(), z.number())).nullable(),
          })
          .nullable()
          .optional(),
      }),
    ),
    usage: z
      .object({
        prompt_tokens: z.number(),
        completion_tokens: z.number(),
      })
      .optional()
      .nullable(),
  }),
  OpenRouterErrorResponseSchema,
]);
