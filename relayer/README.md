# Bridge Relayer Service

A Node.js relayer service for settling cross-chain bridge intents with SP1 zk proof verification support.

## Features

- 🚀 Express server with REST API
- 🔗 Support for multiple networks (Horizen, Base)
- 🔐 Secure transaction signing
- ✅ Intent validation and verification
- 🔐 SP1 zk proof verification for Base destination
- 🔐 Privacy endpoints for recipient information storage
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
| `ZKV_API_KEY` | zkVerify API key for proof verification | `your_api_key_here` |

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

### Privacy Endpoints

#### Store Recipient Information
```http
POST /store-recipients
```

**Request Body:**
```json
{
  "intentId": "287647493468149004223305994324593771393899823122",
  "recipients": [
    "0x8EA2c2076a1c43817C96cb50f84FD12cd2A42101",
    "0x4075Bdc413df13a84F8dA8651eC13d7552AE46D5"
  ],
  "amounts": [
    "50000000000000000000",
    "30000000000000000000"
  ],
  "chainId": 84532
}
```

**Response:**
```json
{
  "success": true,
  "intentId": "287647493468149004223305994324593771393899823122",
  "message": "Recipient information stored successfully",
  "timestamp": 1754550128919
}
```

#### Get Recipient Information
```http
GET /get-recipients/:intentId
```

**Response:**
```json
{
  "success": true,
  "intentId": "287647493468149004223305994324593771393899823122",
  "recipients": [
    "0x8EA2c2076a1c43817C96cb50f84FD12cd2A42101",
    "0x4075Bdc413df13a84F8dA8651eC13d7552AE46D5"
  ],
  "amounts": [
    "50000000000000000000",
    "30000000000000000000"
  ],
  "timestamp": 1754550128919,
  "chainId": 84532,
  "totalAmount": "80000000000000000000"
}
```

#### List All Stored Intents
```http
GET /list-stored-intents
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "intents": [
    {
      "intentId": "287647493468149004223305994324593771393899823122",
      "recipientCount": 2,
      "totalAmount": "80000000000000000000",
      "timestamp": 1754550128919,
      "chainId": 84532
    }
  ]
}
```

#### Delete Recipient Information
```http
DELETE /delete-recipients/:intentId
```

**Response:**
```json
{
  "success": true,
  "intentId": "287647493468149004223305994324593771393899823122",
  "message": "Recipient information deleted successfully"
}
```

### Regular Settlement
```http
POST /settle
```

