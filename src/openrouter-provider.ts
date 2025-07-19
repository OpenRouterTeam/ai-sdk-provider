/**
 * Modified for Dreams Router - forked from OpenRouter AI SDK Provider
 * Original: https://github.com/OpenRouterTeam/ai-sdk-provider
 */

import type { Account } from 'viem';
import type {
  OpenRouterCompletionModelId,
  OpenRouterCompletionSettings,
} from './openrouter-completion-settings';
import type { DreamsRouterPaymentConfig } from './types';
import type {
  OpenRouterChatModelId,
  OpenRouterChatSettings,
} from './types/openrouter-chat-settings';

import { loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';

import { OpenRouterChatLanguageModel } from './openrouter-chat-language-model';
import { OpenRouterCompletionLanguageModel } from './openrouter-completion-language-model';
import { generateX402Payment } from './x402-payment-utils';

export type { OpenRouterCompletionSettings };

export interface OpenRouterProvider {
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
API key for authenticating requests.
     */
  apiKey?: string;

  /**
   * JWT session token for authenticating requests (alternative to API key).
   * When both apiKey and sessionToken are provided, sessionToken takes precedence.
   */
  sessionToken?: string;

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
   * Payment configuration for x402 payments. When provided, the SDK will automatically
   * generate x402 payment signatures for each request.
   * Note: This is used internally by wallet auth utils. Use createDreamsRouterAuth() for easier setup.
   */
  payment?: DreamsRouterPaymentConfig;

  /**
   * Account for generating x402 payments. Used internally by wallet auth utils.
   */
  signer?: Account;
}

/**
Create a Dreams router provider instance.
 */
export function createDreamsRouter(
  options: OpenRouterProviderSettings = {},
): OpenRouterProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL ?? options.baseUrl) ??
    'https://dev-router.daydreams.systems/v1';

  // we default to compatible, because strict breaks providers like Groq:
  const compatibility = options.compatibility ?? 'compatible';

  const getHeaders = () => {
    // Prefer sessionToken over apiKey if both are provided
    const sessionToken = loadApiKey({
      apiKey: options.sessionToken,
      environmentVariableName: 'DREAMSROUTER_SESSION_TOKEN',
      description: 'Dreams Router',
    });

    if (sessionToken) {
      return {
        Authorization: `Bearer ${sessionToken}`,
        ...options.headers,
      };
    }

    // Fall back to API key
    return {
      Authorization: `Bearer ${loadApiKey({
        apiKey: options.apiKey,
        environmentVariableName: 'DREAMSROUTER_API_KEY',
        description: 'Dreams Router',
      })}`,
      ...options.headers,
    };
  };

  // Create a custom fetch function that automatically includes x402 payments in headers
  const customFetch = options.payment
    ? async (url: string | URL | Request, init?: RequestInit) => {
        let headers: Record<string, string> = {};

        // Copy existing headers if they exist
        if (init?.headers) {
          if (init.headers instanceof Headers) {
            init.headers.forEach((value, key) => {
              headers[key] = value;
            });
          } else if (Array.isArray(init.headers)) {
            for (const [key, value] of init.headers) {
              headers[key] = value;
            }
          } else {
            headers = { ...init.headers } as Record<string, string>;
          }
        }

        // Generate x402 payment if both signer and payment config are provided
        if (options.payment && options.signer) {
          try {
            const x402Payment = await generateX402Payment(
              options.signer,
              options.payment,
            );
            if (x402Payment) {
              headers['x-payment'] = x402Payment;
            }
          } catch (error) {
            console.error('Failed to generate x402 payment:', error);
            // Continue without payment - let server handle the error
          }
        }

        const newInit = {
          ...init,
          headers,
        };

        return (options.fetch || fetch)(url, newInit);
      }
    : options.fetch;

  const createChatModel = (
    modelId: OpenRouterChatModelId,
    settings: OpenRouterChatSettings = {},
  ) =>
    new OpenRouterChatLanguageModel(modelId, settings, {
      provider: 'openrouter.chat',
      url: ({ path }) => `${baseURL}${path}`,
      headers: getHeaders,
      compatibility,
      fetch: customFetch,
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
      fetch: customFetch,
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

  provider.languageModel = createLanguageModel;
  provider.chat = createChatModel;
  provider.completion = createCompletionModel;

  return provider as OpenRouterProvider;
}

/**
Default Dreams router provider instance. It uses 'strict' compatibility mode.
 */
export const dreamsrouter = createDreamsRouter({
  compatibility: 'strict', // strict for Dreams Router API
});
