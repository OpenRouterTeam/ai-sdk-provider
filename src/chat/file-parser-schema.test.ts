import { describe, expect, it } from 'vitest';
import { OpenRouterNonStreamChatCompletionResponseSchema } from './schemas';

describe('FileParser annotation schema', () => {
  it('should parse file annotation with content array and extra fields', () => {
    const response = {
      id: 'gen-test',
      provider: 'Amazon Bedrock',
      model: 'anthropic/claude-3.5-sonnet',
      object: 'chat.completion',
      created: 1763157061,
      choices: [
        {
          logprobs: null,
          finish_reason: 'stop',
          native_finish_reason: 'stop', // Extra field from API
          index: 0,
          message: {
            role: 'assistant' as const,
            content: 'Test response',
            refusal: null, // Extra field from API
            reasoning: null,
            annotations: [
              {
                type: 'file' as const,
                file: {
                  hash: '85bd49b97b7ff5be002d9f654776119f253c1cae333b49ba8f4a53da346284ba',
                  name: '',
                  content: [
                    {
                      type: 'text',
                      text: '<file name="">',
                    },
                    {
                      type: 'text',
                      text: 'Some file content',
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    };

    const result = OpenRouterNonStreamChatCompletionResponseSchema.parse(response);
    
    // Check that parsing succeeded
    expect(result).toBeDefined();
    // The schema uses passthrough so we can't strictly type check, but we can verify structure
    const firstChoice = (result as any).choices?.[0];
    expect(firstChoice?.message.annotations).toBeDefined();
    expect(firstChoice?.message.annotations?.[0]?.type).toBe('file');
  });
});
