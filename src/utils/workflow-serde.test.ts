/**
 * Regression test for GitHub issue #525
 * https://github.com/OpenRouterTeam/ai-sdk-provider/issues/525
 *
 * Reported error: WorkflowRuntimeError: Failed to serialize step arguments at
 * path ".args[1]".
 *
 * `@ai-sdk/workflow`'s `WorkflowAgent` runs each model call as a durable step
 * and serializes the model as a step argument. First-party providers implement
 * the `WORKFLOW_SERIALIZE` / `WORKFLOW_DESERIALIZE` hooks so their models
 * round-trip across the durable (e.g. world-postgres) boundary. This test
 * verifies the OpenRouter model classes implement the same contract: the
 * serialized payload is structured-clone-safe (no closures), contains no
 * secrets, and the model reconstructs with its `modelId`, `settings`, and
 * resolved config intact.
 */
import {
  WORKFLOW_DESERIALIZE,
  WORKFLOW_SERIALIZE,
} from '@ai-sdk/provider-utils';
import { createTestServer } from '@ai-sdk/test-server';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { OpenRouterChatLanguageModel } from '../chat';
import { OpenRouterCompletionLanguageModel } from '../completion';
import { createOpenRouter } from '../provider';
import { VERSION } from '../version';

const CUSTOM_BASE_URL = 'https://custom.example.com/api/v1';

const provider = createOpenRouter({ apiKey: 'test-api-key' });

const customProvider = createOpenRouter({
  apiKey: 'test-api-key',
  baseURL: CUSTOM_BASE_URL,
  appName: 'My App',
  appUrl: 'https://myapp.example.com',
  headers: {
    'X-Custom-Secret': 'custom-secret-value',
    'Proxy-Authorization': 'Basic proxy-secret',
    'User-Agent': 'frozen-agent/0.0.0',
  },
});

const byokProvider = createOpenRouter({
  apiKey: 'test-api-key',
  baseURL: CUSTOM_BASE_URL,
  api_keys: { anthropic: 'test-anthropic-key' },
});

const prompt = [
  { role: 'user' as const, content: [{ type: 'text' as const, text: 'Hi' }] },
];

function roundTripChat(model: OpenRouterChatLanguageModel) {
  return OpenRouterChatLanguageModel[WORKFLOW_DESERIALIZE](
    structuredClone(OpenRouterChatLanguageModel[WORKFLOW_SERIALIZE](model)),
  );
}

function roundTripCompletion(model: OpenRouterCompletionLanguageModel) {
  return OpenRouterCompletionLanguageModel[WORKFLOW_DESERIALIZE](
    structuredClone(
      OpenRouterCompletionLanguageModel[WORKFLOW_SERIALIZE](model),
    ),
  );
}

