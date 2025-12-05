import { generateText, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createOpenRouter } from '@/src';

vi.setConfig({
  testTimeout: 60_000,
});

const getWeatherTool = tool({
  description: 'Get the current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('The city and state, e.g. San Francisco, CA'),
  }),
  execute: async (parameters) => {
    return {
      location: parameters.location,
      temperature: 72,
      unit: 'fahrenheit',
      condition: 'sunny',
    };
  },
});

describe('arcee-ai/trinity-mini tool calling with Together provider', () => {
  it('should handle tool calling with Together as the only provider', async () => {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: `${process.env.OPENROUTER_API_BASE}/api/v1`,
    });

    const model = openrouter('arcee-ai/trinity-mini', {
      provider: {
        only: ['Together'],
      },
      usage: {
        include: true,
      },
    });

    const response = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: 'What is the weather in San Francisco?',
        },
      ],
      tools: {
        getWeather: getWeatherTool,
      },
    });

    console.log('Response text:', response.text);
    console.log('Tool calls:', JSON.stringify(response.toolCalls, null, 2));
    console.log('Tool results:', JSON.stringify(response.toolResults, null, 2));
    console.log(
      'Provider metadata:',
      JSON.stringify(response.providerMetadata, null, 2),
    );

    expect(response.providerMetadata?.openrouter).toMatchObject({
      provider: expect.stringMatching(/together/i),
    });
  });
});
