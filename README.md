# Launchr - Launch into Orbit

**Institutional-grade token launchpad on Solana with bonding curve mechanics and automatic graduation to Orbit Finance DLMM liquidity.**

## Overview

Launchr is a permissionless token launchpad built on Solana that uses constant-product bonding curves for fair price discovery. When sufficient liquidity accumulates, launches automatically graduate to Orbit Finance's concentrated liquidity pools. The platform features real-time WebSocket updates, comprehensive analytics, and a polished glassmorphism UI.

**Program ID (Devnet):** `5LFTkjx2vRTkXaKvYtikEEJkvpTrx16feUspuxKgvsE8`

### Key Features

- **Fair Launch** - Anyone can create a token with transparent, on-chain pricing
- **Bonding Curve** - Constant product AMM (x*y=k) ensures predictable pricing
- **Automatic Graduation** - Launches migrate to Orbit DLMM when threshold reached
- **Real-time Updates** - WebSocket-powered live trades, prices, and notifications
- **Institutional UI** - Glassmorphism design with premium animations
- **Comprehensive Analytics** - Charts, holder distribution, trading history
- **Trading Monitoring** - Anomaly detection and security alerts
- **Multi-wallet Support** - Phantom, Solflare, Backpack, and more

## Architecture

```
launchr/
├── program/              # Solana Anchor program (Rust)
│   ├── src/
│   │   ├── lib.rs        # Main program logic
│   │   ├── state/        # Account structures
│   │   ├── instructions/ # Program instructions
│   │   └── errors.rs     # Custom errors
│   └── tests/
├── frontend/             # React TypeScript application
│   ├── src/
│   │   ├── App.tsx       # Main application (~8000 LOC)
│   │   ├── components/   # Reusable UI components
│   │   ├── hooks/        # Custom React hooks (~2000 LOC)
│   │   ├── services/     # API client & WebSocket
│   │   ├── program/      # Anchor program types
│   │   ├── lib/          # Security utilities
│   │   └── styles/       # Global CSS & animations
│   └── public/
├── backend/              # Express.js API server
│   ├── src/
│   │   ├── index.ts      # Server entry point
│   │   ├── routes/       # REST API endpoints
│   │   ├── services/     # Business logic
│   │   └── lib/          # Security & validation
│   └── uploads/          # Token metadata storage
└── docker-compose.yml
```

## Tokenomics

| Allocation | Percentage | Description |
|------------|------------|-------------|
| Bonding Curve | 80% | Available for trading |
| LP Reserve | 20% | Reserved for Orbit DLMM migration |

### Graduation Distribution

| Item | Amount | Description |
|------|--------|-------------|
| LP Liquidity | 80 SOL + 200M tokens | Deposited into Orbit DLMM pool |
| Creator Reward | 2 SOL | Paid to creator on successful graduation |
| Treasury Fee | 3 SOL | Launchr protocol revenue |
| **LP Status** | **LOCKED** | Position owned by program PDA (permanent, unwithdrawable) |

### Bonding Curve Parameters

- **Total Supply**: 1 Billion tokens (1,000,000,000)
- **Virtual SOL Reserve**: 30 SOL
- **Virtual Token Reserve**: 800M tokens
- **Graduation Threshold**: 85 SOL real reserve
- **Protocol Fee**: 1% (100 bps) - split between treasury and creator
- **Creator Fee**: 0.2% (20 bps) - fixed, taken from protocol fee
- **Treasury Fee**: 0.8% (80 bps) - remainder of protocol fee

## Tech Stack

### Frontend
- React 18 with TypeScript
- Tailwind CSS with custom glassmorphism design
- Anchor client for Solana interactions
- Real-time WebSocket subscriptions
- Plus Jakarta Sans & JetBrains Mono typography

### Backend
- Express.js with TypeScript
- WebSocket server for real-time updates
- Redis caching (with in-memory fallback)
- Zod schema validation
- Rate limiting & security middleware

### Integrations
- **Pyth Network** - Real-time SOL/USD price oracle
- **Metaplex** - Token metadata (DAS API)
- **Helius** - Enhanced RPC & token holder data
- **Jupiter** - DEX aggregation (post-graduation)
- **Jito** - MEV-protected transactions

## Quick Start

### Prerequisites

- Rust 1.70+
- Solana CLI 2.x (Agave)
- Anchor 0.32+
- Node.js 18+
- Redis (optional)

