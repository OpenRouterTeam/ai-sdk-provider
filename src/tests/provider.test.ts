/**
 * Tests for main provider functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDreamsRouter, createDreamsRouterX402 } from '../provider';
import type { Account } from 'viem';

describe('Provider', () => {
  let mockAccount: Account;

  beforeEach(() => {
    mockAccount = {
      address: '0x1234567890123456789012345678901234567890',
      signTypedData: vi.fn().mockResolvedValue('0x123456789abcdef'),
      type: 'local',
    } as any;
  });

  describe('createDreamsRouter', () => {
    it('should create provider with default settings', () => {
      const provider = createDreamsRouter();

      expect(provider).toBeDefined();
      expect(typeof provider).toBe('function');
      expect(typeof provider.chat).toBe('function');
      expect(typeof provider.completion).toBe('function');
      expect(typeof provider.languageModel).toBe('function');
    });

    it('should create provider with custom baseURL', () => {
      const provider = createDreamsRouter({
        baseURL: 'http://localhost:8080',
      });

      expect(provider).toBeDefined();
    });

    it('should create provider with API key', () => {
      const provider = createDreamsRouter({
        apiKey: 'test-api-key',
      });

      expect(provider).toBeDefined();
    });
  });

  describe('createDreamsRouterX402', () => {
    it('should create x402 provider with account', () => {
      const provider = createDreamsRouterX402(mockAccount);

      expect(provider).toBeDefined();
      expect(typeof provider).toBe('function');
      expect(typeof provider.chat).toBe('function');
    });

    it('should create x402 provider with custom options', () => {
      const provider = createDreamsRouterX402(mockAccount, {
        baseURL: 'http://localhost:8080',
        network: 'base',
        validityDuration: 300,
      });

      expect(provider).toBeDefined();
    });

    it('should create chat model', () => {
      const provider = createDreamsRouterX402(mockAccount);
      const model = provider.chat('anthropic/claude-3-haiku-20240307');

      expect(model).toBeDefined();
      expect(model.modelId).toBe('anthropic/claude-3-haiku-20240307');
    });

    it('should create language model via provider call', () => {
      const provider = createDreamsRouterX402(mockAccount);
      const model = provider('openai/gpt-4o-mini');

      expect(model).toBeDefined();
      expect(model.modelId).toBe('openai/gpt-4o-mini');
    });

    it('should handle completion model', () => {
      const provider = createDreamsRouterX402(mockAccount);
      const model = provider('openai/gpt-3.5-turbo-instruct');

      expect(model).toBeDefined();
      expect(model.modelId).toBe('openai/gpt-3.5-turbo-instruct');
    });
  });

  describe('Provider function calls', () => {
    it('should throw error when called with new keyword', () => {
      const provider = createDreamsRouterX402(mockAccount);

      expect(() => {
        // @ts-expect-error - testing error case
        new provider('claude-3-haiku');
      }).toThrow(
        'The OpenRouter model function cannot be called with the new keyword.'
      );
    });
  });

  describe('Model creation', () => {
    it('should create different models correctly', () => {
      const provider = createDreamsRouterX402(mockAccount);

      const chatModel = provider.chat('anthropic/claude-3-haiku-20240307');
      const completionModel = provider.completion(
        'openai/gpt-3.5-turbo-instruct'
      );
      const languageModel = provider.languageModel('openai/gpt-4o-mini');

      expect(chatModel.modelId).toBe('anthropic/claude-3-haiku-20240307');
      expect(completionModel.modelId).toBe('openai/gpt-3.5-turbo-instruct');
      expect(languageModel.modelId).toBe('openai/gpt-4o-mini');
    });

    it('should pass settings to models', () => {
      const provider = createDreamsRouterX402(mockAccount);
      const settings = { temperature: 0.7, maxTokens: 100 };

      const model = provider.chat(
        'anthropic/claude-3-haiku-20240307',
        settings
      );

      expect(model.settings).toEqual(settings);
    });
  });
});
