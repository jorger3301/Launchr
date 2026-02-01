# 🚀 Launchr

**Launch into Orbit** — Bonding curve token launches that graduate into Orbit Finance DLMM liquidity.

<p align="center">
  <img src="docs/launchr-banner.png" alt="Launchr Banner" width="100%">
</p>

## Overview

Launchr is a fair token launch platform on Solana that combines bonding curve mechanics with seamless graduation to Orbit Finance DLMM liquidity pools. No rugs. No dev dumps. Just pure, transparent launches.

### Key Features

- **🎯 Fair Launch** — Bonding curves ensure fair price discovery
- **📈 Automatic Graduation** — Tokens graduate to Orbit DLMM when threshold is reached
- **💧 Deep Liquidity** — Graduated tokens benefit from concentrated DLMM liquidity
- **🛡️ Creator Protection** — 2% creator allocation with fee sharing
- **📊 Real-time Tracking** — Monitor your positions and P&L

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         LAUNCHR                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌───────────────┐         ┌───────────────┐                   │
│   │   BONDING     │   85 SOL  │    ORBIT     │                   │
│   │   CURVE       │ ────────► │    DLMM      │                   │
│   │   PHASE       │ Graduate  │    POOL      │                   │
│   └───────────────┘           └───────────────┘                   │
│         │                            │                           │
│    Buy / Sell                   Concentrated                     │
│    on Curve                     Liquidity                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Token Economics

| Allocation | Percentage | Amount |
|------------|-----------|--------|
| Bonding Curve | 80% | 800M tokens |
| Graduation Liquidity | 18% | 180M tokens |
| Creator | 2% | 20M tokens |
| **Total Supply** | 100% | 1B tokens |

### Graduation Requirements

- **Threshold:** 85 SOL raised on bonding curve
- **Trigger:** Permissionless — anyone can graduate once threshold is reached
- **Result:** All liquidity migrates to Orbit Finance DLMM pool

## Project Structure

```
launchr/
├── programs/launchr/src/     # Solana program (Anchor)
│   ├── lib.rs                # Program entry point
│   ├── seeds.rs              # PDA seeds
│   ├── state/                # Account structures
│   │   ├── config.rs         # Global configuration
│   │   ├── launch.rs         # Token launch state
│   │   └── user_position.rs  # User positions
│   ├── math/                 # Mathematical functions
│   │   ├── bonding_curve.rs  # Constant product AMM
│   │   └── orbit_math.rs     # DLMM calculations
│   └── instructions/         # Program instructions
│       ├── init_config.rs    # Initialize protocol
│       ├── create_launch.rs  # Create new launch
│       ├── buy.rs            # Buy tokens
│       ├── sell.rs           # Sell tokens
│       └── graduate.rs       # Graduate to Orbit
│
├── app/src/                  # React frontend
│   ├── components/           # Atomic design system
│   │   ├── atoms/            # Basic UI components
│   │   ├── molecules/        # Composed components
│   │   ├── organisms/        # Feature components
│   │   └── templates/        # Page layouts
│   ├── pages/                # Page views
│   ├── hooks/                # Custom React hooks
│   └── styles/               # Global styles
│
├── Cargo.toml                # Rust workspace
└── Anchor.toml               # Anchor configuration
```

## Getting Started

### Prerequisites

- Rust 1.70+
- Solana CLI 1.18+
- Anchor 0.29+
- Node.js 18+
- Yarn or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/CipherLabs/launchr
cd launchr

# Install Rust dependencies
cargo build

# Install frontend dependencies
cd app
npm install

# Build the program
anchor build
```

### Development

```bash
# Start local validator
solana-test-validator

# Deploy program (devnet)
anchor deploy --provider.cluster devnet

# Run frontend
cd app
npm start
```

### Testing

```bash
# Run program tests
anchor test