### 1. Deploy Program

```bash
cd program
anchor build
anchor deploy --provider.cluster devnet
```

### 2. Start Backend

```bash
cd backend
npm install
cp .env.example .env
# Configure environment variables
npm run dev
```

### 3. Start Frontend

```bash
cd frontend
npm install
npm start
```

### Docker Deployment

```bash
docker-compose up -d
docker-compose logs -f
```

## API Reference

### REST Endpoints

#### Launches

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/launches` | GET | List launches (paginated, filterable) |
| `/api/launches/trending` | GET | Top 10 trending launches |
| `/api/launches/recent` | GET | Recently created launches |
| `/api/launches/graduated` | GET | Graduated launches |
| `/api/launches/:publicKey` | GET | Single launch details |
| `/api/launches/:publicKey/trades` | GET | Launch trade history |
| `/api/launches/:publicKey/holders` | GET | Token holder distribution |
| `/api/launches/:publicKey/chart` | GET | Price chart data (candlesticks) |
| `/api/launches/:publicKey/metadata` | GET | Token metadata |
| `/api/launches/metadata` | POST | Batch token metadata |

#### Users

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/users/:address/positions` | GET | User token positions with P&L |
| `/api/users/:address/launches` | GET | Launches created by user |
| `/api/users/:address/trades` | GET | User trade history |
| `/api/users/:address/activity` | GET | Recent user activity |
| `/api/users/:address/balances/:launchPk` | GET | User balances for a launch |
| `/api/users/:address/stats` | GET | Aggregated user statistics |

#### Stats & Monitoring

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stats` | GET | Global protocol statistics |
| `/api/stats/sol-price` | GET | Current SOL price (Pyth) |
| `/api/monitoring/alerts` | GET | Trading anomaly alerts |
| `/api/monitoring/launch/:launchPk` | GET | Launch trading metrics |
| `/api/monitoring/stats` | GET | Monitoring service stats |

#### Upload

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload/metadata` | POST | Upload token metadata & image |
| `/api/upload/:id` | GET | Get upload status |

#### System

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/auth/nonce` | GET | Get auth nonce for wallet signing |
| `/api/pyth/health` | GET | Pyth oracle health status |
| `/api/security/stats` | GET | Security service statistics |

### Query Parameters

#### GET /api/launches

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter: `active`, `graduated`, `failed` |
| `sort` | string | Sort: `created`, `price`, `volume`, `marketcap`, `holders`, `trades` |
| `order` | string | Order: `asc`, `desc` |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20, max: 100) |
| `search` | string | Search by name or symbol |
| `creator` | string | Filter by creator address |

#### GET /api/launches/:publicKey/chart

| Parameter | Type | Description |
|-----------|------|-------------|
| `timeframe` | string | `1H`, `4H`, `1D`, `7D`, `30D` |

### WebSocket API

Connect to `ws://localhost:3001/ws`

