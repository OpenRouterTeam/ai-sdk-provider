// Scenarios: #526 (WORKFLOW_SERIALIZE / WORKFLOW_DESERIALIZE) round-tripped via
// structuredClone and then driven through generateText / streamText.
import { LoadAPIKeyError } from '@ai-sdk/provider';
import {
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
} from '@ai-sdk/provider-utils';
import { generateText, streamText } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenRouterChatLanguageModel } from '../../chat';
import { OpenRouterCompletionLanguageModel } from '../../completion';
import { createOpenRouter } from '../../provider';
import {
  chatChunk,
  chatCompletion,
  createMockFetch,
  jsonResponse,
  sseResponse,
  USAGE,
} from './helpers';

const BASE_URL = 'https://proxy.example.com/api/v1';
const SECRETS = [
  'sk-or-secret-key',
  'custom-secret-value',
  'Basic proxy-secret',
  'sk-ant-byok-secret',
];

function roundTripChat(model: OpenRouterChatLanguageModel) {
  const Ctor = OpenRouterChatLanguageModel as any;
  const payload = structuredClone(Ctor[WORKFLOW_SERIALIZE](model));
  return {
    payload,
    model: Ctor[WORKFLOW_DESERIALIZE](payload) as OpenRouterChatLanguageModel,
  };
}

function roundTripCompletion(model: OpenRouterCompletionLanguageModel) {
  const Ctor = OpenRouterCompletionLanguageModel as any;
  const payload = structuredClone(Ctor[WORKFLOW_SERIALIZE](model));
  return {
    payload,
    model: Ctor[WORKFLOW_DESERIALIZE](
      payload,
    ) as OpenRouterCompletionLanguageModel,
  };
}

let globalMock: ReturnType<typeof createMockFetch>;

