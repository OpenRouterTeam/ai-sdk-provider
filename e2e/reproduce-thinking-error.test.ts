import { describe, it } from 'vitest';
import { createOpenRouter } from '@/src';

describe('Reproduce thinking block error', () => {
  it('should reproduce the thinking block error from Claude', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    // Make a raw API call with the problematic message format
    const response = await fetch(`${process.env.OPENROUTER_API_BASE}/api/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4.5',
        provider: {
          order: ['Anthropic'],
        },
        thinking: {
          type: 'enabled',
          budget_tokens: 1000,
        },
        messages: [
          {
            role: 'user',
            content: 'What is the weather in San Francisco?',
          },
          {
            role: 'assistant',
            content: '',  // Empty content
            reasoning: 'I need to call the weather tool',
            tool_calls: [
              {
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'getWeather',
                  arguments: JSON.stringify({ location: 'San Francisco, CA' }),
                },
              },
            ],
          },
          {
            role: 'tool',
            tool_call_id: 'call_123',
            content: JSON.stringify({
              location: 'San Francisco, CA',
              temperature: 72,
              condition: 'Sunny',
            }),
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'getWeather',
              description: 'Get the current weather for a location',
              parameters: {
                type: 'object',
                properties: {
                  location: {
                    type: 'string',
                    description: 'The city and state, e.g. San Francisco, CA',
                  },
                },
                required: ['location'],
              },
            },
          },
        ],
      }),
    });

    const data = await response.json();

    console.log('[E2E] Response status:', response.status);
    console.log('[E2E] Response body:', JSON.stringify(data, null, 2));

    if (data.error) {
      console.log('[E2E] ========== GOT THE ERROR ==========');
      console.log('[E2E] Error type:', data.error.type);
      console.log('[E2E] Error message:', data.error.message);
      console.log('[E2E] ========================================');
    }
  });
});
