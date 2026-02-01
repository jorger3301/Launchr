/**
 * Jupiter Service
 *
 * Token swap aggregator and price API integration.
 * https://station.jup.ag/docs/apis/swap-api
 */

import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

interface QuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: number; // In lamports/smallest unit
  slippageBps?: number; // Basis points (100 = 1%)
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
  maxAccounts?: number;
}

interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee: {
    amount: string;
    feeBps: number;
  } | null;
  priceImpactPct: string;
  routePlan: {
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }[];
  contextSlot: number;
  timeTaken: number;
}

interface SwapRequest {
  quoteResponse: QuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  useSharedAccounts?: boolean;
  feeAccount?: string;
  trackingAccount?: string;
  computeUnitPriceMicroLamports?: number;
  asLegacyTransaction?: boolean;
  useTokenLedger?: boolean;
  destinationTokenAccount?: string;
  dynamicComputeUnitLimit?: boolean;
  skipUserAccountsRpcCalls?: boolean;
}

interface SwapResponse {
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

interface TokenPrice {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
}

interface TokenInfo {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
  tags?: string[];
  extensions?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

const JUPITER_API_V6 = 'https://quote-api.jup.ag/v6';
const JUPITER_PRICE_API = 'https://price.jup.ag/v6';
const JUPITER_TOKEN_API = 'https://token.jup.ag';

// Common token mints
export const TOKEN_MINTS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
};

// ---------------------------------------------------------------------------
// JUPITER SERVICE
// ---------------------------------------------------------------------------

export class JupiterService {
  private tokenList: TokenInfo[] = [];
  private tokenListLoaded: boolean = false;

  constructor() {
    this.loadTokenList();
  }

  // ---------------------------------------------------------------------------
  // TOKEN LIST
  // ---------------------------------------------------------------------------

  /**
   * Load Jupiter token list for metadata
   */
  private async loadTokenList(): Promise<void> {
    try {
      const response = await fetch(`${JUPITER_TOKEN_API}/all`);
      this.tokenList = await response.json() as TokenInfo[];
      this.tokenListLoaded = true;
      logger.info(`Loaded ${this.tokenList.length} tokens from Jupiter`);
    } catch (error) {
      logger.error('Error loading Jupiter token list:', error);
    }
  }

  /**
   * Get token info by mint address
   */
  getTokenInfo(mintAddress: string): TokenInfo | undefined {
    return this.tokenList.find(t => t.address === mintAddress);
  }

  /**
   * Search tokens by name or symbol
   */
  searchTokens(query: string, limit: number = 10): TokenInfo[] {
    const q = query.toLowerCase();
    return this.tokenList
      .filter(t =>
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)
      )
      .slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // PRICE API
  // ---------------------------------------------------------------------------

  /**
   * Get token price in USD or another token
   */
  async getPrice(
    tokenMint: string,
    vsToken: string = TOKEN_MINTS.USDC
  ): Promise<number | null> {
    try {
      const response = await fetch(
        `${JUPITER_PRICE_API}/price?ids=${tokenMint}&vsToken=${vsToken}`
      );

      const data = await response.json() as { data?: Record<string, { price: number }> };
      return data.data?.[tokenMint]?.price || null;
    } catch (error) {
      logger.error('Error fetching token price:', error);
      return null;
    }
  }

  /**
   * Get multiple token prices
   */
  async getPrices(
    tokenMints: string[],
    vsToken: string = TOKEN_MINTS.USDC
  ): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    try {
      const ids = tokenMints.join(',');
      const response = await fetch(
        `${JUPITER_PRICE_API}/price?ids=${ids}&vsToken=${vsToken}`
      );

      const data = await response.json() as { data?: Record<string, TokenPrice> };

      if (data.data) {
        for (const [mint, info] of Object.entries(data.data)) {
          prices.set(mint, info.price);
        }
      }
    } catch (error) {
      logger.error('Error fetching token prices:', error);
    }

    return prices;
  }

  /**
   * Get SOL price in USD
   */
  async getSolPrice(): Promise<number> {
    const price = await this.getPrice(TOKEN_MINTS.SOL);
    return price || 0;
  }

  // ---------------------------------------------------------------------------
  // SWAP API
  // ---------------------------------------------------------------------------

