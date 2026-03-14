import { describe, it, expect } from 'vitest';
import { OpenRouterChatLanguageModel } from './index';

describe('OpenRouterChatLanguageModel max_tokens handling', () => {
  const mockConfig = {
    apiKey: 'test-key',
    url: () => 'https://openrouter.ai/api/v1',
    headers: () => ({}),
    fetch: undefined,
    extraBody: {},
    compatibility: 'strict' as const,
  };

  it('should use max_completion_tokens for GPT-5 models with Azure-only routing', () => {
    const model = new OpenRouterChatLanguageModel(
      'openai/gpt-5.2-chat',
      {
        provider: {
          only: ['azure']
        }
      },
      mockConfig
    );

    const options = {
      prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
      maxOutputTokens: 1000,
      temperature: 0.7,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      seed: undefined,
      stopSequences: undefined,
      responseFormat: undefined,
      topK: undefined,
      tools: undefined,
      toolChoice: undefined,
    };

    // Access the private method via type assertion
    const args = (model as any).getArgs(options);
    
    expect(args).toHaveProperty('max_completion_tokens', 1000);
    expect(args).not.toHaveProperty('max_tokens');
  });

  it('should use max_tokens for GPT-5 models without Azure-only routing', () => {
    const model = new OpenRouterChatLanguageModel(
      'openai/gpt-5.2-chat',
      {
        provider: {
          order: ['anthropic', 'azure']
        }
      },
      mockConfig
    );

    const options = {
      prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
      maxOutputTokens: 1000,
      temperature: 0.7,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      seed: undefined,
      stopSequences: undefined,
      responseFormat: undefined,
      topK: undefined,
      tools: undefined,
      toolChoice: undefined,
    };

    const args = (model as any).getArgs(options);
    
    expect(args).toHaveProperty('max_tokens', 1000);
    expect(args).not.toHaveProperty('max_completion_tokens');
  });

  it('should use max_tokens for non-GPT-5 models with Azure-only routing', () => {
    const model = new OpenRouterChatLanguageModel(
      'openai/gpt-4o',
      {
        provider: {
          only: ['azure']
        }
      },
      mockConfig
    );

    const options = {
      prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
      maxOutputTokens: 1000,
      temperature: 0.7,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      seed: undefined,
      stopSequences: undefined,
      responseFormat: undefined,
      topK: undefined,
      tools: undefined,
      toolChoice: undefined,
    };

    const args = (model as any).getArgs(options);
    
    expect(args).toHaveProperty('max_tokens', 1000);
    expect(args).not.toHaveProperty('max_completion_tokens');
  });

  it('should handle various GPT-5 model name patterns', () => {
    const testCases = [
      'openai/gpt-5.2-chat',
      'openai/gpt-5.0',
      'openai/gpt-5.1-turbo',
      'gpt-5-custom',
    ];

    testCases.forEach(modelId => {
      const model = new OpenRouterChatLanguageModel(
        modelId,
        {
          provider: {
            only: ['azure']
          }
        },
        mockConfig
      );

      const options = {
        prompt: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'test' }] }],
        maxOutputTokens: 1000,
        temperature: 0.7,
        topP: 1,
        frequencyPenalty: 0,
        presencePenalty: 0,
        seed: undefined,
        stopSequences: undefined,
        responseFormat: undefined,
        topK: undefined,
        tools: undefined,
        toolChoice: undefined,
      };

      const args = (model as any).getArgs(options);
      
      expect(args).toHaveProperty('max_completion_tokens', 1000);
      expect(args).not.toHaveProperty('max_tokens');
    });
  });
});