beforeEach(() => {
  // Restored models have no custom fetch: they use the global fetch.
  globalMock = createMockFetch((call) =>
    call.url.endsWith('/completions') && !call.url.endsWith('/chat/completions')
      ? call.body?.stream
        ? sseResponse([
            {
              id: 'c',
              choices: [{ text: 'restored', index: 0, finish_reason: 'stop' }],
            },
          ])
        : jsonResponse({
            id: 'c',
            choices: [{ text: 'restored', index: 0, finish_reason: 'stop' }],
            usage: USAGE,
          })
      : call.body?.stream
        ? sseResponse([
            chatChunk({ content: 'restored' }, { finish_reason: 'stop' }),
            chatChunk(null, { noChoices: true, usage: USAGE }),
          ])
        : jsonResponse(chatCompletion({ content: 'restored' })),
  );
  vi.stubGlobal('fetch', globalMock.fetch);
  vi.stubEnv('OPENROUTER_API_KEY', 'env-api-key');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const richProvider = () =>
  createOpenRouter({
    apiKey: 'sk-or-secret-key',
    baseURL: BASE_URL,
    compatibility: 'strict',
    appName: 'Scenario App',
    appUrl: 'https://scenario.example.com',
    extraBody: { transforms: ['middle-out'] },
    headers: {
      'X-Custom-Secret': 'custom-secret-value',
      'Proxy-Authorization': 'Basic proxy-secret',
    },
  });

describe('workflow serde: chat model (#526)', () => {
  it('payload is structured-clone-safe and keeps modelId/settings/baseURL', () => {
    const model = richProvider().chat('anthropic/claude-sonnet-4.5', {
      reasoning: { effort: 'high' },
      provider: { order: ['anthropic'] },
    });
    const { payload, model: restored } = roundTripChat(model);
    expect(payload).toMatchObject({
      modelId: 'anthropic/claude-sonnet-4.5',
      settings: {
        reasoning: { effort: 'high' },
        provider: { order: ['anthropic'] },
      },
      config: {
        provider: 'openrouter.chat',
        compatibility: 'strict',
        baseURL: BASE_URL,
        extraBody: { transforms: ['middle-out'] },
      },
    });
    expect(restored).toBeInstanceOf(OpenRouterChatLanguageModel);
    expect(restored.modelId).toBe('anthropic/claude-sonnet-4.5');
  });

  it('payload contains no secrets', () => {
    const { payload } = roundTripChat(richProvider().chat('openai/gpt-4o'));
    const text = JSON.stringify(payload);
    for (const secret of SECRETS) {
      expect(text).not.toContain(secret);
    }
    expect(text.toLowerCase()).not.toContain('authorization');
  });

  it('restored model uses the env API key, keeps appName/appUrl and drops custom headers', async () => {
    const { model } = roundTripChat(
      richProvider().chat('anthropic/claude-sonnet-4.5', {
        reasoning: { effort: 'low' },
      }),
    );
    const result = await generateText({ model, prompt: 'hi' });
    expect(result.text).toBe('restored');
    const call = globalMock.calls[0];
    expect(call?.url).toBe(`${BASE_URL}/chat/completions`);
    expect(call?.headers.authorization).toBe('Bearer env-api-key');
    expect(call?.headers['x-openrouter-title']).toBe('Scenario App');
    expect(call?.headers['http-referer']).toBe('https://scenario.example.com');
    expect(call?.headers).not.toHaveProperty('x-custom-secret');
    expect(call?.headers).not.toHaveProperty('proxy-authorization');
    expect(call?.body).toMatchObject({
      model: 'anthropic/claude-sonnet-4.5',
      reasoning: { effort: 'low' },
      transforms: ['middle-out'],
    });
  });

  it('restored model re-applies the provider user agent', async () => {
    const { model } = roundTripChat(richProvider().chat('openai/gpt-4o'));
    await model.doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    });
    expect(globalMock.calls[0]?.headers['user-agent']).toContain(
      'ai-sdk/openrouter/',
    );
  });

  it('restored strict-mode model still requests stream usage', async () => {
    const { model } = roundTripChat(richProvider().chat('openai/gpt-4o'));
    const result = streamText({ model, prompt: 'hi' });
    expect(await result.text).toBe('restored');
    expect(globalMock.calls[0]?.body.stream_options).toEqual({
      include_usage: true,
    });
  });

  it('BYOK api_keys: payload omits keys and the restored model fails loudly', async () => {
    const provider = createOpenRouter({
      apiKey: 'sk-or-secret-key',
      api_keys: { anthropic: 'sk-ant-byok-secret' },
    });
    const { payload, model } = roundTripChat(
      provider.chat('anthropic/claude-sonnet-4.5'),
    );
    expect(JSON.stringify(payload)).not.toContain('sk-ant-byok-secret');
    expect(payload.config.providerApiKeysOmitted).toBe(true);
    await expect(
      generateText({ model, prompt: 'hi', maxRetries: 0 }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        LoadAPIKeyError.isInstance(error) &&
        /BYOK/.test((error as Error).message),
    );
    expect(globalMock.calls).toHaveLength(0);
  });

  it('missing OPENROUTER_API_KEY after restore gives a clear error', async () => {
    const { model } = roundTripChat(richProvider().chat('openai/gpt-4o'));
    vi.stubEnv('OPENROUTER_API_KEY', undefined);
    await expect(
      generateText({ model, prompt: 'hi', maxRetries: 0 }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        LoadAPIKeyError.isInstance(error) &&
        /restored from workflow storage/.test((error as Error).message),
    );
    expect(globalMock.calls).toHaveLength(0);
  });

  it('a double round trip is stable', () => {
    const first = roundTripChat(
      richProvider().chat('openai/gpt-4o', { user: 'u' }),
    );
    const second = roundTripChat(first.model);
    expect(second.payload).toEqual(first.payload);
  });
});

describe('workflow serde: completion model (#526)', () => {
  it('round trip keeps settings and works through generateText', async () => {
    const { payload, model } = roundTripCompletion(
      richProvider().completion('openai/gpt-3.5-turbo-instruct', {
        suffix: '!',
      }),
    );
    expect(payload.config.provider).toBe('openrouter.completion');
    expect(JSON.stringify(payload)).not.toContain('sk-or-secret-key');
    expect(model).toBeInstanceOf(OpenRouterCompletionLanguageModel);
    const result = await generateText({ model, prompt: 'hi' });
    expect(result.text).toBe('restored');
    const call = globalMock.calls[0];
    expect(call?.url).toBe(`${BASE_URL}/completions`);
    expect(call?.headers.authorization).toBe('Bearer env-api-key');
    expect(call?.headers['x-openrouter-title']).toBe('Scenario App');
    expect(call?.headers).not.toHaveProperty('x-custom-secret');
    expect(call?.body).toMatchObject({
      suffix: '!',
      transforms: ['middle-out'],
    });
  });

  it('restored completion model streams with text-start/end', async () => {
    const { model } = roundTripCompletion(
      richProvider().completion('openai/gpt-3.5-turbo-instruct'),
    );
    const result = streamText({ model, prompt: 'hi' });
    const types: string[] = [];
    for await (const part of result.fullStream) {
      types.push(part.type);
    }
    expect(types).toContain('text-start');
    expect(types).toContain('text-end');
    expect(await result.text).toBe('restored');
  });

  it('BYOK completion model refuses to run after restore', async () => {
    const provider = createOpenRouter({
      apiKey: 'k',
      api_keys: { openai: 'sk-ant-byok-secret' },
    });
    const { model } = roundTripCompletion(
      provider.completion('openai/gpt-3.5-turbo-instruct'),
    );
    await expect(
      generateText({ model, prompt: 'hi', maxRetries: 0 }),
    ).rejects.toSatisfy((error: unknown) => LoadAPIKeyError.isInstance(error));
  });
});

describe('workflow serde: serializing a model that relies on the env key', () => {
  // KNOWN BUG: WORKFLOW_SERIALIZE calls config.headers(), which loads the API
  // key, so serializing throws when OPENROUTER_API_KEY is not set in the
  // serializing process, even though the key is never persisted.
  // Bug introduced by https://github.com/OpenRouterTeam/ai-sdk-provider/pull/526
  // (fix for #525). Flip to `it` once serialization skips the API key.
  it.fails('KNOWN BUG: serializes without OPENROUTER_API_KEY in the environment', () => {
    vi.stubEnv('OPENROUTER_API_KEY', undefined);
    const provider = createOpenRouter({ appName: 'No Key App' });
    const { payload } = roundTripChat(provider.chat('openai/gpt-4o'));
    expect(payload.config.headers).toEqual({
      'X-OpenRouter-Title': 'No Key App',
    });
  });
});
