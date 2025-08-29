/**
 * Basic API key authentication example
 * Shows traditional API key authentication without payments
 */

import { generateText } from 'ai';
import { createDreamsRouter } from '@/src';

const ai = createDreamsRouter({
  baseURL: process.env.ROUTER_BASE_URL || 'http://localhost:8080',
  apiKey: process.env.DREAMSROUTER_API_KEY,
});

const { text } = await generateText({
  model: ai('google-vertex/gemini-2.5-flash'),
  prompt: 'Say hello using API key auth!',
});

console.log(text);
