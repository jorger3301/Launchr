/**
 * Solana Service
 * 
 * Handles all Solana RPC interactions for the Launchr protocol.
 */

import { Connection, PublicKey, AccountInfo, ParsedTransactionWithMeta } from '@solana/web3.js';
import { BorshAccountsCoder, Program, AnchorProvider } from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { logger } from '../utils/logger';
import { LaunchAccount, ConfigAccount, UserPositionAccount, TradeEvent } from '../models/accounts';

// =============================================================================
// IDL (Interface Definition)
// =============================================================================

// Simplified IDL for account parsing
const LAUNCHR_IDL = {
  version: '1.0.0',
  name: 'launchr',
  accounts: [
    {
      name: 'Config',
      type: {
        kind: 'struct',
        fields: [
          { name: 'admin', type: 'publicKey' },
          { name: 'feeAuthority', type: 'publicKey' },
          { name: 'protocolFeeBps', type: 'u16' },
          { name: 'graduationThreshold', type: 'u64' },
          { name: 'quoteMint', type: 'publicKey' },
          { name: 'orbitProgramId', type: 'publicKey' },
          { name: 'defaultBinStepBps', type: 'u16' },
          { name: 'defaultBaseFeeBps', type: 'u16' },
          { name: 'launchesPaused', type: 'bool' },
          { name: 'tradingPaused', type: 'bool' },
          { name: 'totalLaunches', type: 'u64' },
          { name: 'totalGraduations', type: 'u64' },
          { name: 'totalVolumeLamports', type: 'u128' },
          { name: 'totalFeesCollected', type: 'u64' },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
    {
      name: 'Launch',
      type: {
        kind: 'struct',
        fields: [
          { name: 'mint', type: 'publicKey' },
          { name: 'creator', type: 'publicKey' },
          { name: 'status', type: 'u8' },
          { name: 'totalSupply', type: 'u64' },
          { name: 'tokensSold', type: 'u64' },
          { name: 'graduationTokens', type: 'u64' },
          { name: 'creatorTokens', type: 'u64' },
          { name: 'virtualSolReserve', type: 'u64' },
          { name: 'virtualTokenReserve', type: 'u64' },
          { name: 'realSolReserve', type: 'u64' },
          { name: 'realTokenReserve', type: 'u64' },
          { name: 'graduationThreshold', type: 'u64' },
          { name: 'createdAt', type: 'i64' },
          { name: 'graduatedAt', type: 'i64' },
          { name: 'buyVolume', type: 'u128' },
          { name: 'sellVolume', type: 'u128' },
          { name: 'tradeCount', type: 'u64' },
          { name: 'holderCount', type: 'u32' },
          { name: 'orbitPool', type: 'publicKey' },
          { name: 'creatorFeeBps', type: 'u16' },
          { name: 'name', type: { array: ['u8', 32] } },
          { name: 'symbol', type: { array: ['u8', 10] } },
          { name: 'uri', type: { array: ['u8', 200] } },
          { name: 'twitter', type: { array: ['u8', 64] } },
          { name: 'telegram', type: { array: ['u8', 64] } },
          { name: 'website', type: { array: ['u8', 64] } },
          { name: 'bump', type: 'u8' },
          { name: 'authorityBump', type: 'u8' },
        ],
      },
    },
    {
      name: 'UserPosition',
      type: {
        kind: 'struct',
        fields: [
          { name: 'launch', type: 'publicKey' },
          { name: 'user', type: 'publicKey' },
          { name: 'tokensBought', type: 'u64' },
          { name: 'tokensSold', type: 'u64' },
          { name: 'tokenBalance', type: 'u64' },
          { name: 'solSpent', type: 'u64' },
          { name: 'solReceived', type: 'u64' },
          { name: 'firstTradeAt', type: 'i64' },
          { name: 'lastTradeAt', type: 'i64' },
          { name: 'buyCount', type: 'u32' },
          { name: 'sellCount', type: 'u32' },
          { name: 'avgBuyPrice', type: 'u64' },
          { name: 'costBasis', type: 'u64' },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
  ],
};

// =============================================================================
// SOLANA SERVICE
// =============================================================================

export class SolanaService {
  private connection: Connection;
  private programId: PublicKey;

  constructor(rpcEndpoint: string, programId: string) {
    this.connection = new Connection(rpcEndpoint, 'confirmed');
    this.programId = new PublicKey(programId);
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  getConnection(): Connection {
    return this.connection;
  }

  getProgramId(): PublicKey {
    return this.programId;
  }

  // ---------------------------------------------------------------------------
  // PDA Derivation
  // ---------------------------------------------------------------------------

  deriveConfigPda(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('launchr_config')],
      this.programId
    );
  }

  deriveLaunchPda(mint: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('launch'), mint.toBuffer()],
      this.programId
    );
  }

  deriveUserPositionPda(launch: PublicKey, user: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_position'), launch.toBuffer(), user.toBuffer()],
      this.programId
    );
  }

  // ---------------------------------------------------------------------------
  // Account Fetching
  // ---------------------------------------------------------------------------

  async getConfig(): Promise<ConfigAccount | null> {
    try {
      const [configPda] = this.deriveConfigPda();
      const accountInfo = await this.connection.getAccountInfo(configPda);
      
      if (!accountInfo) return null;
      
      return this.parseConfigAccount(accountInfo);
    } catch (error) {
      logger.error('Failed to get config:', error);
      return null;
    }
  }

  async getAllLaunches(): Promise<LaunchAccount[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          { dataSize: 800 }, // Launch account size
        ],
      });

      return accounts
        .map(({ pubkey, account }) => this.parseLaunchAccount(pubkey, account))
        .filter((launch): launch is LaunchAccount => launch !== null);
    } catch (error) {
      logger.error('Failed to get all launches:', error);
      return [];
    }
  }

  async getLaunch(publicKey: PublicKey): Promise<LaunchAccount | null> {
    try {
      const accountInfo = await this.connection.getAccountInfo(publicKey);
      if (!accountInfo) return null;
      
      return this.parseLaunchAccount(publicKey, accountInfo);
    } catch (error) {
      logger.error('Failed to get launch:', error);
      return null;
    }
  }

  async getUserPosition(launch: PublicKey, user: PublicKey): Promise<UserPositionAccount | null> {
    try {
      const [positionPda] = this.deriveUserPositionPda(launch, user);
      const accountInfo = await this.connection.getAccountInfo(positionPda);
      
      if (!accountInfo) return null;
      
      return this.parseUserPositionAccount(positionPda, accountInfo);
    } catch (error) {
      logger.error('Failed to get user position:', error);
      return null;
    }
  }

  async getUserPositions(user: PublicKey): Promise<UserPositionAccount[]> {
    try {
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          { dataSize: 200 }, // UserPosition account size
          {
            memcmp: {
              offset: 40, // user field offset (8 discriminator + 32 launch)
              bytes: user.toBase58(),
            },
          },
        ],
      });

      return accounts
        .map(({ pubkey, account }) => this.parseUserPositionAccount(pubkey, account))
        .filter((pos): pos is UserPositionAccount => pos !== null);
    } catch (error) {
      logger.error('Failed to get user positions:', error);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Transaction History
  // ---------------------------------------------------------------------------

  async getRecentTrades(launch: PublicKey, limit: number = 50): Promise<TradeEvent[]> {
    try {
      const signatures = await this.connection.getSignaturesForAddress(
        launch,
        { limit }
      );

      const trades: TradeEvent[] = [];
      
      for (const sig of signatures) {
        const tx = await this.connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });
        
        if (tx?.meta?.logMessages) {
          const trade = this.parseTradeFromLogs(tx.meta.logMessages, sig.signature, tx.blockTime ?? null);
          if (trade) trades.push(trade);
        }
      }

      return trades;
    } catch (error) {
      logger.error('Failed to get recent trades:', error);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------

  subscribeToProgram(callback: (accountInfo: AccountInfo<Buffer>, pubkey: PublicKey) => void): number {
    return this.connection.onProgramAccountChange(
      this.programId,
      (accountInfo, context) => {
        // Note: onProgramAccountChange doesn't provide pubkey directly
        // In production, you'd need to identify the account type
        callback(accountInfo.accountInfo, this.programId);
      },
      'confirmed'
    );
  }

  subscribeToProgramLogs(callback: (logs: string[], signature: string) => void): number {
    return this.connection.onLogs(
      this.programId,
      (logs) => {
        callback(logs.logs, logs.signature);
      },
      'confirmed'
    );
  }

  unsubscribe(subscriptionId: number): void {
    this.connection.removeAccountChangeListener(subscriptionId);
  }

  // ---------------------------------------------------------------------------
  // Account Parsing
  // ---------------------------------------------------------------------------

  private parseConfigAccount(accountInfo: AccountInfo<Buffer>): ConfigAccount | null {
    try {
      const data = accountInfo.data;
      let offset = 8; // Skip discriminator

      const admin = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
      const feeAuthority = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
      const protocolFeeBps = data.readUInt16LE(offset); offset += 2;
      const graduationThreshold = data.readBigUInt64LE(offset); offset += 8;
      const quoteMint = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
      const orbitProgramId = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
      const defaultBinStepBps = data.readUInt16LE(offset); offset += 2;
      const defaultBaseFeeBps = data.readUInt16LE(offset); offset += 2;
      const launchesPaused = data.readUInt8(offset++) === 1;
      const tradingPaused = data.readUInt8(offset++) === 1;
      const totalLaunches = data.readBigUInt64LE(offset); offset += 8;
      const totalGraduations = data.readBigUInt64LE(offset); offset += 8;
      // u128: read low and high 64-bit halves
      const volLo = data.readBigUInt64LE(offset);
      const volHi = data.readBigUInt64LE(offset + 8);
      const totalVolumeLamports = volLo + (volHi << 64n); offset += 16;
      const totalFeesCollected = data.readBigUInt64LE(offset); offset += 8;
      const bump = data.readUInt8(offset);

      return {
        admin,
        feeAuthority,
        protocolFeeBps,
        graduationThreshold,
        quoteMint,
        orbitProgramId,
        defaultBinStepBps,
        defaultBaseFeeBps,
        launchesPaused,
        tradingPaused,
        totalLaunches,
        totalGraduations,
        totalVolumeLamports,
        totalFeesCollected,
        bump,
      };
    } catch (error) {
      logger.error('Failed to parse config account:', error);
      return null;
    }
  }

  private parseLaunchAccount(pubkey: PublicKey, accountInfo: AccountInfo<Buffer>): LaunchAccount | null {
    try {
      const data = accountInfo.data;
      let offset = 8; // Skip discriminator

      const mint = new PublicKey(data.slice(offset, offset += 32));
      const creator = new PublicKey(data.slice(offset, offset += 32));
      const status = data.readUInt8(offset++);
      // Use BigInt for token-scale u64 values that may exceed Number.MAX_SAFE_INTEGER
      // (e.g., virtualTokenReserve starts at 8e17, totalSupply = 1e18)
      const totalSupplyBig = data.readBigUInt64LE(offset); offset += 8;
      const tokensSoldBig = data.readBigUInt64LE(offset); offset += 8;
      const graduationTokensBig = data.readBigUInt64LE(offset); offset += 8;
      const creatorTokensBig = data.readBigUInt64LE(offset); offset += 8;
      const virtualSolReserveBig = data.readBigUInt64LE(offset); offset += 8;
      const virtualTokenReserveBig = data.readBigUInt64LE(offset); offset += 8;
      const realSolReserveBig = data.readBigUInt64LE(offset); offset += 8;
      const realTokenReserveBig = data.readBigUInt64LE(offset); offset += 8;

      // Safe Number conversions (SOL values always within safe range)
      const totalSupply = Number(totalSupplyBig);
      const tokensSold = Number(tokensSoldBig);
      const graduationTokens = Number(graduationTokensBig);
      const creatorTokens = Number(creatorTokensBig);
      const virtualSolReserve = Number(virtualSolReserveBig);
      const realSolReserve = Number(realSolReserveBig);
      const realTokenReserve = Number(realTokenReserveBig);

      // Token reserves can exceed MAX_SAFE_INTEGER; keep as string for precision
      const virtualTokenReserve = virtualTokenReserveBig.toString();
      const graduationThreshold = Number(data.readBigUInt64LE(offset)); offset += 8;
      const createdAt = Number(data.readBigInt64LE(offset)); offset += 8;
      const graduatedAt = Number(data.readBigInt64LE(offset)); offset += 8;
      
      // Skip volumes (u128) for now
      offset += 32;
      
      const tradeCount = Number(data.readBigUInt64LE(offset)); offset += 8;
      const holderCount = data.readUInt32LE(offset); offset += 4;
      const orbitPool = new PublicKey(data.slice(offset, offset += 32));
      const creatorFeeBps = data.readUInt16LE(offset); offset += 2;

      // Parse strings
      const name = this.parseString(data.slice(offset, offset += 32));
      const symbol = this.parseString(data.slice(offset, offset += 10));
      const uri = this.parseString(data.slice(offset, offset += 200));
      const twitter = this.parseString(data.slice(offset, offset += 64));
      const telegram = this.parseString(data.slice(offset, offset += 64));
      const website = this.parseString(data.slice(offset, offset += 64));

      // Calculate price and market cap using BigInt for precision
      const vtReserve = virtualTokenReserveBig;
      const currentPrice = vtReserve > 0n
        ? Number(virtualSolReserveBig * 1000000000n / vtReserve)
        : 0;
      const marketCap = (currentPrice * totalSupply) / 1e9;

      return {
        publicKey: pubkey.toBase58(),
        mint: mint.toBase58(),
        creator: creator.toBase58(),
        status: (['Active', 'PendingGraduation', 'Graduated', 'Cancelled'] as const)[status],
        totalSupply,
        tokensSold,
        graduationTokens,
        creatorTokens,
        virtualSolReserve,
        virtualTokenReserve,
        realSolReserve,
        realTokenReserve,
        graduationThreshold,
        createdAt,
        graduatedAt: graduatedAt > 0 ? graduatedAt : undefined,
        tradeCount,
        holderCount,
        orbitPool: orbitPool.toBase58(),
        creatorFeeBps,
        name,
        symbol,
        uri,
        twitter: twitter || undefined,
        telegram: telegram || undefined,
        website: website || undefined,
        currentPrice,
        marketCap,
      };
    } catch (error) {
      logger.error('Failed to parse launch account:', error);
      return null;
    }
  }

  private parseUserPositionAccount(pubkey: PublicKey, accountInfo: AccountInfo<Buffer>): UserPositionAccount | null {
    try {
      const data = accountInfo.data;
      let offset = 8; // Skip discriminator

      const launch = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
      const user = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
      const tokensBought = Number(data.readBigUInt64LE(offset)); offset += 8;
      const tokensSold = Number(data.readBigUInt64LE(offset)); offset += 8;
      const tokenBalance = Number(data.readBigUInt64LE(offset)); offset += 8;
      const solSpent = Number(data.readBigUInt64LE(offset)); offset += 8;
      const solReceived = Number(data.readBigUInt64LE(offset)); offset += 8;
      const firstTradeAt = Number(data.readBigInt64LE(offset)); offset += 8;
      const lastTradeAt = Number(data.readBigInt64LE(offset)); offset += 8;
      const buyCount = data.readUInt32LE(offset); offset += 4;
      const sellCount = data.readUInt32LE(offset); offset += 4;
      const avgBuyPrice = Number(data.readBigUInt64LE(offset)); offset += 8;
      const costBasis = Number(data.readBigUInt64LE(offset)); offset += 8;

      return {
        publicKey: pubkey.toBase58(),
        launch: launch.toBase58(),
        user: user.toBase58(),
        tokensBought,
        tokensSold,
        tokenBalance,
        solSpent,
        solReceived,
        firstTradeAt,
        lastTradeAt,
        buyCount,
        sellCount,
        avgBuyPrice,
        costBasis,
      };
    } catch (error) {
      logger.error('Failed to parse user position account:', error);
      return null;
    }
  }

  private parseString(buffer: Buffer): string {
    const nullIndex = buffer.indexOf(0);
    return buffer.slice(0, nullIndex > 0 ? nullIndex : buffer.length).toString('utf8').trim();
  }

  // ---------------------------------------------------------------------------
  // Balance Methods
  // ---------------------------------------------------------------------------

  async getSolBalance(user: PublicKey): Promise<number> {
    try {
      const balance = await this.connection.getBalance(user);
      return balance;
    } catch (error) {
      logger.error('Failed to get SOL balance:', error);
      return 0;
    }
  }

  async getTokenBalance(user: PublicKey, mint: PublicKey): Promise<number> {
    try {
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(user, {
        mint,
      });

      if (tokenAccounts.value.length === 0) {
        return 0;
      }

      const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      return balance || 0;
    } catch (error) {
      logger.error('Failed to get token balance:', error);
      return 0;
    }
  }

  async getTokenBalanceRaw(user: PublicKey, mint: PublicKey): Promise<bigint> {
    try {
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(user, {
        mint,
      });

      if (tokenAccounts.value.length === 0) {
        return BigInt(0);
      }

      const amount = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.amount;
      return BigInt(amount);
    } catch (error) {
      logger.error('Failed to get raw token balance:', error);
      return BigInt(0);
    }
  }

  private parseTradeFromLogs(logs: string[], signature: string, blockTime: number | null): TradeEvent | null {
    try {
      // Anchor emits events as base64-encoded Borsh data in "Program data:" logs.
      // TradeExecuted layout (after 8-byte discriminator):
      //   Pubkey launch (32), Pubkey trader (32), bool is_buy (1),
      //   u64 sol_amount (8), u64 token_amount (8), u64 price (8),
      //   u64 protocol_fee (8), u64 creator_fee (8), i64 timestamp (8)
      const TRADE_EVENT_SIZE = 121;

      for (const log of logs) {
        if (!log.startsWith('Program data: ')) continue;

        const base64Data = log.slice('Program data: '.length);
        const data = Buffer.from(base64Data, 'base64');

        if (data.length !== TRADE_EVENT_SIZE) continue;

        let offset = 8; // Skip event discriminator
        const launch = new PublicKey(data.slice(offset, offset + 32)).toBase58(); offset += 32;
        const trader = new PublicKey(data.slice(offset, offset + 32)).toBase58(); offset += 32;
        const isBuy = data.readUInt8(offset) === 1; offset += 1;
        const solAmount = Number(data.readBigUInt64LE(offset)); offset += 8;
        const tokenAmount = Number(data.readBigUInt64LE(offset)); offset += 8;
        const price = Number(data.readBigUInt64LE(offset)); offset += 8;
        offset += 16; // Skip protocol_fee and creator_fee
        const timestamp = Number(data.readBigInt64LE(offset));

        return {
          signature,
          type: isBuy ? 'buy' : 'sell',
          launch,
          trader,
          solAmount,
          tokenAmount,
          price,
          timestamp: timestamp || blockTime || Date.now() / 1000,
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}

export default SolanaService;
