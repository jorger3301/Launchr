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
  getMint,
} from '@solana/spl-token';
import BN from 'bn.js';
import {
  LAUNCHR_PROGRAM_ID,
  SEEDS,
  CreateLaunchParams,
  BuyParams,
  SellParams,
  GraduateParams,
  LaunchAccount,
  LaunchStatus,
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
  createLaunch: Buffer.from([239, 223, 255, 134, 39, 121, 127, 62]), // sha256("global:create_launch")[0:8]
  buy: Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]),             // sha256("global:buy")[0:8]
  sell: Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]),          // sha256("global:sell")[0:8]
  graduate: Buffer.from([45, 235, 225, 181, 17, 218, 64, 130]),      // sha256("global:graduate")[0:8]
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

/**
 * Serialize GraduateParams
 * Options encoded as: 1 byte (0=None, 1=Some) + value if Some
 */
function serializeGraduateParams(params: GraduateParams): Buffer {
  // discriminator (8) + Option<u16> (1 + 2) + Option<u8> (1 + 1) = max 13 bytes
  const buffer = Buffer.alloc(13);
  let offset = 0;

  // Discriminator
  DISCRIMINATORS.graduate.copy(buffer, offset);
  offset += 8;

  // bin_step_bps: Option<u16>
  if (params.binStepBps !== null) {
    buffer.writeUInt8(1, offset); // Some
    offset += 1;
    buffer.writeUInt16LE(params.binStepBps, offset);
    offset += 2;
  } else {
    buffer.writeUInt8(0, offset); // None
    offset += 1;
  }

  // num_liquidity_bins: Option<u8>
  if (params.numLiquidityBins !== null) {
    buffer.writeUInt8(1, offset); // Some
    offset += 1;
    buffer.writeUInt8(params.numLiquidityBins, offset);
    offset += 1;
  } else {
    buffer.writeUInt8(0, offset); // None
    offset += 1;
  }

  return buffer.slice(0, offset);
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
   * Fetch and deserialize config account
   */
  async fetchConfig(): Promise<ConfigAccount | null> {
    const [configPda] = this.pdas.config();
    const accountInfo = await this.connection.getAccountInfo(configPda);
    if (!accountInfo) return null;

    const data = Buffer.from(accountInfo.data);
    // Minimum: disc(8) + admin(32) + fee_auth(32) + fee_bps(2) + grad(8) + quote(32) +
    // orbit(32) + bin(2) + base(2) + paused(2) + stats(8+8+16+8) + bump(1) = 193
    if (data.length < 193) {
      console.error('Config account data too short:', data.length);
      return null;
    }
    let off = 8; // skip discriminator
    const admin = new PublicKey(data.slice(off, off + 32)); off += 32;
    const feeAuthority = new PublicKey(data.slice(off, off + 32)); off += 32;
    const protocolFeeBps = data.readUInt16LE(off); off += 2;
    const graduationThreshold = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const quoteMint = new PublicKey(data.slice(off, off + 32)); off += 32;
    const orbitProgramId = new PublicKey(data.slice(off, off + 32)); off += 32;
    const defaultBinStepBps = data.readUInt16LE(off); off += 2;
    const defaultBaseFeeBps = data.readUInt16LE(off); off += 2;
    const launchesPaused = data[off] !== 0; off += 1;
    const tradingPaused = data[off] !== 0; off += 1;
    const totalLaunches = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const totalGraduations = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const totalVolumeLamports = new BN(data.slice(off, off + 16), 'le'); off += 16;
    const totalFeesCollected = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const bump = data[off]; off += 1;

    return {
      admin, feeAuthority, protocolFeeBps, graduationThreshold,
      quoteMint, orbitProgramId, defaultBinStepBps, defaultBaseFeeBps,
      launchesPaused, tradingPaused, totalLaunches, totalGraduations,
      totalVolumeLamports, totalFeesCollected, bump,
    };
  }

  /**
   * Fetch and deserialize launch account
   */
  async fetchLaunch(mint: PublicKey): Promise<LaunchAccount | null> {
    const [launchPda] = this.pdas.launch(mint);
    const accountInfo = await this.connection.getAccountInfo(launchPda);
    if (!accountInfo) return null;

    const data = Buffer.from(accountInfo.data);
    // Minimum: disc(8) + mint(32) + creator(32) + status(1) + fields...authority_bump(1) = 675
    if (data.length < 675) {
      console.error('Launch account data too short:', data.length);
      return null;
    }
    let off = 8; // skip discriminator
    const mintPk = new PublicKey(data.slice(off, off + 32)); off += 32;
    const creator = new PublicKey(data.slice(off, off + 32)); off += 32;
    const statusByte = data[off]; off += 1;
    if (statusByte > 3) {
      console.error('Invalid LaunchStatus value:', statusByte);
      return null;
    }
    const status: LaunchStatus = statusByte;
    const totalSupply = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const tokensSold = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const graduationTokens = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const creatorTokens = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const virtualSolReserve = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const virtualTokenReserve = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const realSolReserve = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const realTokenReserve = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const graduationThreshold = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const createdAt = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const graduatedAt = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const buyVolume = new BN(data.slice(off, off + 16), 'le'); off += 16;
    const sellVolume = new BN(data.slice(off, off + 16), 'le'); off += 16;
    const tradeCount = new BN(data.slice(off, off + 8), 'le'); off += 8;
    const holderCount = data.readUInt32LE(off); off += 4;
    const orbitPool = new PublicKey(data.slice(off, off + 32)); off += 32;
    const creatorFeeBps = data.readUInt16LE(off); off += 2;
    const name = Array.from(data.slice(off, off + 32)); off += 32;
    const symbol = Array.from(data.slice(off, off + 10)); off += 10;
    const uri = Array.from(data.slice(off, off + 200)); off += 200;
    const twitter = Array.from(data.slice(off, off + 64)); off += 64;
    const telegram = Array.from(data.slice(off, off + 64)); off += 64;
    const website = Array.from(data.slice(off, off + 64)); off += 64;
    const bump = data[off]; off += 1;
    const authorityBump = data[off]; off += 1;

    return {
      mint: mintPk, creator, status, totalSupply, tokensSold,
      graduationTokens, creatorTokens, virtualSolReserve, virtualTokenReserve,
      realSolReserve, realTokenReserve, graduationThreshold, createdAt,
      graduatedAt, buyVolume, sellVolume, tradeCount, holderCount,
      orbitPool, creatorFeeBps, name, symbol, uri, twitter, telegram,
      website, bump, authorityBump,
    };
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

  /**
   * Build graduate transaction
   * Graduates a launch from bonding curve to Orbit Finance DLMM
   *
   * Distribution when graduation threshold (85 SOL) is reached:
   * - 80 SOL → Orbit Finance DLMM LP
   * - 2 SOL  → Token creator reward
   * - 3 SOL  → Launchr treasury
   */
  async buildGraduateTx(
    payer: PublicKey,
    launchPk: PublicKey,
    mint: PublicKey,
    creator: PublicKey,
    treasury: PublicKey,
    quoteMint: PublicKey,
    orbitProgramId: PublicKey,
    params: GraduateParams = { binStepBps: null, numLiquidityBins: null }
  ): Promise<Transaction> {
    // Derive Launchr PDAs
    const [configPda] = this.pdas.config();
    const [launchAuthority] = this.pdas.launchAuthority(launchPk);
    const [tokenVault] = this.pdas.tokenVault(launchPk);
    const [graduationVault] = this.pdas.graduationVault(launchPk);
    const [curveVault] = this.pdas.curveVault(launchPk);

    // Derive Orbit Finance PDAs
    // Pool PDA: [pool, base_mint, quote_mint] from Orbit program
    // IMPORTANT: Mints must be in canonical order (smaller pubkey first)
    const mintBytes = mint.toBuffer();
    const quoteMintBytes = quoteMint.toBuffer();
    const [canonicalBase, canonicalQuote] = mintBytes.compare(quoteMintBytes) < 0
      ? [mintBytes, quoteMintBytes]
      : [quoteMintBytes, mintBytes];

    const [orbitPool] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), canonicalBase, canonicalQuote],
      orbitProgramId
    );

    // Registry PDA: [registry, base_mint, quote_mint] from Orbit program
    const [orbitRegistry] = PublicKey.findProgramAddressSync(
      [Buffer.from('registry'), canonicalBase, canonicalQuote],
      orbitProgramId
    );

    // Base vault PDA: ["vault", pool, "base"]
    const [orbitBaseVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), orbitPool.toBuffer(), Buffer.from('base')],
      orbitProgramId
    );

    // Quote vault PDA: ["vault", pool, "quote"]
    const [orbitQuoteVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), orbitPool.toBuffer(), Buffer.from('quote')],
      orbitProgramId
    );

    // Creator fee vault PDA: ["vault", pool, "creator_fee"]
    const [orbitCreatorFeeVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), orbitPool.toBuffer(), Buffer.from('creator_fee')],
      orbitProgramId
    );

    // Holders fee vault PDA: ["vault", pool, "holders_fee"]
    const [orbitHoldersFeeVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), orbitPool.toBuffer(), Buffer.from('holders_fee')],
      orbitProgramId
    );

    // NFT fee vault PDA: ["vault", pool, "nft_fee"]
    const [orbitNftFeeVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), orbitPool.toBuffer(), Buffer.from('nft_fee')],
      orbitProgramId
    );

    // Protocol fee vault PDA: ["vault", pool, "protocol_fee"]
    const [orbitProtocolFeeVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), orbitPool.toBuffer(), Buffer.from('protocol_fee')],
      orbitProgramId
    );

    // Bin array PDA: ["bin_array", pool, bin_array_index]
    // For initial graduation, we use bin_array_index = 0
    const binArrayIndex = Buffer.alloc(4);
    binArrayIndex.writeInt32LE(0, 0);
    const [orbitBinArray] = PublicKey.findProgramAddressSync(
      [Buffer.from('bin_array'), orbitPool.toBuffer(), binArrayIndex],
      orbitProgramId
    );

    // Position PDA: ["position", pool, owner, nonce]
    // For graduation, owner is launch_authority and nonce is 0
    const positionNonce = Buffer.alloc(8);
    positionNonce.writeBigUInt64LE(BigInt(0), 0);
    const [orbitPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), orbitPool.toBuffer(), launchAuthority.toBuffer(), positionNonce],
      orbitProgramId
    );

    // Build graduate instruction
    const graduateInstruction = new TransactionInstruction({
      programId: this.programId,
      keys: [
        // Payer (anyone can trigger graduation once threshold is reached)
        { pubkey: payer, isSigner: true, isWritable: true },
        // Global config
        { pubkey: configPda, isSigner: false, isWritable: true },
        // Launch account
        { pubkey: launchPk, isSigner: false, isWritable: true },
        // Launch authority PDA
        { pubkey: launchAuthority, isSigner: false, isWritable: false },
        // Token creator - receives 2 SOL reward
        { pubkey: creator, isSigner: false, isWritable: true },
        // Treasury - receives 3 SOL fee
        { pubkey: treasury, isSigner: false, isWritable: true },
        // Token mint
        { pubkey: mint, isSigner: false, isWritable: true },
        // Quote mint (WSOL)
        { pubkey: quoteMint, isSigner: false, isWritable: false },
        // Token vault (bonding curve tokens)
        { pubkey: tokenVault, isSigner: false, isWritable: true },
        // LP reserve token vault (20% for DLMM migration)
        { pubkey: graduationVault, isSigner: false, isWritable: true },
        // SOL curve vault
        { pubkey: curveVault, isSigner: false, isWritable: true },
        // Orbit Finance accounts
        { pubkey: orbitProgramId, isSigner: false, isWritable: false },
        { pubkey: orbitPool, isSigner: false, isWritable: true },
        { pubkey: orbitRegistry, isSigner: false, isWritable: true },
        { pubkey: orbitBaseVault, isSigner: false, isWritable: true },
        { pubkey: orbitQuoteVault, isSigner: false, isWritable: true },
        { pubkey: orbitCreatorFeeVault, isSigner: false, isWritable: true },
        { pubkey: orbitHoldersFeeVault, isSigner: false, isWritable: true },
        { pubkey: orbitNftFeeVault, isSigner: false, isWritable: true },
        { pubkey: orbitProtocolFeeVault, isSigner: false, isWritable: true },
        { pubkey: orbitBinArray, isSigner: false, isWritable: true },
        { pubkey: orbitPosition, isSigner: false, isWritable: true },
        // System programs
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: serializeGraduateParams(params),
    });

    return new Transaction().add(graduateInstruction);
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  /**
   * Calculate tokens out for a buy
   * Uses constant product formula: x * y = k
   *
   * Fee structure (on-chain):
   * - Total fee = protocolFeeBps (1% = 100 bps)
   * - Creator gets creatorFeeBps (0.2% = 20 bps) FROM the protocol fee
   * - Treasury gets the remainder (0.8% = 80 bps)
   *
   * Note: creatorFeeBps is part of protocolFeeBps, not added to it!
   */
  calculateBuyOutput(
    solAmount: BN,
    virtualSolReserve: BN,
    virtualTokenReserve: BN,
    protocolFeeBps: number = 100,
    _creatorFeeBps: number = 20 // Unused in calculation - it's part of protocolFeeBps
  ): { tokensOut: BN; priceImpact: number } {
    // Calculate fees - creator fee comes FROM protocol fee, not added to it
    // Total fee is just protocolFeeBps (1%)
    const feeAmount = solAmount.muln(protocolFeeBps).divn(10000);
    const solIn = solAmount.sub(feeAmount);

    // Constant product: (x + dx) * (y - dy) = x * y
    // dy = y * dx / (x + dx)
    const tokensOut = virtualTokenReserve
      .mul(solIn)
      .div(virtualSolReserve.add(solIn));

    // Price impact using BN cross-multiplication to avoid precision loss
    // priceRatio = (solAfter/tokenAfter) / (solBefore/tokenBefore)
    //            = (solAfter * tokenBefore) / (solBefore * tokenAfter)
    const IMPACT_PRECISION = new BN(1_000_000);
    const solAfter = virtualSolReserve.add(solIn);
    const tokenAfter = virtualTokenReserve.sub(tokensOut);
    const ratioScaled = solAfter.mul(virtualTokenReserve).mul(IMPACT_PRECISION)
      .div(virtualSolReserve.mul(tokenAfter));
    const priceImpact = (ratioScaled.toNumber() / 1_000_000 - 1) * 100;

    return { tokensOut, priceImpact };
  }

  /**
   * Calculate SOL out for a sell
   *
   * Fee structure (on-chain):
   * - Total fee = protocolFeeBps (1% = 100 bps)
   * - Creator gets creatorFeeBps (0.2% = 20 bps) FROM the protocol fee
   * - Treasury gets the remainder (0.8% = 80 bps)
   *
   * Note: creatorFeeBps is part of protocolFeeBps, not added to it!
   */
  calculateSellOutput(
    tokenAmount: BN,
    virtualSolReserve: BN,
    virtualTokenReserve: BN,
    protocolFeeBps: number = 100,
    _creatorFeeBps: number = 20 // Unused in calculation - it's part of protocolFeeBps
  ): { solOut: BN; priceImpact: number } {
    // Constant product: (x - dx) * (y + dy) = x * y
    // dx = x * dy / (y + dy)
    const grossSolOut = virtualSolReserve
      .mul(tokenAmount)
      .div(virtualTokenReserve.add(tokenAmount));

    // Calculate fees - creator fee comes FROM protocol fee, not added to it
    // Total fee is just protocolFeeBps (1%)
    const feeAmount = grossSolOut.muln(protocolFeeBps).divn(10000);
    const solOut = grossSolOut.sub(feeAmount);

    // Price impact using BN cross-multiplication to avoid precision loss
    // priceRatio = (solBefore/tokenBefore) / (solAfter/tokenAfter)
    //            = (solBefore * tokenAfter) / (solAfter * tokenBefore)
    const IMPACT_PRECISION = new BN(1_000_000);
    const solAfter = virtualSolReserve.sub(grossSolOut);
    const tokenAfter = virtualTokenReserve.add(tokenAmount);
    const ratioScaled = virtualSolReserve.mul(tokenAfter).mul(IMPACT_PRECISION)
      .div(solAfter.mul(virtualTokenReserve));
    const priceImpact = (ratioScaled.toNumber() / 1_000_000 - 1) * 100;

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
// MINT HELPERS
// =============================================================================

/**
 * Check the mint authority and supply for a given mint.
 * Used for graduation pre-flight: if authority is null, mint was already revoked.
 */
export async function checkMintAuthority(
  connection: Connection,
  mintAddress: PublicKey
): Promise<{ authority: PublicKey | null; supply: bigint }> {
  const mintInfo = await getMint(connection, mintAddress);
  return {
    authority: mintInfo.mintAuthority,
    supply: mintInfo.supply,
  };
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
