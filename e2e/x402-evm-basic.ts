/**
 * Basic EVM x402 payment example
 * Shows automatic payment flow with wallet signing
 */

import { generateText } from 'ai';
import { privateKeyToAccount } from 'viem/accounts';
import { createDreamsRouter } from '@/src';

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

const dreamsrouter = createDreamsRouter.evm(account, {
  baseURL: process.env.ROUTER_BASE_URL || 'http://localhost:8080',
  network: 'base-sepolia',
});

const { text } = await generateText({
  model: dreamsrouter('google-vertex/gemini-2.5-flash'),
  prompt: 'Tell me about dreams',
});

console.log(text);