  /**
   * Get swap quote
   */
  async getQuote(request: QuoteRequest): Promise<QuoteResponse | null> {
    try {
      const params = new URLSearchParams({
        inputMint: request.inputMint,
        outputMint: request.outputMint,
        amount: request.amount.toString(),
        slippageBps: (request.slippageBps || 50).toString(),
        ...(request.onlyDirectRoutes && { onlyDirectRoutes: 'true' }),
        ...(request.asLegacyTransaction && { asLegacyTransaction: 'true' }),
        ...(request.maxAccounts && { maxAccounts: request.maxAccounts.toString() })
      });

      const response = await fetch(`${JUPITER_API_V6}/quote?${params}`);

      if (!response.ok) {
        const error = await response.json();
        logger.error('Jupiter quote error:', error);
        return null;
      }

      return await response.json() as QuoteResponse;
    } catch (error) {
      logger.error('Error getting swap quote:', error);
      return null;
    }
  }

  /**
   * Get swap transaction
   */
  async getSwapTransaction(request: SwapRequest): Promise<SwapResponse | null> {
    try {
      const response = await fetch(`${JUPITER_API_V6}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: request.quoteResponse,
          userPublicKey: request.userPublicKey,
          wrapAndUnwrapSol: request.wrapAndUnwrapSol ?? true,
          useSharedAccounts: request.useSharedAccounts ?? true,
          dynamicComputeUnitLimit: request.dynamicComputeUnitLimit ?? true,
          ...(request.computeUnitPriceMicroLamports && {
            computeUnitPriceMicroLamports: request.computeUnitPriceMicroLamports
          }),
          ...(request.feeAccount && { feeAccount: request.feeAccount }),
          ...(request.destinationTokenAccount && {
            destinationTokenAccount: request.destinationTokenAccount
          })
        })
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error('Jupiter swap error:', error);
        return null;
      }

      return await response.json() as SwapResponse;
    } catch (error) {
      logger.error('Error getting swap transaction:', error);
      return null;
    }
  }

  /**
   * Get quote for SOL -> Token swap
   */
  async getQuoteSolToToken(
    tokenMint: string,
    solAmount: number, // In SOL (not lamports)
    slippageBps: number = 50
  ): Promise<QuoteResponse | null> {
    const lamports = Math.floor(solAmount * 1e9);
    return this.getQuote({
      inputMint: TOKEN_MINTS.SOL,
      outputMint: tokenMint,
      amount: lamports,
      slippageBps
    });
  }

  /**
   * Get quote for Token -> SOL swap
   */
  async getQuoteTokenToSol(
    tokenMint: string,
    tokenAmount: number, // In smallest unit
    slippageBps: number = 50
  ): Promise<QuoteResponse | null> {
    return this.getQuote({
      inputMint: tokenMint,
      outputMint: TOKEN_MINTS.SOL,
      amount: tokenAmount,
      slippageBps
    });
  }

  // ---------------------------------------------------------------------------
  // ROUTE INFO
  // ---------------------------------------------------------------------------

  /**
   * Get readable route info from quote
   */
  getRouteInfo(quote: QuoteResponse): {
    inputAmount: number;
    outputAmount: number;
    priceImpact: number;
    route: string[];
    fee: number;
  } {
    const route = quote.routePlan.map(r => r.swapInfo.label);
    const fee = quote.routePlan.reduce((acc, r) => {
      return acc + parseInt(r.swapInfo.feeAmount);
    }, 0);

    return {
      inputAmount: parseInt(quote.inAmount),
      outputAmount: parseInt(quote.outAmount),
      priceImpact: parseFloat(quote.priceImpactPct),
      route,
      fee
    };
  }

  /**
   * Calculate minimum output amount with slippage
   */
  calculateMinOutput(quote: QuoteResponse): number {
    return parseInt(quote.otherAmountThreshold);
  }
}

// ---------------------------------------------------------------------------
// SINGLETON INSTANCE
// ---------------------------------------------------------------------------

let jupiterService: JupiterService | null = null;

export function initJupiter(): JupiterService {
  jupiterService = new JupiterService();
  logger.info('Jupiter service initialized');
  return jupiterService;
}

export function getJupiter(): JupiterService | null {
  return jupiterService;
}

export { JUPITER_API_V6, JUPITER_PRICE_API };
