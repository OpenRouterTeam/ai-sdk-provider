/**
 * Dreams Router Node.js Example
 * Demonstrates viem-native Account interface with Dreams Router
 */

import { generateText, streamText } from 'ai';
import { privateKeyToAccount } from 'viem/accounts';

import { createDreamsRouterAuth } from '../src/index';

const ROUTER_BASE_URL = 'http://localhost:8080/v1';
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;

if (!PRIVATE_KEY) {
  console.error('Please set PRIVATE_KEY');
  process.exit(1);
}

async function example1_ViemNative() {
  console.log('\nExample 1: Viem Native Account');

  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`Account address: ${account.address}`);

  const { dreamsRouter, user } = await createDreamsRouterAuth(account, {
    baseURL: ROUTER_BASE_URL,
    payments: {
      amount: '100000', // $0.10 USDC
      network: 'base-sepolia',
    },
  });

  console.log(`Authenticated user: ${user.wallet_address}`);
  console.log(`Balance: $${user.balance || 0}`);

  const { text, usage } = await generateText({
    model: dreamsRouter('openai/gpt-4o-2024-08-06'),
    prompt: 'Write a haiku about cryptocurrency and AI in exactly 3 lines.',
  });

  console.log('Generated haiku:');
  console.log(text);
  console.log(`Usage: ${usage?.totalTokens} tokens`);
}

async function example2_Streaming() {
  console.log('\nExample 2: Streaming Text Generation');

  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`Account address: ${account.address}`);

  const { dreamsRouter } = await createDreamsRouterAuth(account, {
    baseURL: ROUTER_BASE_URL,
    payments: {
      amount: '50000', // $0.05 USDC
      network: 'base-sepolia',
    },
  });

  console.log('Streaming response:');
  const stream = streamText({
    model: dreamsRouter('openai/gpt-4o-mini'),
    prompt: 'Explain quantum computing in simple terms, max 100 words.',
  });

  for await (const chunk of stream.textStream) {
    process.stdout.write(chunk);
  }
  console.log('\nStream complete');
}

async function main() {
  console.log('Dreams Router Node.js Examples');
  console.log('===============================');

  try {
    await example1_ViemNative();
    await example2_Streaming();

    console.log('\nAll examples completed successfully');
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { example1_ViemNative, example2_Streaming };