describe('Issue #525: durable-execution model serialization', () => {
  const server = createTestServer({
    [`${CUSTOM_BASE_URL}/chat/completions`]: {
      response: {
        type: 'json-value',
        body: {
          id: 'chatcmpl-1',
          model: 'anthropic/claude-3.5-sonnet',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hello' },
              finish_reason: 'stop',
            },
          ],
        },
      },
    },
    [`${CUSTOM_BASE_URL}/completions`]: {
      response: {
        type: 'json-value',
        body: {
          id: 'cmpl-1',
          model: 'openai/gpt-3.5-turbo-instruct',
          choices: [{ index: 0, text: 'Hello', finish_reason: 'stop' }],
        },
      },
    },
  });

  beforeAll(() => server.server.start());
  afterEach(() => {
    server.server.reset();
    vi.unstubAllEnvs();
  });
  afterAll(() => server.server.stop());

  describe('OpenRouterChatLanguageModel', () => {
    it('exposes the workflow serde hooks as static methods', () => {
      expect(typeof OpenRouterChatLanguageModel[WORKFLOW_SERIALIZE]).toBe(
        'function',
      );
      expect(typeof OpenRouterChatLanguageModel[WORKFLOW_DESERIALIZE]).toBe(
        'function',
      );
    });

    it('serializes to a structured-clone-safe payload without secrets', () => {
      const model = customProvider.chat('anthropic/claude-3.5-sonnet', {
        temperature: 0.7,
        extraBody: { transforms: ['middle-out'] },
      });

      const serialized = OpenRouterChatLanguageModel[WORKFLOW_SERIALIZE](model);

      expect(serialized.config).toEqual({
        provider: 'openrouter.chat',
        compatibility: 'compatible',
        baseURL: CUSTOM_BASE_URL,
        headers: {
          'X-OpenRouter-Title': 'My App',
          'HTTP-Referer': 'https://myapp.example.com',
        },
      });

      const persisted = JSON.stringify(serialized);
      expect(persisted).not.toContain('test-api-key');
      expect(persisted).not.toContain('custom-secret-value');
      expect(persisted).not.toContain('proxy-secret');
      expect(persisted).not.toContain('frozen-agent');
      expect(() => structuredClone(serialized)).not.toThrow();
    });

    it('round-trips modelId, settings, and extraBody', () => {
      const settings = {
        temperature: 0.7,
        provider: { order: ['anthropic'], allow_fallbacks: false },
        extraBody: { transforms: ['middle-out'] },
      };
      const model = createOpenRouter({
        apiKey: 'test-api-key',
        compatibility: 'strict',
        extraBody: { user: 'u-1' },
      }).chat('anthropic/claude-3.5-sonnet', settings);

      const serialized = OpenRouterChatLanguageModel[WORKFLOW_SERIALIZE](model);
      expect(serialized.config.compatibility).toBe('strict');
      expect(serialized.config.extraBody).toEqual({ user: 'u-1' });

      const restored = OpenRouterChatLanguageModel[WORKFLOW_DESERIALIZE](
        structuredClone(serialized),
      );

      expect(restored).toBeInstanceOf(OpenRouterChatLanguageModel);
      expect(restored.modelId).toBe('anthropic/claude-3.5-sonnet');
      expect(restored.settings).toEqual(settings);
      expect(restored.provider).toBe('openrouter');
    });

    it('sends only allowlisted headers, the env API key, and the current user agent after restoring', async () => {
      const restored = roundTripChat(
        customProvider.chat('anthropic/claude-3.5-sonnet'),
      );

      vi.stubEnv('OPENROUTER_API_KEY', 'env-api-key');
      const result = await restored.doGenerate({ prompt });

      expect(result.content).toEqual([{ type: 'text', text: 'Hello' }]);
      expect(server.calls[0]!.requestUrl).toBe(
        `${CUSTOM_BASE_URL}/chat/completions`,
      );
      const headers = server.calls[0]!.requestHeaders;
      expect(headers.authorization).toBe('Bearer env-api-key');
      expect(headers['x-openrouter-title']).toBe('My App');
      expect(headers['http-referer']).toBe('https://myapp.example.com');
      expect(headers['x-custom-secret']).toBeUndefined();
      expect(headers['proxy-authorization']).toBeUndefined();
      expect(server.calls[0]!.requestUserAgent).toContain(
        `ai-sdk/openrouter/${VERSION}`,
      );
      expect(server.calls[0]!.requestUserAgent).not.toContain('frozen-agent');
    });

    it('throws a clear error when OPENROUTER_API_KEY is missing after restoring', async () => {
      const restored = roundTripChat(
        customProvider.chat('anthropic/claude-3.5-sonnet'),
      );

      vi.stubEnv('OPENROUTER_API_KEY', undefined);
      await expect(restored.doGenerate({ prompt })).rejects.toThrow(
        'OpenRouter model was restored from workflow storage; set OPENROUTER_API_KEY',
      );
      expect(server.calls).toHaveLength(0);
    });

    it('serializes without loading the API key when OPENROUTER_API_KEY is unset', async () => {
      vi.stubEnv('OPENROUTER_API_KEY', undefined);
      const model = createOpenRouter({
        baseURL: CUSTOM_BASE_URL,
        appName: 'X',
      }).chat('anthropic/claude-3.5-sonnet');

      const serialized = OpenRouterChatLanguageModel[WORKFLOW_SERIALIZE](model);
      expect(serialized.config.headers).toEqual({ 'X-OpenRouter-Title': 'X' });

      const restored = OpenRouterChatLanguageModel[WORKFLOW_DESERIALIZE](
        structuredClone(serialized),
      );
      await expect(restored.doGenerate({ prompt })).rejects.toThrow(
        'OpenRouter model was restored from workflow storage; set OPENROUTER_API_KEY',
      );
      expect(server.calls).toHaveLength(0);
    });

    it('re-serializes a restored model without loading the API key', () => {
      vi.stubEnv('OPENROUTER_API_KEY', undefined);
      const serialized = OpenRouterChatLanguageModel[WORKFLOW_SERIALIZE](
        roundTripChat(customProvider.chat('anthropic/claude-3.5-sonnet')),
      );

      expect(serialized.config.headers).toEqual({
        'X-OpenRouter-Title': 'My App',
        'HTTP-Referer': 'https://myapp.example.com',
      });
      expect(serialized.config.providerApiKeysOmitted).toBeUndefined();
    });

    it('keeps the BYOK marker across repeated round trips', async () => {
      vi.stubEnv('OPENROUTER_API_KEY', undefined);
      const serialized = OpenRouterChatLanguageModel[WORKFLOW_SERIALIZE](
        roundTripChat(byokProvider.chat('anthropic/claude-3.5-sonnet')),
      );
      expect(serialized.config.providerApiKeysOmitted).toBe(true);
      expect(serialized.config.headers).toEqual({});

      const restored = OpenRouterChatLanguageModel[WORKFLOW_DESERIALIZE](
        structuredClone(serialized),
      );
      vi.stubEnv('OPENROUTER_API_KEY', 'env-api-key');
      await expect(restored.doGenerate({ prompt })).rejects.toThrow(
        /BYOK `api_keys`/,
      );
      expect(server.calls).toHaveLength(0);
    });

    it('flags BYOK api_keys without loading the API key', () => {
      vi.stubEnv('OPENROUTER_API_KEY', undefined);
      const model = createOpenRouter({
        api_keys: { anthropic: 'test-anthropic-key' },
      }).chat('anthropic/claude-3.5-sonnet');

      const serialized = OpenRouterChatLanguageModel[WORKFLOW_SERIALIZE](model);
      expect(serialized.config.providerApiKeysOmitted).toBe(true);
      expect(JSON.stringify(serialized)).not.toContain('test-anthropic-key');
    });

    it('flags omitted BYOK api_keys and fails loudly at request time', async () => {
      const model = byokProvider.chat('anthropic/claude-3.5-sonnet');
      const serialized = OpenRouterChatLanguageModel[WORKFLOW_SERIALIZE](model);

      expect(serialized.config.providerApiKeysOmitted).toBe(true);
      expect(JSON.stringify(serialized)).not.toContain('test-anthropic-key');

      const restored = OpenRouterChatLanguageModel[WORKFLOW_DESERIALIZE](
        structuredClone(serialized),
      );

      vi.stubEnv('OPENROUTER_API_KEY', 'env-api-key');
      await expect(restored.doGenerate({ prompt })).rejects.toThrow(
        /BYOK `api_keys`.*not persisted across workflow boundaries/,
      );
      expect(server.calls).toHaveLength(0);
    });
  });

  describe('OpenRouterCompletionLanguageModel', () => {
    it('exposes the workflow serde hooks as static methods', () => {
      expect(typeof OpenRouterCompletionLanguageModel[WORKFLOW_SERIALIZE]).toBe(
        'function',
      );
      expect(
        typeof OpenRouterCompletionLanguageModel[WORKFLOW_DESERIALIZE],
      ).toBe('function');
    });

    it('round-trips modelId and settings', () => {
      const settings = { temperature: 0.5, suffix: '\n\n' };
      const model = provider.completion(
        'openai/gpt-3.5-turbo-instruct',
        settings,
      );

      const serialized =
        OpenRouterCompletionLanguageModel[WORKFLOW_SERIALIZE](model);
      expect(JSON.stringify(serialized)).not.toContain('test-api-key');

      const restored = OpenRouterCompletionLanguageModel[WORKFLOW_DESERIALIZE](
        structuredClone(serialized),
      );

      expect(restored).toBeInstanceOf(OpenRouterCompletionLanguageModel);
      expect(restored.modelId).toBe('openai/gpt-3.5-turbo-instruct');
      expect(restored.settings).toEqual(settings);
    });

    it('serializes without loading the API key when OPENROUTER_API_KEY is unset', async () => {
      vi.stubEnv('OPENROUTER_API_KEY', undefined);
      const model = createOpenRouter({
        baseURL: CUSTOM_BASE_URL,
        appName: 'X',
      }).completion('openai/gpt-3.5-turbo-instruct');

      const serialized =
        OpenRouterCompletionLanguageModel[WORKFLOW_SERIALIZE](model);
      expect(serialized.config.headers).toEqual({ 'X-OpenRouter-Title': 'X' });

      const restored = OpenRouterCompletionLanguageModel[WORKFLOW_DESERIALIZE](
        structuredClone(serialized),
      );
      await expect(restored.doGenerate({ prompt })).rejects.toThrow(
        'OpenRouter model was restored from workflow storage; set OPENROUTER_API_KEY',
      );
      expect(server.calls).toHaveLength(0);
    });

    it('re-serializes a restored model without loading the API key, keeping the BYOK marker', () => {
      vi.stubEnv('OPENROUTER_API_KEY', undefined);
      const plain = OpenRouterCompletionLanguageModel[WORKFLOW_SERIALIZE](
        roundTripCompletion(
          customProvider.completion('openai/gpt-3.5-turbo-instruct'),
        ),
      );
      expect(plain.config.headers).toEqual({
        'X-OpenRouter-Title': 'My App',
        'HTTP-Referer': 'https://myapp.example.com',
      });

      const byok = OpenRouterCompletionLanguageModel[WORKFLOW_SERIALIZE](
        roundTripCompletion(
          byokProvider.completion('openai/gpt-3.5-turbo-instruct'),
        ),
      );
      expect(byok.config.providerApiKeysOmitted).toBe(true);
    });

    it('runs doGenerate against the original baseURL after restoring', async () => {
      const restored = roundTripCompletion(
        customProvider.completion('openai/gpt-3.5-turbo-instruct'),
      );

      vi.stubEnv('OPENROUTER_API_KEY', 'env-api-key');
      const result = await restored.doGenerate({ prompt });

      expect(result.content).toEqual([{ type: 'text', text: 'Hello' }]);
      expect(server.calls[0]!.requestUrl).toBe(
        `${CUSTOM_BASE_URL}/completions`,
      );
      const headers = server.calls[0]!.requestHeaders;
      expect(headers.authorization).toBe('Bearer env-api-key');
      expect(headers['x-custom-secret']).toBeUndefined();
    });

    it('fails loudly at request time when BYOK api_keys were omitted', async () => {
      const restored = roundTripCompletion(
        byokProvider.completion('openai/gpt-3.5-turbo-instruct'),
      );

      vi.stubEnv('OPENROUTER_API_KEY', 'env-api-key');
      await expect(restored.doGenerate({ prompt })).rejects.toThrow(
        /BYOK `api_keys`/,
      );
      expect(server.calls).toHaveLength(0);
    });
  });
});
