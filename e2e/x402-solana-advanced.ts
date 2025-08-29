/**
 * Advanced Solana x402 payment example
 * Shows how to create a Solana signer from various key formats
 */

import { generateText } from 'ai';
import { createDreamsRouter } from '@/src';

// Method 1: Direct base58 secret key (most common)
const solanaSigner = {
  type: 'node' as const,
  secretKeyBase58: process.env.SOLANA_SECRET_KEY || '',
  rpcUrl: process.env.SOLANA_RPC_URL,
};

// Method 2: Convert from byte array (if you have Uint8Array)
// const secretKeyBytes = new Uint8Array([...]); // 64 bytes
// const solanaSigner = {
//   type: 'node' as const,
//   secretKeyBase58: btoa(String.fromCharCode(...secretKeyBytes)),
//   rpcUrl: process.env.SOLANA_RPC_URL,
// };

// Method 3: From Solana CLI keypair file (JSON array format)
// import fs from 'fs';
// const keypairData = JSON.parse(fs.readFileSync('~/.config/solana/id.json', 'utf8'));
// const solanaSigner = {
//   type: 'node' as const,
//   secretKeyBase58: btoa(String.fromCharCode(...new Uint8Array(keypairData))),
//   rpcUrl: process.env.SOLANA_RPC_URL,
// };

const dreamsrouter = createDreamsRouter.solana(solanaSigner, {
  baseURL: process.env.ROUTER_BASE_URL || 'http://localhost:8080',
  network: 'solana-devnet',
  validityDuration: 300, // 5 minutes
});

console.log('Testing Solana x402 payments...\n');

try {
  const { text } = await generateText({
    model: dreamsrouter('google-vertex/gemini-2.5-flash'),
    prompt: 'Explain Solana blockchain in one sentence',
  });

  console.log('✅ Success:', text);
  console.log('\n💡 Payment was automatically handled via Solana x402!');
} catch (error) {
  console.error('❌ Error:', (error as Error).message);
  console.log('\n🔧 Make sure SOLANA_SECRET_KEY is set correctly');
  console.log('   Expected format: base58-encoded 64-byte secret key');
}
