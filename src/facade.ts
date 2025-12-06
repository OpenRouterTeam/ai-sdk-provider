import type { OpenRouterProviderSettings } from './provider';
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

import { loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';
import { OpenRouterChatLanguageModel } from './chat';
import { OpenRouterCompletionLanguageModel } from './completion';
import { OpenRouterEmbeddingModel } from './embedding';

/**
@deprecated Use `createOpenRouter` instead.
 */
export class OpenRouter {
  /**
Use a different URL prefix for API calls, e.g. to use proxy servers.
The default prefix is `https://openrouter.ai/api/v1`.
   */
  readonly baseURL: string;

  /**
API key that is being sent using the `Authorization` header.
It defaults to the `OPENROUTER_API_KEY` environment variable.
 */
  readonly apiKey?: string;

  /**
Custom headers to include in the requests.
   */
  readonly headers?: Record<string, string>;

  /**
   * Record of provider slugs to API keys for injecting into provider routing.
   */
  readonly api_keys?: Record<string, string>;

  /**
   * Creates a new OpenRouter provider instance.
   */
  constructor(options: OpenRouterProviderSettings = {}) {
    this.baseURL =
      withoutTrailingSlash(options.baseURL ?? options.baseUrl) ??
      'https://openrouter.ai/api/v1';
    this.apiKey = options.apiKey;
    this.headers = options.headers;
    this.api_keys = options.api_keys;
  }

  private get baseConfig() {
    return {
      baseURL: this.baseURL,
      headers: () => ({
        Authorization: `Bearer ${loadApiKey({
          apiKey: this.apiKey,
          environmentVariableName: 'OPENROUTER_API_KEY',
          description: 'OpenRouter',
        })}`,
        ...this.headers,
        ...(this.api_keys &&
          Object.keys(this.api_keys).length > 0 && {
            'X-Provider-API-Keys': JSON.stringify(this.api_keys),
          }),
      }),
    };
  }

  chat(modelId: OpenRouterChatModelId, settings: OpenRouterChatSettings = {}) {
    return new OpenRouterChatLanguageModel(modelId, settings, {
      provider: 'openrouter.chat',
      ...this.baseConfig,
      compatibility: 'strict',
      url: ({ path }) => `${this.baseURL}${path}`,
    });
  }

  completion(
    modelId: OpenRouterCompletionModelId,
    settings: OpenRouterCompletionSettings = {},
  ) {
    return new OpenRouterCompletionLanguageModel(modelId, settings, {
      provider: 'openrouter.completion',
      ...this.baseConfig,
      compatibility: 'strict',
      url: ({ path }) => `${this.baseURL}${path}`,
    });
  }

  textEmbeddingModel(
    modelId: OpenRouterEmbeddingModelId,
    settings: OpenRouterEmbeddingSettings = {},
  ) {
    return new OpenRouterEmbeddingModel(modelId, settings, {
      provider: 'openrouter.embedding',
      ...this.baseConfig,
      url: ({ path }) => `${this.baseURL}${path}`,
    });
  }

  /**
   * @deprecated Use textEmbeddingModel instead
   */
  embedding(
    modelId: OpenRouterEmbeddingModelId,
    settings: OpenRouterEmbeddingSettings = {},
  ) {
    return this.textEmbeddingModel(modelId, settings);
  }
}
