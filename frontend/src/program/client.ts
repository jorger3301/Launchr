/**
 * Launchr Program Client
 *
 * Handles PDA derivations and transaction building for the Launchr program.
 * This connects the frontend to the on-chain Anchor program.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import BN from 'bn.js';
import {
  LAUNCHR_PROGRAM_ID,
  SEEDS,
  CreateLaunchParams,
  BuyParams,
  SellParams,
  LaunchAccount,
  ConfigAccount,
  CONSTANTS,
} from './idl';

// =============================================================================
// PDA DERIVATION
// =============================================================================

export class LaunchrPDAs {
  constructor(private programId: PublicKey = LAUNCHR_PROGRAM_ID) {}

  /**
   * Derive global config PDA
   */
  config(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [SEEDS.CONFIG],
      this.programId
    );
  }

  /**
   * Derive launch PDA from mint
   */
  launch(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [SEEDS.LAUNCH, mint.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive launch authority PDA
   */
  launchAuthority(launch: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [SEEDS.LAUNCH_AUTHORITY, launch.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive curve vault (SOL) PDA
   */
  curveVault(launch: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [SEEDS.CURVE_VAULT, launch.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive token vault PDA
   */
  tokenVault(launch: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [SEEDS.TOKEN_VAULT, launch.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive graduation vault PDA
   */
  graduationVault(launch: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [SEEDS.GRADUATION_VAULT, launch.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive user position PDA
   */
  userPosition(launch: PublicKey, user: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [SEEDS.USER_POSITION, launch.toBuffer(), user.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive fee vault PDA
   */
  feeVault(config: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [SEEDS.FEE_VAULT, config.toBuffer()],
      this.programId
    );
  }
}

// =============================================================================
// INSTRUCTION BUILDERS
// =============================================================================

/**
 * Anchor instruction discriminators (first 8 bytes of sha256("global:<instruction_name>"))
 */
const DISCRIMINATORS = {
  createLaunch: Buffer.from([137, 42, 226, 107, 34, 208, 200, 252]),
  buy: Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]),
  sell: Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]),
};

/**
 * Serialize CreateLaunchParams
 */
function serializeCreateLaunchParams(params: CreateLaunchParams): Buffer {
  const nameBytes = Buffer.from(params.name, 'utf-8');
  const symbolBytes = Buffer.from(params.symbol, 'utf-8');
  const uriBytes = Buffer.from(params.uri, 'utf-8');
  const twitterBytes = params.twitter ? Buffer.from(params.twitter, 'utf-8') : Buffer.alloc(0);
  const telegramBytes = params.telegram ? Buffer.from(params.telegram, 'utf-8') : Buffer.alloc(0);
  const websiteBytes = params.website ? Buffer.from(params.website, 'utf-8') : Buffer.alloc(0);

  // Calculate total size
  // String format: 4 bytes length + content
  // Option<String> format: 1 byte (0/1) + if 1: 4 bytes length + content
  const size = 8 + // discriminator
    4 + nameBytes.length +
    4 + symbolBytes.length +
    4 + uriBytes.length +
    1 + (params.twitter ? 4 + twitterBytes.length : 0) +
    1 + (params.telegram ? 4 + telegramBytes.length : 0) +
    1 + (params.website ? 4 + websiteBytes.length : 0) +
    2; // creator_fee_bps (u16)

  const buffer = Buffer.alloc(size);
  let offset = 0;

  // Discriminator
  DISCRIMINATORS.createLaunch.copy(buffer, offset);
  offset += 8;

  // Name (String)
  buffer.writeUInt32LE(nameBytes.length, offset);
  offset += 4;
  nameBytes.copy(buffer, offset);
  offset += nameBytes.length;

  // Symbol (String)
  buffer.writeUInt32LE(symbolBytes.length, offset);
  offset += 4;
  symbolBytes.copy(buffer, offset);
  offset += symbolBytes.length;

  // URI (String)
  buffer.writeUInt32LE(uriBytes.length, offset);
  offset += 4;
  uriBytes.copy(buffer, offset);
  offset += uriBytes.length;

  // Twitter (Option<String>)
  if (params.twitter) {
    buffer.writeUInt8(1, offset);
    offset += 1;
    buffer.writeUInt32LE(twitterBytes.length, offset);
    offset += 4;
    twitterBytes.copy(buffer, offset);
    offset += twitterBytes.length;
  } else {
    buffer.writeUInt8(0, offset);
    offset += 1;
  }

  // Telegram (Option<String>)
  if (params.telegram) {
    buffer.writeUInt8(1, offset);
    offset += 1;
    buffer.writeUInt32LE(telegramBytes.length, offset);
    offset += 4;
    telegramBytes.copy(buffer, offset);
    offset += telegramBytes.length;
  } else {
    buffer.writeUInt8(0, offset);
    offset += 1;
  }

  // Website (Option<String>)
  if (params.website) {
    buffer.writeUInt8(1, offset);
    offset += 1;
    buffer.writeUInt32LE(websiteBytes.length, offset);
    offset += 4;
    websiteBytes.copy(buffer, offset);
    offset += websiteBytes.length;
  } else {
    buffer.writeUInt8(0, offset);
    offset += 1;
  }

  // Creator fee BPS (u16)
  buffer.writeUInt16LE(params.creatorFeeBps, offset);

  return buffer.slice(0, offset + 2);
}

/**
 * Serialize BuyParams
 */
function serializeBuyParams(params: BuyParams): Buffer {
  const buffer = Buffer.alloc(8 + 8 + 8); // discriminator + sol_amount + min_tokens_out
  DISCRIMINATORS.buy.copy(buffer, 0);
  params.solAmount.toArrayLike(Buffer, 'le', 8).copy(buffer, 8);
  params.minTokensOut.toArrayLike(Buffer, 'le', 8).copy(buffer, 16);
  return buffer;
}

/**
 * Serialize SellParams
 */
function serializeSellParams(params: SellParams): Buffer {
  const buffer = Buffer.alloc(8 + 8 + 8); // discriminator + token_amount + min_sol_out
  DISCRIMINATORS.sell.copy(buffer, 0);
  params.tokenAmount.toArrayLike(Buffer, 'le', 8).copy(buffer, 8);
  params.minSolOut.toArrayLike(Buffer, 'le', 8).copy(buffer, 16);
  return buffer;
}

// =============================================================================
// LAUNCHR CLIENT
// =============================================================================

export class LaunchrClient {
  private pdas: LaunchrPDAs;

  constructor(
    private connection: Connection,
    private programId: PublicKey = LAUNCHR_PROGRAM_ID
  ) {
    this.pdas = new LaunchrPDAs(programId);
  }

  // ---------------------------------------------------------------------------
  // ACCOUNT FETCHING
  // ---------------------------------------------------------------------------

  /**
   * Fetch config account
   */
  async fetchConfig(): Promise<ConfigAccount | null> {
    const [configPda] = this.pdas.config();
    const accountInfo = await this.connection.getAccountInfo(configPda);
    if (!accountInfo) return null;
    // Note: Full deserialization would require Anchor's BorshCoder
    // For now, return raw data indication
    return accountInfo.data as any;
  }

  /**
   * Fetch launch account
   */
  async fetchLaunch(mint: PublicKey): Promise<LaunchAccount | null> {
    const [launchPda] = this.pdas.launch(mint);
    const accountInfo = await this.connection.getAccountInfo(launchPda);
    if (!accountInfo) return null;
    return accountInfo.data as any;
  }

  // ---------------------------------------------------------------------------
  // TRANSACTION BUILDERS
  // ---------------------------------------------------------------------------

  /**
   * Build create launch transaction
   */
  async buildCreateLaunchTx(
    creator: PublicKey,
    params: CreateLaunchParams
  ): Promise<{ transaction: Transaction; mint: Keypair }> {
    // Generate new mint keypair
    const mint = Keypair.generate();

    // Derive PDAs
    const [configPda] = this.pdas.config();
    const [launchPda] = this.pdas.launch(mint.publicKey);
    const [launchAuthority] = this.pdas.launchAuthority(launchPda);
    const [tokenVault] = this.pdas.tokenVault(launchPda);
    const [graduationVault] = this.pdas.graduationVault(launchPda);

    // Build instruction
    const instruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: mint.publicKey, isSigner: true, isWritable: true },
        { pubkey: launchPda, isSigner: false, isWritable: true },
        { pubkey: launchAuthority, isSigner: false, isWritable: false },
        { pubkey: tokenVault, isSigner: false, isWritable: true },
        { pubkey: graduationVault, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: serializeCreateLaunchParams(params),
    });

    const transaction = new Transaction().add(instruction);

    return { transaction, mint };
  }

  /**
   * Build buy transaction
   */
  async buildBuyTx(
    buyer: PublicKey,
    launchPk: PublicKey,
    mint: PublicKey,
    creator: PublicKey,
    params: BuyParams
  ): Promise<Transaction> {
    // Derive PDAs
    const [configPda] = this.pdas.config();
    const [launchAuthority] = this.pdas.launchAuthority(launchPk);
    const [tokenVault] = this.pdas.tokenVault(launchPk);
    const [curveVault] = this.pdas.curveVault(launchPk);
    const [userPosition] = this.pdas.userPosition(launchPk, buyer);
    const [feeVault] = this.pdas.feeVault(configPda);

    // Get buyer's ATA
    const buyerAta = await getAssociatedTokenAddress(mint, buyer);

    const transaction = new Transaction();

    // Check if buyer's ATA exists, create if not
    try {
      await getAccount(this.connection, buyerAta);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          buyer,
          buyerAta,
          buyer,
          mint
        )
      );
    }

    // Build buy instruction
    const buyInstruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: launchPk, isSigner: false, isWritable: true },
        { pubkey: launchAuthority, isSigner: false, isWritable: false },
        { pubkey: tokenVault, isSigner: false, isWritable: true },
        { pubkey: curveVault, isSigner: false, isWritable: true },
        { pubkey: buyerAta, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: userPosition, isSigner: false, isWritable: true },
        { pubkey: feeVault, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: serializeBuyParams(params),
    });

    transaction.add(buyInstruction);

    return transaction;
  }

  /**
   * Build sell transaction
   */
  async buildSellTx(
    seller: PublicKey,
    launchPk: PublicKey,
    mint: PublicKey,
    creator: PublicKey,
    params: SellParams
  ): Promise<Transaction> {
    // Derive PDAs
    const [configPda] = this.pdas.config();
    const [launchAuthority] = this.pdas.launchAuthority(launchPk);
    const [tokenVault] = this.pdas.tokenVault(launchPk);
    const [curveVault] = this.pdas.curveVault(launchPk);
    const [userPosition] = this.pdas.userPosition(launchPk, seller);
    const [feeVault] = this.pdas.feeVault(configPda);

    // Get seller's ATA
    const sellerAta = await getAssociatedTokenAddress(mint, seller);

    // Build sell instruction
    const sellInstruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: seller, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: launchPk, isSigner: false, isWritable: true },
        { pubkey: launchAuthority, isSigner: false, isWritable: false },
        { pubkey: tokenVault, isSigner: false, isWritable: true },
        { pubkey: curveVault, isSigner: false, isWritable: true },
        { pubkey: sellerAta, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: userPosition, isSigner: false, isWritable: true },
        { pubkey: feeVault, isSigner: false, isWritable: true },
        { pubkey: creator, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: serializeSellParams(params),
    });

    return new Transaction().add(sellInstruction);
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  /**
   * Calculate tokens out for a buy
   * Uses constant product formula: x * y = k
   */
  calculateBuyOutput(
    solAmount: BN,
    virtualSolReserve: BN,
    virtualTokenReserve: BN,
    protocolFeeBps: number = 100,
    creatorFeeBps: number = 0
  ): { tokensOut: BN; priceImpact: number } {
    // Calculate fees
    const totalFeeBps = protocolFeeBps + creatorFeeBps;
    const feeAmount = solAmount.muln(totalFeeBps).divn(10000);
    const solIn = solAmount.sub(feeAmount);

    // Constant product: (x + dx) * (y - dy) = x * y
    // dy = y * dx / (x + dx)
    const tokensOut = virtualTokenReserve
      .mul(solIn)
      .div(virtualSolReserve.add(solIn));

    // Price impact
    const priceBefore = virtualSolReserve.toNumber() / virtualTokenReserve.toNumber();
    const priceAfter = virtualSolReserve.add(solIn).toNumber() /
                       virtualTokenReserve.sub(tokensOut).toNumber();
    const priceImpact = ((priceAfter - priceBefore) / priceBefore) * 100;

    return { tokensOut, priceImpact };
  }

  /**
   * Calculate SOL out for a sell
   */
  calculateSellOutput(
    tokenAmount: BN,
    virtualSolReserve: BN,
    virtualTokenReserve: BN,
    protocolFeeBps: number = 100,
    creatorFeeBps: number = 0
  ): { solOut: BN; priceImpact: number } {
    // Constant product: (x - dx) * (y + dy) = x * y
    // dx = x * dy / (y + dy)
    const grossSolOut = virtualSolReserve
      .mul(tokenAmount)
      .div(virtualTokenReserve.add(tokenAmount));

    // Calculate fees
    const totalFeeBps = protocolFeeBps + creatorFeeBps;
    const feeAmount = grossSolOut.muln(totalFeeBps).divn(10000);
    const solOut = grossSolOut.sub(feeAmount);

    // Price impact
    const priceBefore = virtualSolReserve.toNumber() / virtualTokenReserve.toNumber();
    const priceAfter = virtualSolReserve.sub(grossSolOut).toNumber() /
                       virtualTokenReserve.add(tokenAmount).toNumber();
    const priceImpact = ((priceBefore - priceAfter) / priceBefore) * 100;

    return { solOut, priceImpact };
  }

  /**
   * Get launch PDA from mint
   */
  getLaunchPda(mint: PublicKey): PublicKey {
    const [launchPda] = this.pdas.launch(mint);
    return launchPda;
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let launchrClient: LaunchrClient | null = null;

export function initLaunchrClient(connection: Connection): LaunchrClient {
  launchrClient = new LaunchrClient(connection);
  return launchrClient;
}

export function getLaunchrClient(): LaunchrClient | null {
  return launchrClient;
}
