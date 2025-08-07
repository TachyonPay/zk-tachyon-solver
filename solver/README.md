# Bridge Solver Service

An automated solver service that listens to cross-chain bridge intent events and automatically participates in auctions, deposits, and cross-chain settlements.

## Features

- 🎯 **Event Listening**: Listens to `IntentCreated` events on both Horizen and Base networks
- 🏆 **Automated Bidding**: Automatically places bids and competes in auctions
- 💰 **Profit Calculation**: Calculates profitable bids based on configurable profit margins
- 🔄 **Cross-Chain Solution**: Automatically solves intents on destination chains
- 📡 **Relayer Integration**: Integrates with the bridge relayer for settlement
- 🔐 **Token Management**: Handles token approvals and balance checks
- ⚡ **Real-time Monitoring**: Monitors auction status and adjusts bids accordingly

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Start the solver:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm run build
   npm start
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PRIVATE_KEY` | Solver wallet private key | Required |
| `HORIZEN_TESTNET_RPC_URL` | Horizen RPC endpoint | Required |
| `BASE_SEPOLIA_RPC_URL` | Base Sepolia RPC endpoint | Required |
| `BRIDGE_CONTRACT_HORIZEN_LATEST` | Bridge contract on Horizen | Required |
| `BRIDGE_CONTRACT_BASE_LATEST` | Bridge contract on Base | Required |
| `RELAYER_URL` | Relayer API URL | `http://localhost:3000` |
| `MIN_PROFIT_MARGIN` | Minimum profit margin (0.02 = 2%) | `0.02` |
| `MAX_BID_AMOUNT` | Maximum bid amount in tokens | `1000` |
| `BID_INCREMENT` | Bid increment in tokens | `1` |
| `BALANCE_BUFFER` | Balance buffer (0.1 = 10%) | `0.1` |

## How It Works

### 1. Event Listening
- Listens to `IntentCreated` events on both networks
- Analyzes intent parameters for profitability
- Checks token balances and affordability

### 2. Automated Bidding
- Calculates profitable bid based on amount + reward - profit margin
- Places initial bid immediately
- Monitors auction every 10 seconds
- Increases bid if outbid (within budget constraints)

### 3. Auction Management
- Automatically finalizes auction when time expires
- Checks if we won the auction
- Handles deposit process if we won

### 4. Cross-Chain Solution
- Determines destination network (opposite of origin)
- Fetches recipient information from relayer
- Checks TokenB balance on destination chain
- Calls `solveIntentOnChain2` with recipient data

### 5. Settlement
- Calls relayer `/settle` endpoint
- Waits for settlement confirmation
- Verifies final balance increase

## Configuration

### Profit Margins
```bash
MIN_PROFIT_MARGIN=0.02  # 2% minimum profit
```

### Bid Management
```bash
MAX_BID_AMOUNT=1000     # Maximum 1000 tokens per bid
BID_INCREMENT=1         # Increase bid by 1 token when outbid
BALANCE_BUFFER=0.1      # Keep 10% of balance as buffer
```

## Usage Example

```bash
# Start the solver
npm run dev

# The solver will automatically:
# 1. Listen for new intents
# 2. Place profitable bids
# 3. Win auctions
# 4. Deposit tokens
# 5. Solve on destination chain
# 6. Settle via relayer
```

## Logging

The solver provides detailed logging:

```
🚀 Starting Bridge Solver...
💰 Min Profit Margin: 2%
💸 Max Bid Amount: 1000.0 tokens
📈 Bid Increment: 1.0 tokens
🔗 Relayer URL: http://localhost:3000

👂 Listening to events on Horizen Testnet...
👂 Listening to events on Base Sepolia...

🎯 New intent created on Horizen Testnet:
   - Intent ID: 123456789
   - AmountA: 100.0
   - Reward: 5.0
   - End Time: 2024-01-01T12:00:00.000Z

💡 Calculated profitable bid: 102.0
🏁 Placing bid 102.0 for intent 123456789...
✅ Bid placed successfully

🏆 We won the auction for intent 123456789!
🔨 Finalizing auction...
✅ Auction finalized

💳 Depositing 102.0 for intent 123456789...
✅ Deposit completed

🌐 Starting cross-chain solution...
📡 Fetching recipient info...
🔧 Solving intent on Base Sepolia...
✅ Intent solved on Base Sepolia

📡 Calling relayer to settle...
✅ Settlement successful!
💰 Final balance: 1100.0 tokens
```

## Security

- 🔐 Private key stored in environment variables
- 💰 Balance checks before bidding
- 🛡️ Profit margin validation
- ⚠️ Budget constraints enforcement

## Error Handling

- Network connection failures
- Insufficient token balances
- Failed transactions
- Relayer API errors
- Invalid recipient data

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Bridge        │    │   Solver        │    │   Relayer       │
│   Contracts     │    │   Service       │    │   API           │
│                 │    │                 │    │                 │
│ IntentCreated   │───▶│ Event Listener  │    │                 │
│ Events          │    │                 │    │                 │
│                 │    │ Bidding Engine  │    │                 │
│ BidPlaced       │◀───│                 │    │                 │
│ Events          │    │ Auction Manager │    │                 │
│                 │    │                 │    │                 │
│ IntentWon       │◀───│ Cross-Chain     │───▶│ /settle         │
│ Events          │    │ Solver          │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## License

MIT 