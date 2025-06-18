import type { UIMessage } from 'ai';

import { createLLMGateway } from '@/src';
import { getEnvVar } from '@/src/env-utils';
import { generateText } from 'ai';
import { it, vi } from 'vitest';

vi.setConfig({
  testTimeout: 42_000,
});

const prompts = [
  'Hi. What model are you?',
];

describe('Vercel AI SDK basic', () => {
  it('should work', async () => {
    const llmgateway = createLLMGateway({
      apiKey: getEnvVar('API_KEY'),
      baseURL: `${getEnvVar('API_BASE')}/v1`,
    });

    const model = llmgateway('claude-3-7-sonnet', {
      usage: {
        include: true,
      },
    });
    const messageHistory: UIMessage[] = [];
    for (const prompt of prompts) {
      messageHistory.push({
        id: crypto.randomUUID(),
        role: 'user',
        content: prompt,
        parts: [
          {
            type: 'text',
            text: prompt,
          },
        ],
      });

      const response = await generateText({
        model,
        system:
          'You are an airline assistant. You can send and read SMS messages, and execute commands in the terminal.',
        messages: messageHistory,
        // providerOptions: {
        //   llmgateway: {
        //     reasoning: {
        //       max_tokens: 2048,
        //     },
        //   },
        // },
      });

      const parts = response.steps.map(
        (step) =>
          ({
            type: 'text' as const,
            text: step.text,
          }) satisfies UIMessage['parts'][number],
      ) satisfies UIMessage['parts'];

      messageHistory.push({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.text,
        parts,
      });
    }

    console.log('messageHistory', messageHistory);
  });
});
