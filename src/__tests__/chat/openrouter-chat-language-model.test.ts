import type { LanguageModelV3Prompt } from '@ai-sdk/provider';

import { describe, expect, it, vi } from 'vitest';
import { OpenRouterChatLanguageModel } from '../../chat/openrouter-chat-language-model.js';

const createTestSettings = () => ({
  apiKey: 'test-key',
  baseURL: 'https://openrouter.ai/api/v1',
  userAgent: 'test-user-agent/0.0.0',
});

// Mock the OpenRouter SDK
vi.mock('@openrouter/sdk', () => {
  return {
    OpenRouter: vi.fn().mockImplementation(() => ({
      beta: {
        responses: {
          send: vi.fn().mockResolvedValue({
            id: 'resp-test',
            model: 'test-model',
            status: 'completed',
            createdAt: 1704067200,
            output: [
              {
                type: 'message',
                content: [{ type: 'output_text', text: 'Hello' }],
              },
            ],
            outputText: 'Hello',
            usage: {
              inputTokens: 10,
              outputTokens: 5,
              totalTokens: 15,
            },
          }),
        },
      },
    })),
    SDK_METADATA: { userAgent: 'test-sdk/1.0.0' },
  };
});

const createTestPrompt = (): LanguageModelV3Prompt => [
  {
    role: 'user',
    content: [{ type: 'text', text: 'Hello' }],
  },
];

