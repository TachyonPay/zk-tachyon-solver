# Cross-Chain Bridge with Solver Network

A smart contract-based bridging solution that uses an auction mechanism to connect solvers with users who want to bridge tokens across chains.

## Overview

This bridging solution operates on a solver network model where:
1. **Users** create intents to bridge tokens from one chain to another
2. **Solvers** compete in auctions to fulfill these intents 
3. **Relayers** verify cross-chain completion and distribute funds
4. The system rewards the most competitive solvers while ensuring user funds are secure

## Architecture

### Core Components

#### BridgeIntent Contract
The main contract that handles:
- Intent creation and auction management
- Solver bidding and selection
- Fund escrow and distribution
- Relayer authorization

#### Intent Structure
Each bridging intent contains:
- `tokenA`: Source token address
- `tokenB`: Destination token address  
- `amountA`: Amount to bridge from source
- `expectedAmountB`: Expected amount on destination
- `reward`: Incentive for the solver
- `endTime`: Auction deadline
- `winningSolver`: Address of winning bidder
- `winningBid`: Amount solver committed to provide

### Workflow

1. **Intent Creation**
   - User calls `createIntent()` with bridging parameters
   - Contract escrows user's tokens (tokenA) and reward
   - `IntentCreated` event emitted for solvers to monitor

2. **Auction Phase**
   - Solvers monitor for new intents
   - Place bids using `placeBid()` in **tokenA** (amount they're willing to accept)
   - Higher bids win the auction
   - Auction runs until `endTime`
   - Anyone can call `finalizeAuction()` to determine winner

3. **Solver Execution**
   - Winning solver calls `depositAndPickup()` to deposit **tokenA** as collateral
   - Solver provides **tokenB** to recipients on destination chain (off-chain)
   - Relayer verifies the cross-chain completion

4. **Settlement**
   - Authorized relayer calls `settleIntent()` after verifying completion
   - Contract transfers ALL tokenA to solver:
     - User's original amount + reward + solver's deposit back
   - Intent is marked as completed

## Smart Contract Functions

### User Functions

#### `createIntent(tokenA, tokenB, amountA, expectedAmountB, reward, auctionDuration)`
Creates a new bridging intent with specified parameters.

**Parameters:**
- `tokenA`: Source token contract address
- `tokenB`: Destination token contract address
- `amountA`: Amount of source tokens to bridge
- `expectedAmountB`: Minimum expected tokens on destination
- `reward`: Reward amount for successful solver
- `auctionDuration`: How long auction runs (5 min - 24 hours)

#### `cancelIntent(intentId)`
Emergency cancellation after timeout (1+ hours past auction end).

### Solver Functions

#### `placeBid(intentId, bidAmount)`
Place or update bid on an intent in **tokenA** (source token).

**Parameters:**
- `intentId`: Intent to bid on
- `bidAmount`: Amount of **tokenA** willing to accept (higher bids win)

#### `finalizeAuction(intentId)`
Determine auction winner after end time (callable by anyone).

#### `depositAndPickup(intentId)`
Winner deposits their bid amount in **tokenA** as collateral.

### Relayer Functions

#### `settleIntent(intentId)`
Settle intent after successful cross-chain completion.

Transfers to solver:
- User's original tokenA amount
- User's reward 
- Solver's tokenA deposit back

**Parameters:**
- `intentId`: Intent to settle

#### `distributeFunds(intentId, recipients, amounts)` (Legacy)
Legacy function for same-chain scenarios - not used in cross-chain flow.

### Admin Functions

#### `addRelayer(address)` / `removeRelayer(address)`
Manage authorized relayers (owner only).

## Events

### `IntentCreated`
```solidity
event IntentCreated(
    uint256 indexed intentId,
    address indexed user,
    address tokenA,
    address tokenB, 
    uint256 amountA,
    uint256 expectedAmountB,
    uint256 reward,
    uint256 endTime
);
```

### `BidPlaced`
```solidity
event BidPlaced(
    uint256 indexed intentId,
    address indexed solver,
    uint256 bidAmount,
    uint256 timestamp
);
```

### `IntentWon`
```solidity
event IntentWon(
    uint256 indexed intentId,
    address indexed winningSolver,
    uint256 winningBid
);
```

### `SolverDeposited`
```solidity
event SolverDeposited(
    uint256 indexed intentId,
    address indexed solver,
    uint256 amount
);
```

### `IntentSettled`
```solidity
event IntentSettled(
    uint256 indexed intentId,
    address indexed solver,
    uint256 amountA,
    uint256 reward,
    uint256 winningBid
);
```

### `IntentCompleted`
```solidity
event IntentCompleted(
    uint256 indexed intentId,
    address indexed solver
);
```

## Usage Example

```javascript
// User creates bridging intent
await tokenA.approve(bridgeContract.address, amountA + reward);
await bridgeContract.createIntent(
    tokenA.address,
    tokenB.address, 
    ethers.parseEther("100"),    // 100 tokenA to bridge
    ethers.parseEther("95"),     // expecting 95 tokenB on destination
    ethers.parseEther("5"),      // 5 tokenA reward
    3600                         // 1 hour auction
);

// Solvers place competitive bids in tokenA (amount they're willing to accept)
await tokenA.connect(solver1).approve(bridgeContract.address, ethers.parseEther("96"));
await bridgeContract.connect(solver1).placeBid(1, ethers.parseEther("96"));

await tokenA.connect(solver2).approve(bridgeContract.address, ethers.parseEther("98"));
await bridgeContract.connect(solver2).placeBid(1, ethers.parseEther("98"));

// After auction ends, finalize
await bridgeContract.finalizeAuction(1);

// Winner deposits tokenA as collateral
await bridgeContract.connect(winningSolver).depositAndPickup(1);

// Solver provides tokenB to recipients on destination chain (off-chain)
// ... solver completes cross-chain transfer ...

// Relayer settles on source chain - transfers all tokenA to solver
await bridgeContract.connect(relayer).settleIntent(1);
// Solver receives: user's 100 tokenA + 5 tokenA reward + 98 tokenA deposit back = 203 tokenA total
```

## Development

### Setup
```bash
npm install
```

### Compile
```bash
npx hardhat compile
```

### Test
```bash
npx hardhat test
```

### Deploy
```bash
npx hardhat run scripts/deploy.ts --network <network>
```

## Security Features

- **Reentrancy Protection**: All state-changing functions use `nonReentrant` modifier
- **Access Control**: Relayer authorization system with owner controls
- **Fund Safety**: Escrow system ensures user funds are protected
- **Timeout Protection**: Emergency cancellation for stuck intents
- **Input Validation**: Comprehensive parameter checking

## Gas Optimization

- Efficient auction mechanism using array storage
- Minimal state updates during bidding
- Batch distribution capability for multiple recipients
- Events for off-chain monitoring and indexing

## License

MIT License