# Run frontend tests
cd app
npm test
```

## Smart Contract

### Instructions

| Instruction | Description |
|-------------|-------------|
| `init_config` | Initialize protocol configuration (admin only) |
| `update_config` | Update fees, thresholds, pause states |
| `transfer_admin` | Transfer admin authority |
| `create_launch` | Create a new token launch |
| `buy` | Buy tokens on bonding curve |
| `sell` | Sell tokens on bonding curve |
| `graduate` | Graduate launch to Orbit DLMM |

### PDAs

| Account | Seeds |
|---------|-------|
| Config | `["config"]` |
| Launch | `["launch", mint]` |
| User Position | `["user_position", launch, user]` |
| Curve Vault | `["curve_vault", launch]` |
| Token Vault | `["token_vault", launch]` |

### Events

```rust
// Emitted when a new launch is created
LaunchCreated { launch, mint, creator, name, symbol }

// Emitted on every trade
TradeExecuted { launch, user, trade_type, sol_amount, token_amount, price }

// Emitted when launch graduates to Orbit
LaunchGraduated { launch, mint, orbit_pool, final_price, total_liquidity }
```

## Frontend

### Design System

Built with atomic design principles and a custom design language:

- **Colors:** Teal primary (#5eead4), Purple secondary (#a78bfa)
- **Theme:** Dark mode with glassmorphism effects
- **Typography:** Inter font family

### Components

#### Atoms
- Button, Input, Text, Badge, Spinner
- ProgressBar, Avatar, Skeleton, Card
- Icons (Rocket, Trending, Wallet, etc.)
- LaunchrLogo

#### Molecules
- SearchBar, TokenBadge, PriceDisplay
- StatCard, GraduationProgress, TradeInput
- TransactionRow, PositionSummary, SocialLinks

#### Organisms
- TradePanel, LaunchHeader, LaunchGrid
- TransactionFeed, HoldersList, CreateLaunchForm
- PriceChart

#### Templates
- MainLayout, LaunchDetailLayout
- CreateLaunchLayout, LoadingLayout, ErrorLayout

## API Reference

### Hooks

```typescript
// Wallet connection
const { address, balance, connected, connect, disconnect } = useWallet();

// Fetch all launches
const { launches, trendingLaunches, loading, refetch } = useLaunches();

// Single launch details
const { launch, trades, holders, priceHistory } = useLaunch(publicKey);

// User position
const { position, loading } = useUserPosition(launchPk, userAddress);

// Trading
const { buy, sell, loading, error } = useTrade(wallet);

// Create new launch
const { createLaunch, loading, error } = useCreateLaunch(wallet);
```

## Fees

| Fee Type | Amount | Distribution |
|----------|--------|--------------|
| Protocol Fee | 1% | Protocol treasury |
| Creator Fee | 0-3% | Launch creator |
| **Post-Graduation** | | |
| CIPHER Holders | 30% | Fee vault |
| NFT Holders | 20% | Fee vault |
| Creator | Variable | Creator address |

## Security

- All smart contracts are open source
- Bonding curve math uses checked arithmetic
- PDAs ensure account security
- Creator tokens are locked during bonding phase

## Roadmap

- [x] Bonding curve mechanics
- [x] Orbit Finance DLMM integration
- [x] Frontend application
- [ ] Mainnet deployment
- [ ] Token locking mechanisms
- [ ] Advanced analytics
- [ ] Mobile app

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License — see [LICENSE](LICENSE) for details.

## Links

- 🌐 Website: [launchr.cipherlabs.xyz](https://launchr.cipherlabs.xyz)
- 🐦 Twitter: [@CipherLabs_](https://twitter.com/CipherLabs_)
- 📚 Docs: [docs.cipherlabs.xyz/launchr](https://docs.cipherlabs.xyz/launchr)
- 💬 Discord: [discord.gg/cipherlabs](https://discord.gg/cipherlabs)

---

<p align="center">
  Built with 💚 by <a href="https://cipherlabs.xyz">CipherLabs</a>
  <br>
  Powered by <a href="https://orbit.finance">Orbit Finance</a>
</p>
