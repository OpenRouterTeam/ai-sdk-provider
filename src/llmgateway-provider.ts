import type {
  LLMGatewayCompletionModelId,
  LLMGatewayCompletionSettings,
} from './llmgateway-completion-settings';
import type {
  LLMGatewayChatModelId,
  LLMGatewayChatSettings,
} from './types/llmgateway-chat-settings';

import { loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';
import { getEnvVar } from './env-utils';

import { LLMGatewayChatLanguageModel } from './llmgateway-chat-language-model';
import { LLMGatewayCompletionLanguageModel } from './llmgateway-completion-language-model';

export type { LLMGatewayCompletionSettings };

export interface LLMGatewayProvider {
  (
    modelId: LLMGatewayChatModelId,
    settings?: LLMGatewayCompletionSettings,
  ): LLMGatewayCompletionLanguageModel;
  (
    modelId: LLMGatewayChatModelId,
    settings?: LLMGatewayChatSettings,
  ): LLMGatewayChatLanguageModel;

  languageModel(
    modelId: LLMGatewayChatModelId,
    settings?: LLMGatewayCompletionSettings,
  ): LLMGatewayCompletionLanguageModel;
  languageModel(
    modelId: LLMGatewayChatModelId,
    settings?: LLMGatewayChatSettings,
  ): LLMGatewayChatLanguageModel;

  /**
Creates an LLMGateway chat model for text generation.
   */
  chat(
    modelId: LLMGatewayChatModelId,
    settings?: LLMGatewayChatSettings,
  ): LLMGatewayChatLanguageModel;

  /**
Creates an LLMGateway completion model for text generation.
   */
  completion(
    modelId: LLMGatewayCompletionModelId,
    settings?: LLMGatewayCompletionSettings,
  ): LLMGatewayCompletionLanguageModel;
}

export interface LLMGatewayProviderSettings {
  /**
Base URL for the LLMGateway API calls.
     */
  baseURL?: string;

  /**
API key for authenticating requests.
     */
  apiKey?: string;

  /**
Custom headers to include in the requests.
     */
  headers?: Record<string, string>;

  /**
LLMGateway compatibility mode. Should be set to `strict` when using the LLMGateway API,
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
A JSON object to send as the request body to access LLMGateway features & upstream provider features.
  */
  extraBody?: Record<string, unknown>;
}

/**
Create an LLMGateway provider instance.
 */
export function createLLMGateway(
  options: LLMGatewayProviderSettings = {},
): LLMGatewayProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL ?? options.baseURL) ??
    'https://api.llmgateway.io/v1';

  // we default to compatible, because strict breaks providers like Groq:
  const compatibility = options.compatibility ?? 'compatible';

  const getHeaders = () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: options.apiKey ?? getEnvVar('API_KEY'),
      environmentVariableName: 'LLMGATEWAY_API_KEY',
      description: 'LLMGateway',
    })}`,
    ...options.headers,
  });

  const createChatModel = (
    modelId: LLMGatewayChatModelId,
    settings: LLMGatewayChatSettings = {},
  ) =>
    new LLMGatewayChatLanguageModel(modelId, settings, {
      provider: 'llmgateway.chat',
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      compatibility,
      fetch: options.fetch,
      extraBody: options.extraBody,
    });

  const createCompletionModel = (
    modelId: LLMGatewayCompletionModelId,
    settings: LLMGatewayCompletionSettings = {},
  ) =>
    new LLMGatewayCompletionLanguageModel(modelId, settings, {
      provider: 'llmgateway.completion',
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      compatibility,
      fetch: options.fetch,
      extraBody: options.extraBody,
    });

  const createLanguageModel = (
    modelId: LLMGatewayChatModelId | LLMGatewayCompletionModelId,
    settings?: LLMGatewayChatSettings | LLMGatewayCompletionSettings,
  ) => {
    if (new.target) {
      throw new Error(
        'The LLMGateway model function cannot be called with the new keyword.',
      );
    }

    if (modelId === 'openai/gpt-3.5-turbo-instruct') {
      return createCompletionModel(
        modelId,
        settings as LLMGatewayCompletionSettings,
      );
    }

    return createChatModel(modelId, settings as LLMGatewayChatSettings);
  };

  const provider = (
    modelId: LLMGatewayChatModelId | LLMGatewayCompletionModelId,
    settings?: LLMGatewayChatSettings | LLMGatewayCompletionSettings,
  ) => createLanguageModel(modelId, settings);

  provider.languageModel = createLanguageModel;
  provider.chat = createChatModel;
  provider.completion = createCompletionModel;

  return provider as LLMGatewayProvider;
}

/**
Default LLMGateway provider instance. It uses 'strict' compatibility mode.
 */
export const llmgateway = createLLMGateway({
  compatibility: 'strict', // strict for LLMGateway API
});
