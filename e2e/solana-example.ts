/**
 * Separated Auth Example - Clean separation of concerns
 * Different auth functions for EVM and Solana, generic internals
 */

import { generateText } from 'ai';
import { createSolanaAuthFromPublicKey } from '../src';

const ROUTER_BASE_URL =
  process.env.ROUTER_BASE_URL || 'http://localhost:8080/v1';

const SOL_PUBLIC_KEY = process.env.SOL_PUBLIC_KEY; // base58 encoded public key

async function solanaExample() {
  if (!SOL_PUBLIC_KEY) {
    console.log('Skipping Solana example - no SOL_PUBLIC_KEY provided');
    return;
  }

  console.log('\n🔶 Solana Authentication Example');
  console.log('==================================');

  try {
    // Mock signing function for example
    const mockSignMessage = async ({ message }: { message: string }) => {
      // In real usage, this would use a wallet to sign
      console.log(`Would sign message: ${message}`);
      return 'mock-signature-base58';
    };

    // Clean Solana-specific auth function
    const { dreamsRouter, user } = await createSolanaAuthFromPublicKey(
      SOL_PUBLIC_KEY,
      mockSignMessage,
      {
        baseURL: ROUTER_BASE_URL,
        payments: {
          network: 'solana-devnet', // Solana-specific networks
          rpcUrl: 'https://api.devnet.solana.com', // Solana-specific config
          // Router auto-fetches exact requirements
        },
      }
    );

    console.log(`✅ Solana Account authenticated: ${user.walletAddress}`);

    // Make AI request - payment handled via Solana
    const { text, usage } = await generateText({
      model: dreamsRouter('google-vertex/gemini-2.5-flash'),
      prompt: 'Explain Solana in one sentence.',
    });

    console.log(`📝 Response: ${text}`);
    console.log(`📊 Usage: ${usage?.totalTokens} tokens`);
    console.log(`💰 Payment: Solana-based via Devnet`);
  } catch (error) {
    console.error('❌ Solana example failed:', error);
  }
}

async function main() {
  console.log('🚀 Dreams Router - Separated Authentication Examples');
  console.log('=====================================================');
  console.log('✨ Clean separation: createEVMAuth() vs createSolanaAuth()');
  console.log('🔧 Generic internals, specific auth functions');

  try {
    await solanaExample();
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { solanaExample };
