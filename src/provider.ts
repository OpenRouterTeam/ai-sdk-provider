import type {
  OpenRouterChatModelId,
  OpenRouterChatSettings,
} from './types/openrouter-chat-settings';
import type {
  OpenRouterCompletionModelId,
  OpenRouterCompletionSettings,
} from './types/openrouter-completion-settings';

import { loadApiKey, withoutTrailingSlash } from '@ai-sdk/provider-utils';
import { OpenRouterChatLanguageModel } from './chat';
import { OpenRouterCompletionLanguageModel } from './completion';
import { X402FetchWrapper } from './wallet/x402-fetch-wrapper';
import type { DreamsRouterPaymentConfig, SolanaSigner } from './types';
import type { Account } from 'viem';

export type { OpenRouterCompletionSettings };

export interface DreamsRouterProvider {
  (
    modelId: OpenRouterChatModelId,
    settings?: OpenRouterCompletionSettings
  ): OpenRouterCompletionLanguageModel;
  (
    modelId: OpenRouterChatModelId,
    settings?: OpenRouterChatSettings
  ): OpenRouterChatLanguageModel;

  languageModel(
    modelId: OpenRouterChatModelId,
    settings?: OpenRouterCompletionSettings
  ): OpenRouterCompletionLanguageModel;
  languageModel(
    modelId: OpenRouterChatModelId,
    settings?: OpenRouterChatSettings
  ): OpenRouterChatLanguageModel;

  /**
Creates an OpenRouter chat model for text generation.
   */
  chat(
    modelId: OpenRouterChatModelId,
    settings?: OpenRouterChatSettings
  ): OpenRouterChatLanguageModel;

  /**
Creates an OpenRouter completion model for text generation.
   */
  completion(
    modelId: OpenRouterCompletionModelId,
    settings?: OpenRouterCompletionSettings
  ): OpenRouterCompletionLanguageModel;
}

export interface DreamsRouterProviderSettings {
  /**
Base URL for the OpenRouter API calls.
     */
  baseURL?: string;

  /**
@deprecated Use `baseURL` instead.
     */
  baseUrl?: string;

  /**
  API key for authenticating requests. JWT or API key.
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
   * Payment configuration for x402 payments. When provided, the SDK will automatically
   * generate x402 payment signatures for each request.
   * Note: This is used internally by wallet auth utils. Use createDreamsRouterAuth() for easier setup.
   */
  payment?: DreamsRouterPaymentConfig;

  /**
   * Account for generating x402 payments. Used internally by wallet auth utils.
   */
  signer?: Account;

  /**
   * Solana signer for SOL x402 payments (Node environments only, for now).
   */
  solanaSigner?: SolanaSigner;
}

/**
Create a Dreams router provider instance.
 */
function createDreamsRouterBase(
  options: DreamsRouterProviderSettings = {}
): DreamsRouterProvider {
  const baseURL =
    withoutTrailingSlash(options.baseURL ?? options.baseUrl) ??
    'https://api-beta.daydreams.systems/v1';

  // we default to compatible, because strict breaks providers like Groq:
  const compatibility = options.compatibility ?? 'compatible';

  const getHeaders = () => {
    const headers: Record<string, string> = { ...options.headers };

    // Only add Authorization header if we have an API key
    if (options.apiKey !== undefined) {
      headers.Authorization = `Bearer ${loadApiKey({
        apiKey: options.apiKey,
        environmentVariableName: 'DREAMSROUTER_API_KEY',
        description:
          'Dreams Router. This can be an API key or a session token.',
      })}`;
    }

    return headers;
  };

  // Create x402 fetch wrapper if payment is enabled
  const x402Wrapper = options.payment
    ? new X402FetchWrapper({
        baseFetch: options.fetch,
        payment: options.payment,
        signer: options.signer,
        solanaSigner: options.solanaSigner,
      })
    : null;

  const customFetch = x402Wrapper
    ? (url: string | URL | Request, init?: RequestInit) =>
        x402Wrapper.fetch(url, init)
    : options.fetch;

  const createChatModel = (
    modelId: OpenRouterChatModelId,
    settings: OpenRouterChatSettings = {}
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
    settings: OpenRouterCompletionSettings = {}
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
    settings?: OpenRouterChatSettings | OpenRouterCompletionSettings
  ) => {
    if (new.target) {
      throw new Error(
        'The OpenRouter model function cannot be called with the new keyword.'
      );
    }

    if (modelId === 'openai/gpt-3.5-turbo-instruct') {
      return createCompletionModel(
        modelId,
        settings as OpenRouterCompletionSettings
      );
    }

    return createChatModel(modelId, settings as OpenRouterChatSettings);
  };

  const provider = (
    modelId: OpenRouterChatModelId | OpenRouterCompletionModelId,
    settings?: OpenRouterChatSettings | OpenRouterCompletionSettings
  ) => createLanguageModel(modelId, settings);

  provider.languageModel = createLanguageModel;
  provider.chat = createChatModel;
  provider.completion = createCompletionModel;

  return provider as DreamsRouterProvider;
}

// Namespace pattern implementation
interface CreateDreamsRouterNamespace {
  (): DreamsRouterProvider;
  (options: DreamsRouterProviderSettings): DreamsRouterProvider;

  evm(
    signer: Account,
    options?: Omit<DreamsRouterProviderSettings, 'signer' | 'apiKey'> & {
      network?: 'base' | 'base-sepolia';
      validityDuration?: number;
    }
  ): DreamsRouterProvider;

  solana(
    solanaSigner: SolanaSigner,
    options?: Omit<DreamsRouterProviderSettings, 'solanaSigner' | 'apiKey'> & {
      network?: 'solana' | 'solana-devnet';
      validityDuration?: number;
    }
  ): DreamsRouterProvider;
}

// Create the main function with namespace methods attached
const createDreamsRouterWithNamespace = ((
  options: DreamsRouterProviderSettings = {}
) => {
  return createDreamsRouterBase(options);
}) as CreateDreamsRouterNamespace;

// Attach namespace methods
createDreamsRouterWithNamespace.evm = (
  signer: Account,
  options: Omit<DreamsRouterProviderSettings, 'signer' | 'apiKey'> & {
    network?: 'base' | 'base-sepolia';
    validityDuration?: number;
  } = {}
): DreamsRouterProvider => {
  return createDreamsRouterBase({
    ...options,
    apiKey: undefined, // No API key required
    signer,
    payment: {
      network: options.network || 'base-sepolia',
      validityDuration: options.validityDuration || 600,
      mode: 'lazy',
    },
    headers: {
      ...options.headers,
      // Don't include Authorization header since we're using wallet payments
    },
  });
};

createDreamsRouterWithNamespace.solana = (
  solanaSigner: SolanaSigner,
  options: Omit<DreamsRouterProviderSettings, 'solanaSigner' | 'apiKey'> & {
    network?: 'solana' | 'solana-devnet';
    validityDuration?: number;
  } = {}
): DreamsRouterProvider => {
  return createDreamsRouterBase({
    ...options,
    apiKey: undefined, // No API key required
    solanaSigner,
    payment: {
      network: options.network || 'solana-devnet',
      validityDuration: options.validityDuration || 600,
      mode: 'lazy',
    },
    headers: {
      ...options.headers,
      // Don't include Authorization header since we're using wallet payments
    },
  });
};

// Export the namespace function
export { createDreamsRouterWithNamespace as createDreamsRouter };

/**
Default Dreams router provider instance. It uses 'strict' compatibility mode.
 */
export const dreamsrouter = createDreamsRouterWithNamespace({
  compatibility: 'strict', // strict for Dreams Router API
});
