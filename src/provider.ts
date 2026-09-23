import type { ProviderV4 } from '@ai-sdk/provider';
import type { ProviderDefinedToolFactory } from '@ai-sdk/provider-utils';
import type { Engine } from './types/openrouter-api-types';
import type {
  OpenRouterChatModelId,
  OpenRouterChatSettings,
} from './types/openrouter-chat-settings';
import type {
  OpenRouterCompletionModelId,
  OpenRouterCompletionSettings,
} from './types/openrouter-completion-settings';
import type {
  OpenRouterEmbeddingModelId,
  OpenRouterEmbeddingSettings,
} from './types/openrouter-embedding-settings';
import type {
  OpenRouterEvaluationModelId,
  OpenRouterEvaluationSettings,
} from './types/openrouter-evaluation-settings';
import type {
  OpenRouterImageModelId,
  OpenRouterImageSettings,
} from './types/openrouter-image-settings';
import type {
  OpenRouterVideoModelId,
  OpenRouterVideoSettings,
} from './types/openrouter-video-settings';

import { LoadSettingError } from '@ai-sdk/provider';
import { loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';
import { OpenRouterChatLanguageModel } from './chat';
import { OpenRouterCompletionLanguageModel } from './completion';
import { OpenRouterEmbeddingModel } from './embedding';
import { OpenRouterEvaluationModel } from './evaluation';
import { OpenRouterImageModel } from './image';
import { webSearch } from './tool/web-search';
import { withUserAgentSuffix } from './utils/with-user-agent-suffix';
import { VERSION } from './version';
import { OpenRouterVideoModel } from './video';

/**
 * Configuration args for the web search provider tool.
 * These are mapped to snake_case in the API request.
 */
type WebSearchToolArgs = {
  /** Maximum number of search results to include */
  maxResults?: number;
  /** Custom search prompt to guide the search query */
  searchPrompt?: string;
  /** Search engine to use: 'auto', 'native', or 'exa' */
  engine?: 'auto' | Engine;
};

export type { OpenRouterChatSettings, OpenRouterCompletionSettings };

export interface OpenRouterProvider extends ProviderV4 {
  (
    modelId: OpenRouterChatModelId,
    settings?: OpenRouterCompletionSettings,
  ): OpenRouterCompletionLanguageModel;
  (
    modelId: OpenRouterChatModelId,
    settings?: OpenRouterChatSettings,
  ): OpenRouterChatLanguageModel;

  languageModel(
    modelId: OpenRouterChatModelId,
    settings?: OpenRouterCompletionSettings,
  ): OpenRouterCompletionLanguageModel;
  languageModel(
    modelId: OpenRouterChatModelId,
    settings?: OpenRouterChatSettings,
  ): OpenRouterChatLanguageModel;

  /**
Creates an OpenRouter chat model for text generation.
   */
  chat(
    modelId: OpenRouterChatModelId,
    settings?: OpenRouterChatSettings,
  ): OpenRouterChatLanguageModel;

  /**
Creates an OpenRouter completion model for text generation.
   */
  completion(
    modelId: OpenRouterCompletionModelId,
    settings?: OpenRouterCompletionSettings,
  ): OpenRouterCompletionLanguageModel;

  /**
Creates an OpenRouter text embedding model. (AI SDK v5)
   */
  textEmbeddingModel(
    modelId: OpenRouterEmbeddingModelId,
    settings?: OpenRouterEmbeddingSettings,
  ): OpenRouterEmbeddingModel;

  /**
Creates an OpenRouter text embedding model. (AI SDK v4 - deprecated, use textEmbeddingModel instead)
@deprecated Use textEmbeddingModel instead
   */
  embedding(
    modelId: OpenRouterEmbeddingModelId,
    settings?: OpenRouterEmbeddingSettings,
  ): OpenRouterEmbeddingModel;

  /**
Creates an OpenRouter image model for image generation.
   */
  imageModel(
    modelId: OpenRouterImageModelId,
    settings?: OpenRouterImageSettings,
  ): OpenRouterImageModel;

  /**
Creates an OpenRouter video model for video generation.
   */
  videoModel(
    modelId: OpenRouterVideoModelId,
    settings?: OpenRouterVideoSettings,
  ): OpenRouterVideoModel;

  /**
Creates an OpenRouter decision model backed by the Decisions API, for use with `experimental_evaluate`.
   */
  decisionModel(
    modelId: OpenRouterEvaluationModelId,
    settings?: OpenRouterEvaluationSettings,
  ): OpenRouterEvaluationModel;

  /**
AI SDK-compatible name for `decisionModel()`. The AI SDK calls this method when resolving string model IDs through a default provider.
   */
  evaluationModel(
    modelId: OpenRouterEvaluationModelId,
    settings?: OpenRouterEvaluationSettings,
  ): OpenRouterEvaluationModel;

  /**
   * Provider-defined tools for OpenRouter server tools.
   */
  readonly tools: {
    /**
     * Creates an OpenRouter web search server tool.
     *
     * @see https://openrouter.ai/docs/guides/features/server-tools/web-search
     */
    webSearch: ProviderDefinedToolFactory<unknown, WebSearchToolArgs>;
  };
}

export interface OpenRouterProviderSettings {
  /**
Base URL for the OpenRouter API calls.
     */
  baseURL?: string;

  /**
@deprecated Use `baseURL` instead.
     */
  baseUrl?: string;

  /**
Base URL for the Decisions API used by `decisionModel()` and `evaluationModel()`. Defaults to
`https://openrouter.ai/api/alpha`; when `baseURL` ends in `/v1` it defaults
to the same URL with `/alpha` in place of `/v1`. Required when `baseURL`
points at a proxy path that does not end in `/v1`.
     */
  decisionsBaseURL?: string;

  /**
API key for authenticating requests.
     */
  apiKey?: string;

  /**
Custom headers to include in the requests.
     */
  headers?: Record<string, string>;

  /**
OpenRouter compatibility mode. Should be set to `strict` when using the OpenRouter API,
and `compatible` when using 3rd party providers. In `compatible` mode, newer
information such as streamOptions are not being sent. Defaults to 'compatible'.
   */
  compatibility?: 'strict' | 'compatible';

  /**
Custom fetch implementation. You can use it as a middleware to intercept requests,
or to provide a custom fetch implementation for e.g. testing.
    */
  fetch?: typeof fetch;

  /**
A JSON object to send as the request body to access OpenRouter features & upstream provider features.
  */
  extraBody?: Record<string, unknown>;

  /**
   * Record of provider slugs to API keys for injecting into provider routing.
   * Maps provider slugs (e.g. "anthropic", "openai") to their respective API keys.
   */
  api_keys?: Record<string, string>;

  /**
   * Your app's display name. Sets the `X-OpenRouter-Title` header on
   * every request for app attribution on the openrouter.ai dashboard.
   */
  appName?: string;

  /**
   * Your app's URL or identifier. Sets the `HTTP-Referer` header on every request,
   * used to identify your app on the openrouter.ai dashboard.
   */
  appUrl?: string;
}

function deriveDecisionsBaseURL(baseURL: string): string | undefined {
  const versionSuffix = '/v1';
  return baseURL.endsWith(versionSuffix)
    ? `${baseURL.slice(0, -versionSuffix.length)}/alpha`
    : undefined;
}

/**
Create an OpenRouter provider instance.
 */
export function createOpenRouter(
  options: OpenRouterProviderSettings = {},
): OpenRouterProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL ?? options.baseUrl) ??
    'https://openrouter.ai/api/v1';

  const decisionsBaseURL =
    withoutTrailingSlash(options.decisionsBaseURL) ??
    deriveDecisionsBaseURL(baseURL);

  // we default to compatible, because strict breaks providers like Groq:
  const compatibility = options.compatibility ?? 'compatible';

  const getHeaders = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: 'OPENROUTER_API_KEY',
          description: 'OpenRouter',
        })}`,
        ...(options.appName && { 'X-OpenRouter-Title': options.appName }),
        ...(options.appUrl && { 'HTTP-Referer': options.appUrl }),
        ...options.headers,
        ...(options.api_keys &&
          Object.keys(options.api_keys).length > 0 && {
            'X-Provider-API-Keys': JSON.stringify(options.api_keys),
          }),
      },
      `ai-sdk/openrouter/${VERSION}`,
    );

  const createChatModel = (
    modelId: OpenRouterChatModelId,
    settings: OpenRouterChatSettings = {},
  ) =>
    new OpenRouterChatLanguageModel(modelId, settings, {
      provider: 'openrouter.chat',
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      compatibility,
      fetch: options.fetch,
      extraBody: options.extraBody,
    });

  const createCompletionModel = (
    modelId: OpenRouterCompletionModelId,
    settings: OpenRouterCompletionSettings = {},
  ) =>
    new OpenRouterCompletionLanguageModel(modelId, settings, {
      provider: 'openrouter.completion',
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      compatibility,
      fetch: options.fetch,
      extraBody: options.extraBody,
    });

  const createEmbeddingModel = (
    modelId: OpenRouterEmbeddingModelId,
    settings: OpenRouterEmbeddingSettings = {},
  ) =>
    new OpenRouterEmbeddingModel(modelId, settings, {
      provider: 'openrouter.embedding',
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      extraBody: options.extraBody,
    });

  const createEvaluationModel = (
    modelId: OpenRouterEvaluationModelId,
    settings: OpenRouterEvaluationSettings = {},
  ) => {
    if (decisionsBaseURL == null) {
      throw new LoadSettingError({
        message: `Cannot derive the Decisions API URL from baseURL "${baseURL}" because it does not end in "/v1". Set \`decisionsBaseURL\` in createOpenRouter() to use decisionModel().`,
      });
    }
    return new OpenRouterEvaluationModel(modelId, settings, {
      url: ({ path }) => `${decisionsBaseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      extraBody: options.extraBody,
    });
  };

  const createImageModel = (
    modelId: OpenRouterImageModelId,
    settings: OpenRouterImageSettings = {},
  ) =>
    new OpenRouterImageModel(modelId, settings, {
      provider: 'openrouter.image',
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      extraBody: options.extraBody,
    });

  const createVideoModel = (
    modelId: OpenRouterVideoModelId,
    settings: OpenRouterVideoSettings = {},
  ) =>
    new OpenRouterVideoModel(modelId, settings, {
      provider: 'openrouter.video',
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      fetch: options.fetch,
      extraBody: options.extraBody,
    });

  const createLanguageModel = (
    modelId: OpenRouterChatModelId | OpenRouterCompletionModelId,
    settings?: OpenRouterChatSettings | OpenRouterCompletionSettings,
  ) => {
    if (new.target) {
      throw new Error(
        'The OpenRouter model function cannot be called with the new keyword.',
      );
    }

    if (modelId === 'openai/gpt-3.5-turbo-instruct') {
      return createCompletionModel(
        modelId,
        settings as OpenRouterCompletionSettings,
      );
    }

    return createChatModel(modelId, settings as OpenRouterChatSettings);
  };

  const provider = (
    modelId: OpenRouterChatModelId | OpenRouterCompletionModelId,
    settings?: OpenRouterChatSettings | OpenRouterCompletionSettings,
  ) => createLanguageModel(modelId, settings);

  provider.specificationVersion = 'v4';
  provider.languageModel = createLanguageModel;
  provider.chat = createChatModel;
  provider.completion = createCompletionModel;
  provider.textEmbeddingModel = createEmbeddingModel;
  provider.embedding = createEmbeddingModel; // deprecated alias for v4 compatibility
  provider.imageModel = createImageModel;
  provider.videoModel = createVideoModel;
  provider.decisionModel = createEvaluationModel;
  provider.evaluationModel = createEvaluationModel;
  provider.tools = {
    webSearch: webSearch,
  };

  return provider as OpenRouterProvider;
}

/**
Default OpenRouter provider instance. It uses 'strict' compatibility mode.
 */
export const openrouter = createOpenRouter({
  compatibility: 'strict', // strict for OpenRouter API
});
