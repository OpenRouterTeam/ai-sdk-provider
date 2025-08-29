/**
 * Dreams Router Node.js Example
 * Demonstrates viem-native Account interface with Dreams Router
 */

import { generateText, streamText } from 'ai';
import { createEVMAuthFromPrivateKey } from '../src';

const ROUTER_BASE_URL = 'http://localhost:8090/v1';
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;

if (!PRIVATE_KEY) {
  console.error('Please set PRIVATE_KEY');
  process.exit(1);
}

async function example1_ViemNative() {
  console.log('\nExample 1: EVM Account');

  const { dreamsRouter, user } = await createEVMAuthFromPrivateKey(
    PRIVATE_KEY,
    {
      baseURL: ROUTER_BASE_URL,
      payments: {
        network: 'base-sepolia', // EVM-specific networks
      },
    }
  );

  const { text, usage } = await generateText({
    model: dreamsRouter('google-vertex/gemini-2.5-flash'),
    prompt: 'Write a haiku about cryptocurrency and AI in exactly 3 lines.',
  });

  console.log('Generated haiku:');
  console.log(text);
  console.log(`User: ${user.walletAddress}`);
  console.log(`Usage: ${usage?.totalTokens} tokens`);
}

async function example2_Streaming() {
  console.log('\nExample 2: Streaming Text Generation');

  const { dreamsRouter } = await createEVMAuthFromPrivateKey(
    PRIVATE_KEY,
    {
      baseURL: ROUTER_BASE_URL,
      payments: {
        network: 'base-sepolia', // EVM-specific networks
      },
    }
  );

  console.log('Streaming response:');
  const stream = streamText({
    model: dreamsRouter('google-vertex/gemini-2.5-flash'),
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
