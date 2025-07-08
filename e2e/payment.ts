import { createDreamsRouter } from '@daydreamsai/ai-sdk-provider';
import { generateText } from 'ai';

const ROUTER_BASE_URL =
  process.env.VITE_ROUTER_BASE_URL || 'http://localhost:8080';

const createRouterInstance = (extraBody: any = {}, apiKey?: string) => {
  return createDreamsRouter({
    apiKey: apiKey || '',
    baseURL: ROUTER_BASE_URL + '/v1/',
    payment: {
      privateKey: process.env.PRIVATE_KEY as `0x${string}`,
    },
    extraBody,
  });
};

const dreamsrouter = createRouterInstance();

const { text, usage, finishReason } = await generateText({
  model: dreamsrouter('openai/gpt-4o-2024-08-06'),
  prompt: 'Hello, world!',
});

console.log('Generated text:', text);
console.log('Usage:', usage);
console.log('Finish reason:', finishReason);
