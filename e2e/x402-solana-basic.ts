/**
 * Basic Solana x402 payment example
 * Shows automatic payment flow with Solana wallet signing
 */

import { generateText } from 'ai';
import { createDreamsRouter } from '../src';

const solanaSigner = {
  type: 'node' as const,
  secretKeyBase58: process.env.SOLANA_SECRET_KEY || '',
  rpcUrl: process.env.SOLANA_RPC_URL,
};

const dreamsrouter = createDreamsRouter.solana(solanaSigner, {
  baseURL: process.env.ROUTER_BASE_URL || 'http://localhost:8080',
  network: 'solana-devnet',
});

const { text } = await generateText({
  model: dreamsrouter('google-vertex/gemini-2.5-flash'),
  prompt: 'Say hello from Solana x402!',
});

console.log(text);
