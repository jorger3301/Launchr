/**
 * Initialize Launchr Protocol Configuration
 *
 * Run with: npx ts-node scripts/init-config.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

// Program ID (deployed to devnet)
const PROGRAM_ID = new PublicKey('5LFTkjx2vRTkXaKvYtikEEJkvpTrx16feUspuxKgvsE8');

// WSOL Mint on devnet/mainnet
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Orbit Finance Program ID
const ORBIT_PROGRAM_ID = new PublicKey('STAKEvGqQTtzJZH6BWDcbpzXXn2BBerPAgQ3EGLN2GH');

// Seeds
const CONFIG_SEED = Buffer.from('launchr_config');

// Calculate Anchor instruction discriminator
function getDiscriminator(instructionName: string): Buffer {
  const hash = createHash('sha256')
    .update(`global:${instructionName}`)
    .digest();
  return hash.slice(0, 8);
}

// Borsh serialization helpers
function serializeInitConfigParams(params: {
  feeAuthority: PublicKey;
  protocolFeeBps: number;
  graduationThreshold: bigint;
  orbitProgramId: PublicKey;
  defaultBinStepBps: number;
  defaultBaseFeeBps: number;
}): Buffer {
  const buffer = Buffer.alloc(32 + 2 + 8 + 32 + 2 + 2);
  let offset = 0;

  // fee_authority: Pubkey (32 bytes)
  params.feeAuthority.toBuffer().copy(buffer, offset);
  offset += 32;

  // protocol_fee_bps: u16 (2 bytes)
  buffer.writeUInt16LE(params.protocolFeeBps, offset);
  offset += 2;

  // graduation_threshold: u64 (8 bytes)
  buffer.writeBigUInt64LE(params.graduationThreshold, offset);
  offset += 8;

  // orbit_program_id: Pubkey (32 bytes)
  params.orbitProgramId.toBuffer().copy(buffer, offset);
  offset += 32;

  // default_bin_step_bps: u16 (2 bytes)
  buffer.writeUInt16LE(params.defaultBinStepBps, offset);
  offset += 2;

  // default_base_fee_bps: u16 (2 bytes)
  buffer.writeUInt16LE(params.defaultBaseFeeBps, offset);

  return buffer;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Launchr Protocol Initialization');
  console.log('='.repeat(60));

  // Load wallet
  const walletPath = path.join(process.env.HOME || '', '.config/solana/id.json');
  if (!fs.existsSync(walletPath)) {
    console.error('Wallet not found at:', walletPath);
    console.error('Please create a wallet with: solana-keygen new');
    process.exit(1);
  }

  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const admin = Keypair.fromSecretKey(Uint8Array.from(walletData));
  console.log('Admin wallet:', admin.publicKey.toBase58());

  // Connect to devnet
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  // Check balance
  const balance = await connection.getBalance(admin.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL');

  if (balance < 0.01 * 1e9) {
    console.error('Insufficient balance. Need at least 0.01 SOL');
    console.error('Get devnet SOL: solana airdrop 2');
    process.exit(1);
  }

  // Derive config PDA
  const [configPda, configBump] = PublicKey.findProgramAddressSync(
    [CONFIG_SEED],
    PROGRAM_ID
  );
  console.log('Config PDA:', configPda.toBase58());

  // Check if config already exists
  const configAccount = await connection.getAccountInfo(configPda);
  if (configAccount) {
    console.log('\nConfig already initialized!');
    console.log('Account size:', configAccount.data.length, 'bytes');
    process.exit(0);
  }

  // Build instruction
  console.log('\nInitializing config...');

  // Calculate discriminator
  const discriminator = getDiscriminator('init_config');
  console.log('Discriminator:', discriminator.toString('hex'));

  const params = {
    feeAuthority: admin.publicKey, // Admin receives fees initially
    protocolFeeBps: 100,           // 1% protocol fee
    graduationThreshold: BigInt(85_000_000_000), // 85 SOL
    orbitProgramId: ORBIT_PROGRAM_ID,
    defaultBinStepBps: 25,         // 0.25% bin step
    defaultBaseFeeBps: 30,         // 0.30% base fee
  };

  const instructionData = Buffer.concat([
    discriminator,
    serializeInitConfigParams(params),
  ]);

  console.log('Instruction data length:', instructionData.length);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },  // admin
      { pubkey: configPda, isSigner: false, isWritable: true },       // config
      { pubkey: WSOL_MINT, isSigner: false, isWritable: false },      // quote_mint
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [admin], {
      commitment: 'confirmed',
    });

    console.log('\nConfig initialized successfully!');
    console.log('Signature:', signature);
    console.log('Explorer:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    // Display config
    console.log('\n' + '='.repeat(60));
    console.log('Configuration:');
    console.log('='.repeat(60));
    console.log('Program ID:', PROGRAM_ID.toBase58());
    console.log('Config PDA:', configPda.toBase58());
    console.log('Admin:', admin.publicKey.toBase58());
    console.log('Fee Authority:', params.feeAuthority.toBase58());
    console.log('Protocol Fee:', params.protocolFeeBps / 100, '%');
    console.log('Graduation Threshold:', Number(params.graduationThreshold) / 1e9, 'SOL');
    console.log('Orbit Program:', params.orbitProgramId.toBase58());

  } catch (error: any) {
    console.error('\nTransaction failed:', error.message);
    if (error.logs) {
      console.error('\nLogs:');
      error.logs.forEach((log: string) => console.error('  ', log));
    }
    process.exit(1);
  }
}

main().catch(console.error);