describe('OpenRouterChatLanguageModel', () => {
  describe('constructor', () => {
    it('should set specificationVersion to v3', () => {
      const model = new OpenRouterChatLanguageModel(
        'openai/gpt-4o',
        createTestSettings(),
      );

      expect(model.specificationVersion).toBe('v3');
    });

    it('should set provider to openrouter', () => {
      const model = new OpenRouterChatLanguageModel(
        'openai/gpt-4o',
        createTestSettings(),
      );

      expect(model.provider).toBe('openrouter');
    });

    it('should set modelId correctly', () => {
      const model = new OpenRouterChatLanguageModel(
        'anthropic/claude-3.5-sonnet',
        createTestSettings(),
      );

      expect(model.modelId).toBe('anthropic/claude-3.5-sonnet');
    });

    it('should set modelId for various model formats', () => {
      const testCases = [
        'openai/gpt-4o',
        'anthropic/claude-3.5-sonnet',
        'google/gemini-2.5-flash-preview',
        'meta-llama/llama-3.3-70b-instruct',
        'deepseek/deepseek-r1',
      ];

      for (const modelId of testCases) {
        const model = new OpenRouterChatLanguageModel(
          modelId,
          createTestSettings(),
        );
        expect(model.modelId).toBe(modelId);
      }
    });
  });

  describe('supportedUrls', () => {
    it('should contain image patterns', () => {
      const model = new OpenRouterChatLanguageModel(
        'openai/gpt-4o',
        createTestSettings(),
      );

      expect(model.supportedUrls).toBeDefined();
      expect(model.supportedUrls['image/*']).toBeDefined();
      expect(model.supportedUrls['image/*']).toHaveLength(1);
    });

    it('should match http image URLs', () => {
      const model = new OpenRouterChatLanguageModel(
        'openai/gpt-4o',
        createTestSettings(),
      );

      const imagePatterns = model.supportedUrls['image/*'];
      expect(imagePatterns).toBeDefined();
      const imagePattern = imagePatterns![0]!;
      expect(imagePattern.test('http://example.com/image.png')).toBe(true);
      expect(
        imagePattern.test('http://cdn.example.com/path/to/image.jpg'),
      ).toBe(true);
    });

    it('should match https image URLs', () => {
      const model = new OpenRouterChatLanguageModel(
        'openai/gpt-4o',
        createTestSettings(),
      );

      const imagePatterns = model.supportedUrls['image/*'];
      expect(imagePatterns).toBeDefined();
      const imagePattern = imagePatterns![0]!;
      expect(imagePattern.test('https://example.com/image.png')).toBe(true);
      expect(
        imagePattern.test('https://cdn.example.com/path/to/image.jpg'),
      ).toBe(true);
    });

    it('should not match non-http URLs', () => {
      const model = new OpenRouterChatLanguageModel(
        'openai/gpt-4o',
        createTestSettings(),
      );

      const imagePatterns = model.supportedUrls['image/*'];
      expect(imagePatterns).toBeDefined();
      const imagePattern = imagePatterns![0]!;
      expect(imagePattern.test('ftp://example.com/image.png')).toBe(false);
      expect(imagePattern.test('file:///path/to/image.png')).toBe(false);
      expect(imagePattern.test('data:image/png;base64,abc123')).toBe(false);
    });
  });

  describe('interface compliance', () => {
    it('should implement LanguageModelV3 interface', () => {
      const model = new OpenRouterChatLanguageModel(
        'openai/gpt-4o',
        createTestSettings(),
      );

      // Check required properties
      expect(model.specificationVersion).toBe('v3');
      expect(typeof model.provider).toBe('string');
      expect(typeof model.modelId).toBe('string');

      // Check required methods exist
      expect(typeof model.doGenerate).toBe('function');
      expect(typeof model.doStream).toBe('function');
    });
  });

  describe('model options forwarding', () => {
    it('should forward reasoning options from model settings to doGenerate request', async () => {
      const model = new OpenRouterChatLanguageModel('google/gemini-3-flash', {
        ...createTestSettings(),
        modelOptions: {
          reasoning: {
            enabled: true,
            effort: 'medium',
          },
        },
      });

      const result = await model.doGenerate({
        prompt: createTestPrompt(),
      });

      // Verify request body includes reasoning config
      const body = result.request?.body as Record<string, unknown>;
      expect(body).toBeDefined();
      expect(body).toHaveProperty('reasoning');
      expect(body.reasoning).toEqual({
        enabled: true,
        effort: 'medium',
      });
    });

    it('should forward reasoning options from model settings to doStream request', async () => {
      const model = new OpenRouterChatLanguageModel('google/gemini-3-flash', {
        ...createTestSettings(),
        modelOptions: {
          reasoning: {
            enabled: true,
            effort: 'high',
            maxTokens: 10000,
          },
        },
      });

      const result = await model.doStream({
        prompt: createTestPrompt(),
      });

      // Verify request body includes reasoning config
      const body = result.request?.body as Record<string, unknown>;
      expect(body).toBeDefined();
      expect(body).toHaveProperty('reasoning');
      expect(body.reasoning).toEqual({
        enabled: true,
        effort: 'high',
        maxTokens: 10000,
      });
    });

    it('should forward provider routing options from model settings to request', async () => {
      const model = new OpenRouterChatLanguageModel('openai/gpt-4o', {
        ...createTestSettings(),
        modelOptions: {
          provider: {
            order: ['Azure', 'OpenAI'],
            allowFallbacks: false,
          },
        },
      });

      const result = await model.doGenerate({
        prompt: createTestPrompt(),
      });

      // Verify request body includes provider config
      const body = result.request?.body as Record<string, unknown>;
      expect(body).toBeDefined();
      expect(body).toHaveProperty('provider');
      expect(body.provider).toEqual({
        order: ['Azure', 'OpenAI'],
        allowFallbacks: false,
      });
    });

    it('should forward fallback models from model settings to request', async () => {
      const model = new OpenRouterChatLanguageModel('openai/gpt-4o', {
        ...createTestSettings(),
        modelOptions: {
          models: ['anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash'],
        },
      });

      const result = await model.doGenerate({
        prompt: createTestPrompt(),
      });

      // Verify request body includes fallback models
      const body = result.request?.body as Record<string, unknown>;
      expect(body).toBeDefined();
      expect(body).toHaveProperty('models');
      expect(body.models).toEqual([
        'anthropic/claude-3.5-sonnet',
        'google/gemini-2.0-flash',
      ]);
    });

    it('should forward transforms from model settings to request', async () => {
      const model = new OpenRouterChatLanguageModel('openai/gpt-4o', {
        ...createTestSettings(),
        modelOptions: {
          transforms: ['middle-out'],
        },
      });

      const result = await model.doGenerate({
        prompt: createTestPrompt(),
      });

      // Verify request body includes transforms
      const body = result.request?.body as Record<string, unknown>;
      expect(body).toBeDefined();
      expect(body).toHaveProperty('transforms');
      expect(body.transforms).toEqual(['middle-out']);
    });

    it('should not include model options when not provided', async () => {
      const model = new OpenRouterChatLanguageModel('openai/gpt-4o', {
        ...createTestSettings(),
        // No modelOptions
      });

      const result = await model.doGenerate({
        prompt: createTestPrompt(),
      });

      // Verify request body does not include model options fields
      const body = result.request?.body as Record<string, unknown>;
      expect(body).toBeDefined();
      expect(body).not.toHaveProperty('reasoning');
      expect(body).not.toHaveProperty('provider');
      expect(body).not.toHaveProperty('models');
      expect(body).not.toHaveProperty('transforms');
    });

    it('should forward plugins option from model settings to request', async () => {
      const model = new OpenRouterChatLanguageModel('openai/gpt-4o', {
        ...createTestSettings(),
        modelOptions: {
          plugins: [{ id: 'web-search' }],
        },
      });

      const result = await model.doGenerate({
        prompt: createTestPrompt(),
      });

      // Verify request body includes plugins config
      const body = result.request?.body as Record<string, unknown>;
      expect(body).toBeDefined();
      expect(body).toHaveProperty('plugins');
      expect(body.plugins).toEqual([{ id: 'web-search' }]);
    });

    it('should forward route option from model settings to request', async () => {
      const model = new OpenRouterChatLanguageModel('openai/gpt-4o', {
        ...createTestSettings(),
        modelOptions: {
          route: 'fallback',
        },
      });

      const result = await model.doGenerate({
        prompt: createTestPrompt(),
      });

      // Verify request body includes route config
      const body = result.request?.body as Record<string, unknown>;
      expect(body).toBeDefined();
      expect(body).toHaveProperty('route');
      expect(body.route).toEqual('fallback');
    });

    it('should merge call-time providerOptions with model options (call-time wins)', async () => {
      const model = new OpenRouterChatLanguageModel('google/gemini-3-flash', {
        ...createTestSettings(),
        modelOptions: {
          reasoning: { effort: 'low' },
          route: 'fallback',
        },
      });

      const result = await model.doGenerate({
        prompt: createTestPrompt(),
        providerOptions: {
          openrouter: {
            reasoning: { effort: 'high' },
          },
        },
      });

      // Call-time 'high' should override model-time 'low'
      // Model-time 'route' should be preserved
      const body = result.request?.body as Record<string, unknown>;
      expect(body).toBeDefined();
      expect(body).toHaveProperty('reasoning');
      expect(body.reasoning).toEqual({ effort: 'high' });
      expect(body).toHaveProperty('route');
      expect(body.route).toEqual('fallback');
    });

    it('should apply call-time providerOptions when no model options set', async () => {
      const model = new OpenRouterChatLanguageModel('openai/gpt-4o', {
        ...createTestSettings(),
        // No modelOptions
      });

      const result = await model.doGenerate({
        prompt: createTestPrompt(),
        providerOptions: {
          openrouter: {
            plugins: [{ id: 'code-interpreter' }],
            route: 'fallback',
          },
        },
      });

      // Call-time options should be applied
      const body = result.request?.body as Record<string, unknown>;
      expect(body).toBeDefined();
      expect(body).toHaveProperty('plugins');
      expect(body.plugins).toEqual([{ id: 'code-interpreter' }]);
      expect(body).toHaveProperty('route');
      expect(body.route).toEqual('fallback');
    });
  });
});
