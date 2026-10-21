import { LoadAPIKeyError } from '@ai-sdk/provider';
import { loadApiKey } from '@ai-sdk/provider-utils';
import { VERSION } from '../version';
import { withUserAgentSuffix } from './with-user-agent-suffix';

/**
 * Config shape shared by the chat and completion language models.
 */
export type OpenRouterModelConfig = {
  provider: string;
  compatibility: 'strict' | 'compatible';
  headers: () => Record<string, string | undefined>;
  url: (options: { modelId: string; path: string }) => string;
  fetch?: typeof fetch;
  extraBody?: Record<string, unknown>;
};

/**
 * The structured-clone-safe payload written to durable workflow storage by
 * `WORKFLOW_SERIALIZE` and read back by `WORKFLOW_DESERIALIZE`.
 */
export type SerializedOpenRouterModel<MODEL_ID extends string, SETTINGS> = {
  modelId: MODEL_ID;
  settings: SETTINGS;
  config: {
    provider: string;
    compatibility: 'strict' | 'compatible';
    baseURL: string;
    /** Only the allowlisted, non-secret headers. */
    headers: Record<string, string>;
    extraBody?: Record<string, unknown>;
    /**
     * Set when the original model sent BYOK `api_keys`
     * (`X-Provider-API-Keys`). The keys themselves are never persisted.
     */
    providerApiKeysOmitted?: true;
  };
};

/**
 * Headers that are known to be non-secret and are safe to write to durable
 * workflow storage (lowercase). Every other header is dropped: the API key is
 * re-read from `OPENROUTER_API_KEY` and the user agent is re-applied on
 * restore, while custom headers may carry credentials.
 */
const PERSISTED_HEADERS = new Set(['x-openrouter-title', 'http-referer']);

const PROVIDER_API_KEYS_HEADER = 'x-provider-api-keys';

/**
 * Serializes a chat or completion model for `@ai-sdk/workflow` durable step
 * boundaries without persisting credentials or arbitrary custom headers.
 */
export function serializeOpenRouterModel<MODEL_ID extends string, SETTINGS>({
  modelId,
  settings,
  config,
}: {
  modelId: MODEL_ID;
  settings: SETTINGS;
  config: OpenRouterModelConfig;
}): SerializedOpenRouterModel<MODEL_ID, SETTINGS> {
  const headers: Record<string, string> = {};
  let providerApiKeysOmitted = false;

  for (const [key, value] of Object.entries(config.headers())) {
    const name = key.toLowerCase();
    if (name === PROVIDER_API_KEYS_HEADER) {
      providerApiKeysOmitted = true;
    } else if (PERSISTED_HEADERS.has(name) && value !== undefined) {
      headers[key] = value;
    }
  }

  return {
    modelId,
    settings,
    config: {
      provider: config.provider,
      compatibility: config.compatibility,
      // `url` is a closure, so persist the resolved base URL instead.
      baseURL: config.url({ path: '', modelId }),
      headers,
      ...(config.extraBody !== undefined && { extraBody: config.extraBody }),
      ...(providerApiKeysOmitted && { providerApiKeysOmitted: true }),
    },
  };
}

/**
 * Rebuilds the model config (including the `url` and `headers` closures) from
 * a serialized payload.
 */
export function restoreOpenRouterConfig(
  config: SerializedOpenRouterModel<string, unknown>['config'],
): OpenRouterModelConfig {
  const { baseURL, headers, providerApiKeysOmitted, ...rest } = config;
  return {
    ...rest,
    url: ({ path }) => `${baseURL}${path}`,
    headers: withEnvironmentApiKey(headers, { providerApiKeysOmitted }),
  };
}

/**
 * Builds the headers closure for a restored model. The API key is re-read
 * from `OPENROUTER_API_KEY` at request time and the SDK user agent is
 * re-applied. If the original model used BYOK `api_keys`, requests fail
 * loudly instead of silently falling back to OpenRouter credits.
 */
export function withEnvironmentApiKey(
  headers: Record<string, string> | undefined,
  { providerApiKeysOmitted }: { providerApiKeysOmitted?: boolean } = {},
): () => Record<string, string | undefined> {
  return () => {
    if (providerApiKeysOmitted) {
      throw new LoadAPIKeyError({
        message:
          'OpenRouter model was restored from workflow storage, but it was ' +
          'created with BYOK `api_keys`. Provider API keys are not persisted ' +
          'across workflow boundaries; create the model inside the step ' +
          'instead of passing it as a step argument.',
      });
    }

    let apiKey: string;
    try {
      apiKey = loadApiKey({
        apiKey: undefined,
        environmentVariableName: 'OPENROUTER_API_KEY',
        description: 'OpenRouter',
      });
    } catch (error) {
      if (LoadAPIKeyError.isInstance(error)) {
        throw new LoadAPIKeyError({
          message:
            'OpenRouter model was restored from workflow storage; set ' +
            'OPENROUTER_API_KEY. API keys are not persisted across workflow ' +
            'boundaries.',
        });
      }
      throw error;
    }

    return withUserAgentSuffix(
      { Authorization: `Bearer ${apiKey}`, ...headers },
      `ai-sdk/openrouter/${VERSION}`,
    );
  };
}
