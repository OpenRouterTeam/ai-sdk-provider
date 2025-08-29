/**
 * Separated Auth Example - Clean separation of concerns
 * Different auth functions for EVM and Solana, generic internals
 */

import { generateText } from 'ai';
import { 
  createEVMAuthFromPrivateKey,
  createSolanaAuthFromPublicKey
} from '../src';

const ROUTER_BASE_URL = process.env.ROUTER_BASE_URL || 'http://localhost:8080/v1';
const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY; // 0x prefixed
const SOL_PUBLIC_KEY = process.env.SOL_PUBLIC_KEY; // base58 encoded public key

async function evmExample() {
  if (!EVM_PRIVATE_KEY) {
    console.log('Skipping EVM example - no EVM_PRIVATE_KEY provided');
    return;
  }

  console.log('\n🔷 EVM Authentication Example');
  console.log('==============================');

  try {
    // Clean EVM-specific auth function
    const { dreamsRouter, user } = await createEVMAuthFromPrivateKey(
      EVM_PRIVATE_KEY as `0x${string}`,
      {
        baseURL: ROUTER_BASE_URL,
        payments: {
          network: 'base-sepolia', // EVM-specific networks
          // Router auto-fetches exact requirements
        },
      }
    );

    console.log(`✅ EVM Account authenticated: ${user.walletAddress}`);

    // Make AI request - payment handled via EVM
    const { text, usage } = await generateText({
      model: dreamsRouter('google-vertex/gemini-2.5-flash'),
      prompt: 'Explain EVM in one sentence.',
    });

    console.log(`📝 Response: ${text}`);
    console.log(`📊 Usage: ${usage?.totalTokens} tokens`);
    console.log(`💰 Payment: EVM-based via Base Sepolia`);

  } catch (error) {
    console.error('❌ EVM example failed:', error);
  }
}

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

async function advancedConfigExample() {
  if (!EVM_PRIVATE_KEY) {
    console.log('Skipping advanced config example - no EVM_PRIVATE_KEY provided');
    return;
  }

  console.log('\n⚙️  Advanced Configuration Example');
  console.log('====================================');

  try {
    // Advanced EVM configuration
    const { dreamsRouter, authManager } = await createEVMAuthFromPrivateKey(
      EVM_PRIVATE_KEY as `0x${string}`,
      {
        baseURL: ROUTER_BASE_URL,
        payments: {
          network: 'base-sepolia',
          validityDuration: 300, // 5 minutes
          mode: 'eager', // Pre-attach payments when possible
        },
      }
    );

    console.log(`✅ Advanced EVM config authenticated`);

    // Access to auth manager for additional operations
    const balance = await authManager.getBalance();
    console.log(`💰 Account balance: $${balance}`);

    const profile = await authManager.getProfile();
    console.log(`👤 Profile: ${profile.email || 'No email'}`);

    // Make AI request with advanced config
    const { text } = await generateText({
      model: dreamsRouter('google-vertex/gemini-2.5-flash'),
      prompt: 'What advanced features does Dreams Router support?',
    });

    console.log(`📝 Response: ${text}`);

  } catch (error) {
    console.error('❌ Advanced config example failed:', error);
  }
}

async function main() {
  console.log('🚀 Dreams Router - Separated Authentication Examples');
  console.log('=====================================================');
  console.log('✨ Clean separation: createEVMAuth() vs createSolanaAuth()');
  console.log('🔧 Generic internals, specific auth functions');

  try {
    await evmExample();
    await solanaExample();
    await advancedConfigExample();

    console.log('\n🎉 All examples completed successfully!');
    console.log('\n💡 Architecture Benefits:');
    console.log('  • ✅ Separated concerns: Different auth functions');
    console.log('  • ✅ Generic internals: Shared auth manager');
    console.log('  • ✅ Type safety: EVM vs Solana specific options');
    console.log('  • ✅ Clean imports: Import only what you need');
    console.log('  • ✅ Future-proof: Easy to add new chain types');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { evmExample, solanaExample, advancedConfigExample };