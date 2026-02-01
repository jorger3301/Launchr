/**
 * Mock Data for Local Development
 * 
 * Enable with REACT_APP_USE_MOCKS=true
 * Provides realistic fake data so you can test all UI components
 * without a deployed Solana program.
 */

import { LaunchData, TradeData, UserPositionData } from '../components/molecules';

// =============================================================================
// MOCK LAUNCHES
// =============================================================================

const MOCK_CREATORS = [
  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsu',
  'DRpbCBMxVnDK7maPMyGXYD6LYj7aJw3yNpbSaJJ4Dj5s',
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
  'FG4Y3yX4AAchp89tTDgRR9J3qgXmFBz3TjBaq84DEnnR',
  'BvFh7PoTjJAkLxX8pPfVE3N2F5juPADZtT4RGLLZ4iDY',
];

const TOKEN_NAMES = [
  { name: 'OrbitCat', symbol: 'OCAT', desc: 'The first cat to orbit the moon' },
  { name: 'SolPepe', symbol: 'SPEPE', desc: 'Pepe but on Solana, need we say more?' },
  { name: 'DogWifRocket', symbol: 'DWRKT', desc: 'Dog wif rocket going to the moon' },
  { name: 'CipherPunk', symbol: 'CPUNK', desc: 'Encrypted punk vibes on Solana' },
  { name: 'BonkOrbit', symbol: 'BORBIT', desc: 'Bonk meets Orbit Finance' },
  { name: 'LaunchCoin', symbol: 'LNCH', desc: 'The coin that launches all coins' },
  { name: 'SolanaShiba', symbol: 'SSHIB', desc: 'Shiba Inu on the fastest chain' },
  { name: 'MoonBag', symbol: 'MBAG', desc: 'Diamond hands only, holding the moonbag' },
  { name: 'OrbitDAO', symbol: 'ODAO', desc: 'Governance token for the Orbit ecosystem' },
  { name: 'DegenFi', symbol: 'DGEN', desc: 'DeFi for degens, by degens' },
  { name: 'RocketFuel', symbol: 'FUEL', desc: 'Fueling the next generation of launches' },
  { name: 'GigaChad', symbol: 'GIGA', desc: 'The gigachad of Solana memecoins' },
  { name: 'SolWhale', symbol: 'WHALE', desc: 'Only whales allowed' },
  { name: 'NyanSol', symbol: 'NYAN', desc: 'Rainbow cat vibes on Solana' },
  { name: 'MemeLord', symbol: 'MLORD', desc: 'Lord of all memes' },
];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function generatePublicKey(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateMockLaunch(index: number): LaunchData {
  const token = TOKEN_NAMES[index % TOKEN_NAMES.length];
  const now = Date.now() / 1000;
  const createdAt = now - randomBetween(3600, 604800); // 1 hour to 7 days ago
  
  const totalSupply = 1_000_000_000_000_000_000; // 1B with 9 decimals
  const graduationThreshold = 85_000_000_000; // 85 SOL in lamports
  
  // Random progress toward graduation (0% to 120%)
  const progressPercent = Math.random() * 1.2;
  const realSolReserve = Math.floor(graduationThreshold * progressPercent);
  
  const isGraduated = progressPercent > 1.0;
  const isPending = progressPercent > 0.95 && !isGraduated;
  
  // Bonding curve math (simplified)
  const virtualSol = 30_000_000_000; // 30 SOL
  const virtualTokens = 800_000_000_000_000_000; // 800M tokens
  const tokensSold = Math.floor(virtualTokens * progressPercent * 0.6);
  const currentReserveTokens = virtualTokens - tokensSold;
  const currentReserveSol = virtualSol + realSolReserve;
  
  const currentPrice = currentReserveSol / currentReserveTokens;
  const marketCap = (currentPrice * totalSupply) / 1e9;
  
  const holderCount = randomBetween(5, 500);
  const tradeCount = randomBetween(10, 2000);

  return {
    publicKey: generatePublicKey(),
    mint: generatePublicKey(),
    creator: MOCK_CREATORS[index % MOCK_CREATORS.length],
    name: token.name,
    symbol: token.symbol,
    uri: `https://arweave.net/${generatePublicKey().slice(0, 43)}`,
    status: isGraduated ? 'Graduated' : isPending ? 'PendingGraduation' : 'Active',
    totalSupply,
    tokensSold,
    realSolReserve,
    virtualSolReserve: currentReserveSol,
    virtualTokenReserve: currentReserveTokens,
    graduationThreshold,
    currentPrice,
    marketCap,
    holderCount,
    tradeCount,
    createdAt,
    graduatedAt: isGraduated ? createdAt + randomBetween(86400, 259200) : undefined,
    twitter: Math.random() > 0.3 ? `@${token.symbol.toLowerCase()}sol` : undefined,
    telegram: Math.random() > 0.5 ? `t.me/${token.symbol.toLowerCase()}` : undefined,
    website: Math.random() > 0.6 ? `https://${token.name.toLowerCase()}.xyz` : undefined,
    creatorFeeBps: randomBetween(0, 250),
  };
}

// Generate 15 mock launches
export const MOCK_LAUNCHES: LaunchData[] = TOKEN_NAMES.map((_, i) => generateMockLaunch(i));

// Sort by creation time (newest first)
MOCK_LAUNCHES.sort((a, b) => b.createdAt - a.createdAt);

// =============================================================================
// MOCK TRADES
// =============================================================================

export function generateMockTrades(launchPk: string, count: number = 25): TradeData[] {
  const trades: TradeData[] = [];
  const now = Date.now() / 1000;

  for (let i = 0; i < count; i++) {
    const isBuy = Math.random() > 0.4; // 60% buys
    const solAmount = (Math.random() * 5 + 0.01) * 1e9; // 0.01 to 5 SOL
    const tokenAmount = (Math.random() * 50000000 + 100000) * 1e9;
    const price = solAmount / tokenAmount;

    trades.push({
      txSignature: generatePublicKey(),
      type: isBuy ? 'buy' : 'sell',
      user: MOCK_CREATORS[randomBetween(0, MOCK_CREATORS.length - 1)],
      solAmount,
      amount: tokenAmount,
      price,
      timestamp: now - randomBetween(60, 86400 * 3), // Last 3 days
    });
  }

  // Sort newest first
  trades.sort((a, b) => b.timestamp - a.timestamp);
  return trades;
}

// =============================================================================
// MOCK HOLDERS
// =============================================================================

export function generateMockHolders(count: number = 10): Array<{ address: string; balance: number; percentage: number }> {
  const holders: Array<{ address: string; balance: number; percentage: number }> = [];
  let remainingPercent = 100;

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    const percentage = isLast ? remainingPercent : Math.min(remainingPercent, Math.random() * 20 + 1);
    remainingPercent -= percentage;

    holders.push({
      address: generatePublicKey(),
      balance: Math.floor(percentage * 10_000_000 * 1e9),
      percentage: Math.round(percentage * 100) / 100,
    });
  }

  holders.sort((a, b) => b.percentage - a.percentage);
  return holders;
}

