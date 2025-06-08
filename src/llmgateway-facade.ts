import type {
  LLMGatewayCompletionModelId,
  LLMGatewayCompletionSettings,
} from './llmgateway-completion-settings';
import type { LLMGatewayProviderSettings } from './llmgateway-provider';
import type {
  LLMGatewayChatModelId,
  LLMGatewayChatSettings,
} from './types/llmgateway-chat-settings';

import { loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';

import { LLMGatewayChatLanguageModel } from './llmgateway-chat-language-model';
import { LLMGatewayCompletionLanguageModel } from './llmgateway-completion-language-model';

/**
@deprecated Use `createLLMGateway` instead.
 */
export class LLMGateway {
  /**
Use a different URL prefix for API calls, e.g. to use proxy servers.
The default prefix is `https://api.llmgateway.io/v1`.
   */
  readonly baseURL: string;

  /**
API key that is being send using the `Authorization` header.
It defaults to the `LLMGATEWAY_API_KEY` environment variable.
 */
  readonly apiKey?: string;

  /**
Custom headers to include in the requests.
   */
  readonly headers?: Record<string, string>;

  /**
   * Creates a new LLMGateway provider instance.
   */
  constructor(options: LLMGatewayProviderSettings = {}) {
    this.baseURL =
      withoutTrailingSlash(options.baseURL ?? options.baseURL) ??
      'https://api.llmgateway.io/v1';
    this.apiKey = options.apiKey;
    this.headers = options.headers;
  }

  private get baseConfig() {
    return {
      baseURL: this.baseURL,
      headers: () => ({
        Authorization: `Bearer ${loadApiKey({
          apiKey: this.apiKey,
          environmentVariableName: 'LLMGATEWAY_API_KEY',
          description: 'LLMGateway',
        })}`,
        ...this.headers,
      }),
    };
  }

  chat(modelId: LLMGatewayChatModelId, settings: LLMGatewayChatSettings = {}) {
    return new LLMGatewayChatLanguageModel(modelId, settings, {
      provider: 'llmgateway.chat',
      ...this.baseConfig,
      compatibility: 'strict',
      url: ({ path }) => `${this.baseURL}${path}`,
    });
  }

  completion(
    modelId: LLMGatewayCompletionModelId,
    settings: LLMGatewayCompletionSettings = {},
  ) {
    return new LLMGatewayCompletionLanguageModel(modelId, settings, {
      provider: 'llmgateway.completion',
      ...this.baseConfig,
      compatibility: 'strict',
      url: ({ path }) => `${this.baseURL}${path}`,
    });
  }
}
