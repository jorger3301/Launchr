# 🚀 Launchr - Launch into Orbit

**Bonding curve token launches that graduate into Orbit Finance DLMM liquidity.**

![Launchr Banner](docs/banner.png)

## Overview

Launchr is a permissionless token launchpad on Solana that uses constant-product bonding curves for fair price discovery. When sufficient liquidity accumulates, launches automatically graduate to Orbit Finance's concentrated liquidity pools.

### Key Features

- **🎯 Fair Launch**: Anyone can create a token with transparent, on-chain pricing
- **📈 Bonding Curve**: Constant product AMM (x*y=k) ensures predictable pricing
- **🎓 Automatic Graduation**: Launches migrate to Orbit DLMM when threshold reached
- **💰 Fee Distribution**: Protocol + creator fees with Orbit holder rewards
- **🔒 Secure**: Non-upgradeable program, all logic on-chain

## Architecture

```
launchr/
├── program/          # Solana Anchor program (Rust)
├── frontend/         # React TypeScript app
├── backend/          # Node.js API server
├── docs/             # Documentation
└── docker-compose.yml
```

## Token Economics

| Allocation | Percentage | Description |
|------------|------------|-------------|
| Creator | 2% | Immediate allocation to creator |
| Bonding Curve | 80% | Available for trading |
| Graduation | 18% | Reserved for Orbit liquidity |

### Initial Curve Parameters

- **Virtual SOL Reserve**: 30 SOL
- **Virtual Token Reserve**: 800M tokens
- **Graduation Threshold**: 85 SOL

## Quick Start

### Prerequisites

- Rust 1.70+
- Solana CLI 1.18+
- Anchor 0.29+
- Node.js 18+
- Docker (optional)

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
# Edit .env with your settings
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
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

## API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/launches` | GET | List all launches |
| `/api/launches/trending` | GET | Get trending launches |
| `/api/launches/:publicKey` | GET | Get single launch |
| `/api/launches/:publicKey/trades` | GET | Get launch trades |
| `/api/stats` | GET | Global protocol stats |
| `/api/users/:address/positions` | GET | User positions |
| `/health` | GET | Health check |

### WebSocket Events

```javascript
// Connect
const ws = new WebSocket('ws://localhost:3001/ws');

// Subscribe to channels
ws.send(JSON.stringify({ type: 'subscribe', channel: 'trades' }));
ws.send(JSON.stringify({ type: 'subscribe', channel: 'launches' }));

// Receive updates
ws.onmessage = (event) => {
  const { type, channel, data } = JSON.parse(event.data);
  console.log(`${channel}: ${type}`, data);
};
```

## Program Instructions

### `init_config`
Initialize global protocol configuration (one-time).

### `create_launch`
Create a new token with bonding curve.

**Parameters:**
- `name`: Token name (max 32 chars)
- `symbol`: Token symbol (max 10 chars)
- `uri`: Metadata URI
- `creator_fee_bps`: Creator fee (max 500 = 5%)

### `buy`
Buy tokens from the bonding curve.

**Parameters:**
- `sol_amount`: SOL to spend (lamports)
- `min_tokens_out`: Slippage protection

### `sell`
Sell tokens back to the bonding curve.

**Parameters:**
- `token_amount`: Tokens to sell
- `min_sol_out`: Slippage protection

### `graduate`
Migrate launch to Orbit Finance DLMM.

**Parameters:**
- `bin_step_bps`: Orbit bin step (optional)
- `num_liquidity_bins`: Distribution bins (optional)

## Environment Variables

### Backend
```env
PORT=3001
RPC_ENDPOINT=https://api.devnet.solana.com
PROGRAM_ID=LNCHRxxx...
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000
```

### Frontend
```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:3001/ws
REACT_APP_RPC_ENDPOINT=https://api.devnet.solana.com
REACT_APP_PROGRAM_ID=LNCHRxxx...
```

## Development

### Program Tests

```bash
cd program
anchor test
```

### Frontend Tests

```bash
cd frontend
npm test
```

### Backend Tests

```bash
cd backend
npm test
```

## Security

- Program is non-upgradeable after deployment
- All PDA seeds are derived deterministically
- Slippage protection on all trades
- Rate limiting on API endpoints
- Input validation throughout

## License

MIT License - see [LICENSE](LICENSE)

## Links

- **Orbit Finance**: [orbit.finance](https://orbit.finance)
- **CipherLabs**: [@CipherLabs_](https://twitter.com/CipherLabs_)
- **Documentation**: [docs.launchr.xyz](https://docs.launchr.xyz)

---

Built with 💚 by CipherLabs

*Launch into Orbit* 🚀
