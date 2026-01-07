import { describe, expect, it } from 'vitest';
import { OpenRouterEmbeddingModel } from '../../embedding/openrouter-embedding-model.js';

describe('OpenRouterEmbeddingModel', () => {
  const defaultSettings = {
    apiKey: 'test-api-key',
    baseURL: 'https://openrouter.ai/api/v1',
    userAgent: 'test-user-agent/0.0.0',
  };

  describe('constructor', () => {
    it('sets specificationVersion to v3', () => {
      const model = new OpenRouterEmbeddingModel('text-embedding-3-small', defaultSettings);

      expect(model.specificationVersion).toBe('v3');
    });

    it('sets provider to openrouter', () => {
      const model = new OpenRouterEmbeddingModel('text-embedding-3-small', defaultSettings);

      expect(model.provider).toBe('openrouter');
    });

    it('sets modelId correctly', () => {
      const model = new OpenRouterEmbeddingModel('openai/text-embedding-3-large', defaultSettings);

      expect(model.modelId).toBe('openai/text-embedding-3-large');
    });

    it('sets maxEmbeddingsPerCall to 2048', () => {
      const model = new OpenRouterEmbeddingModel('text-embedding-3-small', defaultSettings);

      expect(model.maxEmbeddingsPerCall).toBe(2048);
    });

    it('sets supportsParallelCalls to true', () => {
      const model = new OpenRouterEmbeddingModel('text-embedding-3-small', defaultSettings);

      expect(model.supportsParallelCalls).toBe(true);
    });
  });

  describe('interface compliance', () => {
    it('implements EmbeddingModelV3 interface', () => {
      const model = new OpenRouterEmbeddingModel('text-embedding-3-small', defaultSettings);

      // Verify required properties exist
      expect(model).toHaveProperty('specificationVersion');
      expect(model).toHaveProperty('provider');
      expect(model).toHaveProperty('modelId');
      expect(model).toHaveProperty('maxEmbeddingsPerCall');
      expect(model).toHaveProperty('supportsParallelCalls');
      expect(model).toHaveProperty('doEmbed');

      // Verify doEmbed is a function
      expect(typeof model.doEmbed).toBe('function');
    });
  });
});
