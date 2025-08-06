# Bridge Relayer Service

A Node.js relayer service for settling cross-chain bridge intents.

## Features

- 🚀 Express server with REST API
- 🔗 Support for multiple networks (Horizen, Base)
- 🔐 Secure transaction signing
- ✅ Intent validation and verification
- 📊 Health check endpoint
- 🛡️ Security middleware (helmet, cors)

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

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Start the service:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `PRIVATE_KEY` | Wallet private key for signing | `0x...` |
| `HORIZEN_TESTNET_RPC_URL` | Horizen RPC endpoint | `https://horizen-rpc-testnet.appchain.base.org` |
| `BASE_SEPOLIA_RPC_URL` | Base Sepolia RPC endpoint | `https://sepolia.base.org` |
| `BRIDGE_CONTRACT_HORIZEN_LATEST` | Bridge contract on Horizen | `0x8d692017aEA872De988AC27FfD6B9Fed3FF0FC13` |
| `BRIDGE_CONTRACT_BASE_LATEST` | Bridge contract on Base | `0xd2C8C5C6DAD1be31077b0EeDEb78fcB62f7e1066` |

## API Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "networks": {
    "horizen": {
      "chainId": 845320009,
      "bridgeAddress": "0x8d692017aEA872De988AC27FfD6B9Fed3FF0FC13"
    },
    "base": {
      "chainId": 84532,
      "bridgeAddress": "0xd2C8C5C6DAD1be31077b0EeDEb78fcB62f7e1066"
    }
  }
}
```

### Verify Intent
```http
POST /verify
```

**Request Body:**
```json
{
  "chain2IntentId": "2",
  "chainId": 845320009
}
```

**Response:**
```json
{
  "success": true,
  "chain2IntentId": "2",
  "chainId": 845320009,
  "network": "horizen",
  "isSolved": true,
  "message": "Intent is solved on chain2"
}
```

### Settle Intent
```http
POST /settle
```

**Request Body:**
```json
{
  "intentId": "287647493468149004223305994324593771393899823106",
  "chain2IntentId": "2",
  "chainId": 845320009,
  "solverAddress": "0x93dC72De59c169AA07b23F8D487021e15C57776E"
}
```

**Response:**
```json
{
  "success": true,
  "transactionHash": "0x...",
  "blockNumber": 12345,
  "network": "horizen",
  "chainId": 845320009,
  "intentId": "287647493468149004223305994324593771393899823106",
  "chain2IntentId": "2",
  "solverAddress": "0x93dC72De59c169AA07b23F8D487021e15C57776E"
}
```

## Usage Example

```bash
# Check health
curl http://localhost:3000/health

# Verify intent is solved on chain2
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "chain2IntentId": "2",
    "chainId": 845320009
  }'

# Settle an intent (includes verification middleware)
curl -X POST http://localhost:3000/settle \
  -H "Content-Type: application/json" \
  -d '{
    "intentId": "287647493468149004223305994324593771393899823106",
    "chain2IntentId": "2",
    "chainId": 845320009,
    "solverAddress": "0x93dC72De59c169AA07b23F8D487021e15C57776E"
  }'
```

## Error Handling

The service includes comprehensive error handling:

- **400 Bad Request**: Missing parameters, invalid chainId, intent already completed, intent not solved on chain2
- **403 Forbidden**: Relayer not authorized
- **500 Internal Server Error**: Transaction failures, network issues, verification failures

## Security

- 🔐 Private key stored in environment variables
- 🛡️ Helmet middleware for security headers
- 🌐 CORS enabled for cross-origin requests
- ✅ Input validation and sanitization
- 🔍 Intent verification before settlement

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │    │   Relayer API   │    │  Bridge Contract│
│                 │    │                 │    │                 │
│ POST /verify    │───▶│ Check solved    │───▶│ solvedIntents   │
│                 │    │ status          │    │ mapping         │
│                 │    │                 │    │                 │
│ POST /settle    │───▶│ Verify Intent   │───▶│ settleIntent... │
│                 │    │ + Sign Tx       │    │                 │
│                 │    │                 │    │                 │
│ Response        │◀───│ Return Result   │◀───│ Transaction     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## License

MIT 