import { describe, it, expect } from 'vitest';
import { OpenRouterChatLanguageModel } from '../../chat/openrouter-chat-language-model.js';

const createTestSettings = () => ({
  apiKey: 'test-key',
  baseURL: 'https://openrouter.ai/api/v1',
});

describe('OpenRouterChatLanguageModel', () => {
  describe('constructor', () => {
    it('should set specificationVersion to v3', () => {
      const model = new OpenRouterChatLanguageModel(
        'openai/gpt-4o',
        createTestSettings()
      );

      expect(model.specificationVersion).toBe('v3');
    });

    it('should set provider to openrouter', () => {
      const model = new OpenRouterChatLanguageModel(
        'openai/gpt-4o',
        createTestSettings()
      );

      expect(model.provider).toBe('openrouter');
    });

    it('should set modelId correctly', () => {
      const model = new OpenRouterChatLanguageModel(
        'anthropic/claude-3.5-sonnet',
        createTestSettings()
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
          createTestSettings()
        );
        expect(model.modelId).toBe(modelId);
      }
    });
  });

  describe('supportedUrls', () => {
    it('should contain image patterns', () => {
      const model = new OpenRouterChatLanguageModel(
        'openai/gpt-4o',
        createTestSettings()
      );

      expect(model.supportedUrls).toBeDefined();
      expect(model.supportedUrls['image/*']).toBeDefined();
      expect(model.supportedUrls['image/*']).toHaveLength(1);
    });

    it('should match http image URLs', () => {
      const model = new OpenRouterChatLanguageModel(
        'openai/gpt-4o',
        createTestSettings()
      );

      const imagePatterns = model.supportedUrls['image/*'];
      expect(imagePatterns).toBeDefined();
      const imagePattern = imagePatterns![0]!;
      expect(imagePattern.test('http://example.com/image.png')).toBe(true);
      expect(imagePattern.test('http://cdn.example.com/path/to/image.jpg')).toBe(
        true
      );
    });

    it('should match https image URLs', () => {
      const model = new OpenRouterChatLanguageModel(
        'openai/gpt-4o',
        createTestSettings()
      );

      const imagePatterns = model.supportedUrls['image/*'];
      expect(imagePatterns).toBeDefined();
      const imagePattern = imagePatterns![0]!;
      expect(imagePattern.test('https://example.com/image.png')).toBe(true);
      expect(
        imagePattern.test('https://cdn.example.com/path/to/image.jpg')
      ).toBe(true);
    });

    it('should not match non-http URLs', () => {
      const model = new OpenRouterChatLanguageModel(
        'openai/gpt-4o',
        createTestSettings()
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
        createTestSettings()
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
});