// =============================================================================
// MOCK PRICE HISTORY
// =============================================================================

export function generateMockPriceHistory(hours: number = 72): Array<{ timestamp: number; price: number }> {
  const history: Array<{ timestamp: number; price: number }> = [];
  const now = Date.now() / 1000;
  const points = hours * 4; // 15-min intervals
  
  let price = 0.00000001 + Math.random() * 0.0000001; // Starting price

  for (let i = points; i >= 0; i--) {
    const timestamp = now - (i * 900); // 15-minute intervals
    
    // Random walk with upward bias
    const change = (Math.random() - 0.45) * price * 0.05;
    price = Math.max(price + change, 0.000000001);

    history.push({ timestamp, price });
  }

  return history;
}

// =============================================================================
// MOCK USER POSITION
// =============================================================================

export function generateMockUserPosition(): UserPositionData {
  const tokenBalance = randomBetween(1000000, 500000000) * 1e9;
  const solSpent = (Math.random() * 3 + 0.1) * 1e9;
  const currentValue = solSpent * (0.5 + Math.random() * 2); // -50% to +100%
  const unrealizedPnl = currentValue - solSpent;

  return {
    tokenBalance,
    solSpent,
    solReceived: 0,
    avgBuyPrice: solSpent / tokenBalance,
    costBasis: solSpent,
    unrealizedPnl,
    realizedPnl: 0,
    totalPnl: unrealizedPnl,
    roiPercent: (unrealizedPnl / solSpent) * 100,
  };
}

// =============================================================================
// MOCK GLOBAL STATS
// =============================================================================

export const MOCK_GLOBAL_STATS = {
  totalLaunches: MOCK_LAUNCHES.length,
  totalGraduated: MOCK_LAUNCHES.filter(l => l.status === 'Graduated').length,
  totalVolume: MOCK_LAUNCHES.reduce((sum, l) => sum + l.realSolReserve, 0),
  totalFees: Math.floor(MOCK_LAUNCHES.reduce((sum, l) => sum + l.realSolReserve, 0) * 0.01),
};
