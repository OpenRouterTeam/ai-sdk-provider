import type { UIMessage } from 'ai';

import {
  executeCommandInTerminalTool,
  readSMSTool,
  sendSMSTool,
} from '@/e2e/tools';
import { createLLMGateway } from '@/src';
import { getEnvVar } from '@/src/env-utils';
import { generateText } from 'ai';
import { it, vi } from 'vitest';

vi.setConfig({
  testTimeout: 42_000,
});

const prompts = [
  'The flight to San Francisco is delayed by 2 hours. Send an SMS to 808-999-2345 with the flight delay information.',
  'Find out if the SMS was delivered properly.',
];

describe('Vercel AI SDK tools call with reasoning', () => {
  it.skip('should work with reasoning content', async () => {
    const llmgateway = createLLMGateway({
      apiKey: getEnvVar('API_KEY'),
      baseURL: `${getEnvVar('API_BASE')}/api/v1`,
    });

    const model = llmgateway('anthropic/claude-sonnet-4', {
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
        tools: {
          readSMS: readSMSTool,
          sendSMS: sendSMSTool,
          executeCommand: executeCommandInTerminalTool,
        },
        maxSteps: 10,
        providerOptions: {
          llmgateway: {
            reasoning: {
              max_tokens: 2048,
            },
          },
        },
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
  });
});