**Request Body:**
```json
{
  "intentId": "287647493468149004223305994324593771393899823106",
  "chain2IntentId": "2",
  "originChainId": 845320009,
  "destinationChainId": 84532,
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

### Settlement with Proof Verification
```http
POST /settle-with-proof
```

**Request Body:**
```json
{
  "intentId": "287647493468149004223305994324593771393899823106",
  "chain2IntentId": "2",
  "originChainId": 845320009,
  "destinationChainId": 84532,
  "solverAddress": "0x93dC72De59c169AA07b23F8D487021e15C57776E",
  "proofData": {
    "proof": "proof_data_here",
    "publicSignals": ["signal1", "signal2"],
    "imageId": "image_id_here"
  }
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
  "solverAddress": "0x93dC72De59c169AA07b23F8D487021e15C57776E",
  "proofVerification": {
    "jobId": "23382e04-3d57-11f0-af7b-32a805cdbfd3",
    "status": "Finalized",
    "txHash": "0xc0d85e5d50fff2bb5d192ee108664878e228d7fc3c1faa2d23da891832873d51",
    "blockHash": "0xcd574432b1a961305bbeb2c6b6ef399e1ae5102593846756cbb472bfd53d7d43"
  }
}
```

### Standalone Proof Submission
```http
POST /submit-proof
```

**Request Body:**
```json
{
  "proofData": {
    "proof": "proof_data_here",
    "publicSignals": ["signal1", "signal2"],
    "imageId": "image_id_here"
  }
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "23382e04-3d57-11f0-af7b-32a805cdbfd3",
  "message": "Proof submitted successfully",
  "status": "Submitted",
  "optimisticVerify": "success"
}
```

### Proof Status Check
```http
GET /proof-status/:jobId
```

**Response:**
```json
{
  "success": true,
  "jobId": "23382e04-3d57-11f0-af7b-32a805cdbfd3",
  "status": "Finalized",
  "details": {
    "jobId": "23382e04-3d57-11f0-af7b-32a805cdbfd3",
    "status": "Finalized",
    "statusId": 4,
    "proofType": "sp1",
    "chainId": null,
    "createdAt": "2025-05-30T13:08:11.000Z",
    "updatedAt": "2025-05-30T13:08:27.000Z",
    "txHash": "0xc0d85e5d50fff2bb5d192ee108664878e228d7fc3c1faa2d23da891832873d51",
    "blockHash": "0xcd574432b1a961305bbeb2c6b6ef399e1ae5102593846756cbb472bfd53d7d43"
  }
}
```

## Proof Verification Flow

### For Base Destination (Proof Required)
1. **Intent Verification**: Check if intent is solved on Base
2. **Proof Verification**: 
   - Register verification key with zkVerify
   - Submit proof for verification
   - Wait for finalization (up to 5 minutes)
3. **Settlement**: Proceed with settlement only after proof is finalized

### For Other Destinations (No Proof Required)
1. **Intent Verification**: Check if intent is solved on destination chain
2. **Settlement**: Proceed directly with settlement

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

# Regular settlement (no proof required)
curl -X POST http://localhost:3000/settle \
  -H "Content-Type: application/json" \
  -d '{
    "intentId": "287647493468149004223305994324593771393899823106",
    "chain2IntentId": "2",
    "originChainId": 845320009,
    "destinationChainId": 84532,
    "solverAddress": "0x93dC72De59c169AA07b23F8D487021e15C57776E"
  }'

# Settlement with proof verification (Base destination)
curl -X POST http://localhost:3000/settle-with-proof \
  -H "Content-Type: application/json" \
  -d '{
    "intentId": "287647493468149004223305994324593771393899823106",
    "chain2IntentId": "2",
    "originChainId": 845320009,
    "destinationChainId": 84532,
    "solverAddress": "0x93dC72De59c169AA07b23F8D487021e15C57776E",
    "proofData": {
      "proof": "proof_data_here",
      "publicSignals": ["signal1", "signal2"],
      "imageId": "image_id_here"
    }
  }'

# Standalone proof submission
curl -X POST http://localhost:3000/submit-proof \
  -H "Content-Type: application/json" \
  -d '{
    "proofData": {
      "proof": "proof_data_here",
      "publicSignals": ["signal1", "signal2"],
      "imageId": "image_id_here"
    }
  }'

# Check proof status
curl http://localhost:3000/proof-status/23382e04-3d57-11f0-af7b-32a805cdbfd3
```

## Error Handling

The service includes comprehensive error handling:

- **400 Bad Request**: Missing parameters, invalid chainId, intent already completed, intent not solved on chain2, invalid proof data
- **403 Forbidden**: Relayer not authorized
- **408 Timeout**: Proof verification timeout
- **500 Internal Server Error**: Transaction failures, network issues, verification failures

## Security

- 🔐 Private key stored in environment variables
- 🛡️ Helmet middleware for security headers
- 🌐 CORS enabled for cross-origin requests
- ✅ Input validation and sanitization
- 🔍 Intent verification before settlement
- 🔐 SP1 proof verification for Base destination

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

# Test proof verification functionality
npx ts-node ../scripts/testProofVerification.ts
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │    │   Relayer API   │    │  Bridge Contract│    │   zkVerify      │
│                 │    │                 │    │                 │    │   API           │
│ POST /verify    │───▶│ Check solved    │───▶│ solvedIntents   │    │                 │
│                 │    │ status          │    │ mapping         │    │                 │
│                 │    │                 │    │                 │    │                 │
│ POST /settle    │───▶│ Verify Intent   │───▶│ settleIntent... │    │                 │
│                 │    │ + Sign Tx       │    │                 │    │                 │
│                 │    │                 │    │                 │    │                 │
│ POST /settle-   │───▶│ Verify Intent   │───▶│ settleIntent... │◀───│ Proof Verify    │
│ with-proof      │    │ + Proof Verify  │    │                 │    │                 │
│                 │    │ + Sign Tx       │    │                 │    │                 │
│                 │    │                 │    │                 │    │                 │
│ Response        │◀───│ Return Result   │◀───│ Transaction     │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## License

MIT 