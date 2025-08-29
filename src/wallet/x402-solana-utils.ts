import type { X402PaymentRequirements } from './x402-types';
import type { NodeSolanaSigner } from '../types';
import {
  Keypair,
  PublicKey,
  Connection,
  VersionedTransaction,
  TransactionMessage,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getMint,
  getAssociatedTokenAddressSync,
  createTransferCheckedInstruction,
} from '@solana/spl-token';
import bs58 from 'bs58';

function getDefaultSolanaRpc(network: string): string {
  return network === 'solana'
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com';
}

/**
 * Generate a SOL x402 payment header from server-provided requirements using a Node signer.
 * Returns a base64-encoded JSON string suitable for the X-PAYMENT header.
 */
export async function generateSolanaX402PaymentFromRequirement(
  requirement: X402PaymentRequirements,
  signer: NodeSolanaSigner
): Promise<string> {
  const network = requirement.network as 'solana' | 'solana-devnet';
  const endpoint = signer.rpcUrl || getDefaultSolanaRpc(network);
  const connection = new Connection(endpoint, 'confirmed');

  const secretKey = bs58.decode(signer.secretKeyBase58);
  const user = Keypair.fromSecretKey(secretKey);

  const mint = new PublicKey(requirement.asset);
  const payToOwner = new PublicKey(requirement.payTo);
  const feePayer = requirement.extra?.feePayer
    ? new PublicKey(requirement.extra.feePayer)
    : undefined;
  if (!feePayer) {
    throw new Error('SOL requirement missing extra.feePayer');
  }

  // Detect token program based on mint owner
  const mintInfo = await connection.getAccountInfo(mint);
  const programId =
    mintInfo && 'owner' in mintInfo && (mintInfo as any).owner
      ? ((mintInfo as any).owner as any).equals(TOKEN_2022_PROGRAM_ID)
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID
      : TOKEN_PROGRAM_ID;

  const mintState = await getMint(connection, mint, 'confirmed', programId);
  const decimals = mintState.decimals ?? 6;

  const userAta = getAssociatedTokenAddressSync(
    mint,
    user.publicKey,
    false,
    programId
  );
  const destAta = getAssociatedTokenAddressSync(
    mint,
    payToOwner,
    false,
    programId
  );

  const userAtaInfo = await connection.getAccountInfo(userAta);
  if (!userAtaInfo) {
    throw new Error('Source ATA missing. Ensure the user holds this token.');
  }

  const ix: any[] = [];
  ix.push(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
  ix.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 }));

  const amountU64 = BigInt(requirement.maxAmountRequired);
  ix.push(
    createTransferCheckedInstruction(
      userAta,
      mint,
      destAta,
      user.publicKey,
      amountU64,
      decimals,
      [],
      programId
    )
  );

  const { blockhash } = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: ix,
  }).compileToV0Message();

  const tx = new VersionedTransaction(msg);
  tx.sign([user]);

  const serialized = Buffer.from(tx.serialize());
  const txBase64 = serialized.toString('base64');

  const payload = {
    x402Version: 1,
    scheme: 'exact' as const,
    network,
    payload: { transaction: txBase64 },
  };

  const json = JSON.stringify(payload);
  return Buffer.from(json, 'utf8').toString('base64');
}