#### Subscribe to Channels

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.onopen = () => {
  // Subscribe to trades
  ws.send(JSON.stringify({ type: 'subscribe', channel: 'trades' }));

  // Subscribe to launch events
  ws.send(JSON.stringify({ type: 'subscribe', channel: 'launches' }));

  // Subscribe to global stats
  ws.send(JSON.stringify({ type: 'subscribe', channel: 'stats' }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'connected':
      console.log('Connected, available channels:', message.data.channels);
      break;
    case 'update':
      console.log(`${message.channel} update:`, message.data);
      break;
    case 'subscribed':
      console.log(`Subscribed to ${message.channel}`);
      break;
  }
};
```

#### Message Types

**Trade Update** (channel: `trades`)
```json
{
  "type": "update",
  "channel": "trades",
  "data": {
    "type": "buy",
    "trader": "Abc123...",
    "launch": "LaunchPk...",
    "tokenAmount": 1000000000,
    "solAmount": 500000000,
    "price": 0.0000005,
    "timestamp": 1706000000000,
    "signature": "TxSig..."
  }
}
```

**Launch Event** (channel: `launches`)
```json
{
  "type": "update",
  "channel": "launches",
  "data": {
    "type": "created",
    "publicKey": "LaunchPk...",
    "name": "Token Name",
    "symbol": "TKN",
    "creator": "CreatorPk..."
  }
}
```

## Program Instructions

### `init_config`
Initialize global protocol configuration (admin only, one-time).

### `create_launch`
Create a new token with bonding curve.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `name` | string | Token name (max 32 chars) |
| `symbol` | string | Token symbol (max 10 chars) |
| `uri` | string | Metadata URI |
| `creator_fee_bps` | u16 | Deprecated - creator fee is fixed at 0.2% (20 bps) |

### `buy`
Buy tokens from the bonding curve.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `sol_amount` | u64 | SOL to spend (lamports) |
| `min_tokens_out` | u64 | Minimum tokens to receive (slippage) |

### `sell`
Sell tokens back to the bonding curve.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `token_amount` | u64 | Tokens to sell |
| `min_sol_out` | u64 | Minimum SOL to receive (slippage) |

### `graduate`
Migrate launch to Orbit Finance DLMM (callable when threshold reached).

## Frontend Pages

### Home (`/`)
- Hero section with platform stats
- Trending launches carousel
- Recent launches grid
- Global statistics dashboard

### Launches (`/launches`)
- Paginated launch list with filters
- Sort by various metrics
- Search functionality
- Real-time price updates

### Launch Detail (`/launch/:publicKey`)
- Price chart with multiple timeframes
- Trade panel (buy/sell)
- Trade history with live updates
- Holder distribution
- Token information

### Create (`/create`)
- Token creation form
- Image upload with preview
- Social links (Twitter, Telegram, Website)
- Transaction simulation

### Profile (`/profile`)
- Portfolio overview
- Active positions with P&L
- Created launches
- Trade history
- Aggregated statistics

### Settings (`/settings`)
- Theme toggle (dark/light)
- Wallet connection management
- RPC endpoint configuration
- Notification preferences
- Slippage tolerance

## Environment Variables

### Backend (.env)
```env
PORT=3001
RPC_ENDPOINT=https://api.devnet.solana.com
PROGRAM_ID=5LFTkjx2vRTkXaKvYtikEEJkvpTrx16feUspuxKgvsE8
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000
HELIUS_API_KEY=your-helius-api-key
SOLANA_CLUSTER=devnet
API_BASE_URL=http://localhost:3001
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_RPC_ENDPOINT=https://api.devnet.solana.com
REACT_APP_PROGRAM_ID=5LFTkjx2vRTkXaKvYtikEEJkvpTrx16feUspuxKgvsE8
```

## Security Features

### Backend
- **Rate Limiting**: 100 requests/minute per IP
- **WebSocket Rate Limiting**: 30 messages/second per connection
- **Connection Limits**: 5 WebSocket connections per IP
- **Request Validation**: Zod schemas on all endpoints
- **Security Headers**: Helmet.js middleware
- **CORS Protection**: Configurable origin whitelist

### Trading Monitoring
- **Anomaly Detection**: Large trade alerts
- **Wash Trading Detection**: Circular trading patterns
- **Price Manipulation Alerts**: Unusual price movements
- **Velocity Tracking**: Trade frequency monitoring

### Program
- Non-upgradeable after deployment
- Deterministic PDA derivation
- Slippage protection on all trades
- Authority-only admin functions
- **LP locked on graduation** — Position owned by program PDA, liquidity is permanent
- **No rug pulls** — Creator cannot withdraw LP or drain pool

## Brand Guidelines

### Colors
- **Primary Green**: `#22C55E`
- **Launch Mint**: `#34D399`
- **Deep Green**: `#16A34A`
- **Background (Void)**: `#111827`

### Typography
- **Primary**: Plus Jakarta Sans (400-800)
- **Monospace**: JetBrains Mono (400-500)

### Gradients
```css
/* Primary gradient */
background: linear-gradient(135deg, #34D399, #16A34A);

/* Glow effect */
box-shadow: 0 0 30px rgba(34, 197, 94, 0.3);
```

## Development

### Program Tests
```bash
cd program
anchor test
```

### Backend Tests
```bash
cd backend
npm test
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Build for Production
```bash
# Frontend
cd frontend && npm run build

# Backend
cd backend && npm run build
```

## License

MIT License - see [LICENSE](LICENSE)

## Links

- **Orbit Finance**: [orbit.finance](https://orbit.finance)
- **CipherLabs**: [@CipherLabs_](https://twitter.com/CipherLabs_)

---

Built with 💚 by CipherLabs

*Launch into Orbit*
