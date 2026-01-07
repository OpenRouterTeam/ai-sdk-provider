import { describe, it, expect } from 'vitest';
import { createOpenRouter } from '../openrouter-provider.js';
import { OpenRouterChatLanguageModel } from '../chat/openrouter-chat-language-model.js';
import { OpenRouterEmbeddingModel } from '../embedding/openrouter-embedding-model.js';
import { OpenRouterImageModel } from '../image/openrouter-image-model.js';

describe('createOpenRouter', () => {
  const TEST_API_KEY = 'test-api-key';

  describe('provider creation', () => {
    it('returns provider with specificationVersion v3', () => {
      const provider = createOpenRouter({ apiKey: TEST_API_KEY });
      expect(provider.specificationVersion).toBe('v3');
    });

    it('creates provider without options (uses env var)', () => {
      // Provider creation should succeed even without explicit apiKey
      // API key is loaded at model creation time, not provider creation
      const provider = createOpenRouter();
      expect(provider.specificationVersion).toBe('v3');
    });
  });

  describe('provider callable', () => {
    it('provider(modelId) returns LanguageModelV3', () => {
      const provider = createOpenRouter({ apiKey: TEST_API_KEY });
      const model = provider('anthropic/claude-3.5-sonnet');

      expect(model).toBeInstanceOf(OpenRouterChatLanguageModel);
      expect(model.specificationVersion).toBe('v3');
      expect(model.modelId).toBe('anthropic/claude-3.5-sonnet');
      expect(model.provider).toBe('openrouter');
    });

    it('provider(modelId, options) passes options to model', () => {
      const provider = createOpenRouter({ apiKey: TEST_API_KEY });
      const model = provider('anthropic/claude-3.5-sonnet', {
        temperature: 0.7,
      });

      expect(model).toBeInstanceOf(OpenRouterChatLanguageModel);
      expect(model.modelId).toBe('anthropic/claude-3.5-sonnet');
    });
  });

  describe('languageModel method', () => {
    it('returns OpenRouterChatLanguageModel', () => {
      const provider = createOpenRouter({ apiKey: TEST_API_KEY });
      const model = provider.languageModel('openai/gpt-4o');

      expect(model).toBeInstanceOf(OpenRouterChatLanguageModel);
      expect(model.specificationVersion).toBe('v3');
      expect(model.modelId).toBe('openai/gpt-4o');
    });

    it('accepts model options', () => {
      const provider = createOpenRouter({ apiKey: TEST_API_KEY });
      const model = provider.languageModel('openai/gpt-4o', {
        maxTokens: 1000,
      });

      expect(model).toBeInstanceOf(OpenRouterChatLanguageModel);
    });
  });

  describe('chat method', () => {
    it('is alias for languageModel', () => {
      const provider = createOpenRouter({ apiKey: TEST_API_KEY });
      const chatModel = provider.chat('meta-llama/llama-3-70b');
      const languageModel = provider.languageModel('meta-llama/llama-3-70b');

      // Both should return same type of model
      expect(chatModel).toBeInstanceOf(OpenRouterChatLanguageModel);
      expect(languageModel).toBeInstanceOf(OpenRouterChatLanguageModel);
      expect(chatModel.modelId).toBe(languageModel.modelId);
    });
  });

  describe('embeddingModel method', () => {
    it('returns OpenRouterEmbeddingModel', () => {
      const provider = createOpenRouter({ apiKey: TEST_API_KEY });
      const model = provider.embeddingModel('openai/text-embedding-3-small');

      expect(model).toBeInstanceOf(OpenRouterEmbeddingModel);
      expect(model.specificationVersion).toBe('v3');
      expect(model.modelId).toBe('openai/text-embedding-3-small');
      expect(model.provider).toBe('openrouter');
    });
  });

  describe('textEmbeddingModel method (deprecated)', () => {
    it('is alias for embeddingModel', () => {
      const provider = createOpenRouter({ apiKey: TEST_API_KEY });
      const textEmbeddingModel = provider.textEmbeddingModel(
        'openai/text-embedding-3-small'
      );
      const embeddingModel = provider.embeddingModel('openai/text-embedding-3-small');

      expect(textEmbeddingModel).toBeInstanceOf(OpenRouterEmbeddingModel);
      expect(embeddingModel).toBeInstanceOf(OpenRouterEmbeddingModel);
      expect(textEmbeddingModel.modelId).toBe(embeddingModel.modelId);
    });
  });

  describe('imageModel method', () => {
    it('returns OpenRouterImageModel', () => {
      const provider = createOpenRouter({ apiKey: TEST_API_KEY });
      const model = provider.imageModel('openai/dall-e-3');

      expect(model).toBeInstanceOf(OpenRouterImageModel);
      expect(model.specificationVersion).toBe('v3');
      expect(model.modelId).toBe('openai/dall-e-3');
      expect(model.provider).toBe('openrouter');
    });
  });

  describe('image method', () => {
    it('is alias for imageModel', () => {
      const provider = createOpenRouter({ apiKey: TEST_API_KEY });
      const imageModel = provider.image('openai/dall-e-3');
      const imageModelDirect = provider.imageModel('openai/dall-e-3');

      expect(imageModel).toBeInstanceOf(OpenRouterImageModel);
      expect(imageModelDirect).toBeInstanceOf(OpenRouterImageModel);
      expect(imageModel.modelId).toBe(imageModelDirect.modelId);
    });
  });

  describe('embedding method (deprecated)', () => {
    it('is alias for embeddingModel', () => {
      const provider = createOpenRouter({ apiKey: TEST_API_KEY });
      const embeddingModel = provider.embedding('openai/text-embedding-3-small');

      expect(embeddingModel).toBeInstanceOf(OpenRouterEmbeddingModel);
      expect(embeddingModel.modelId).toBe('openai/text-embedding-3-small');
    });
  });

  describe('provider configuration', () => {
    it('accepts baseURL option', () => {
      const provider = createOpenRouter({
        apiKey: TEST_API_KEY,
        baseURL: 'https://custom.openrouter.ai/api/v1',
      });

      // Provider should be created successfully
      expect(provider.specificationVersion).toBe('v3');
      const model = provider('test/model');
      expect(model).toBeInstanceOf(OpenRouterChatLanguageModel);
    });

    it('accepts baseUrl option (alternative spelling)', () => {
      const provider = createOpenRouter({
        apiKey: TEST_API_KEY,
        baseUrl: 'https://custom.openrouter.ai/api/v1',
      });

      expect(provider.specificationVersion).toBe('v3');
    });

    it('accepts headers option', () => {
      const provider = createOpenRouter({
        apiKey: TEST_API_KEY,
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });

      expect(provider.specificationVersion).toBe('v3');
    });

    it('accepts fetch option', () => {
      const customFetch = async () => new Response();
      const provider = createOpenRouter({
        apiKey: TEST_API_KEY,
        fetch: customFetch,
      });

      expect(provider.specificationVersion).toBe('v3');
    });

    it('accepts extraBody option', () => {
      const provider = createOpenRouter({
        apiKey: TEST_API_KEY,
        extraBody: {
          customField: 'customValue',
        },
      });

      expect(provider.specificationVersion).toBe('v3');
    });
  });
});
