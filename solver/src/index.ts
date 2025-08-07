import { ethers } from 'ethers';
import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { NetworkConfig, Intent, RecipientInfo, BidInfo, SolverConfig, RelayerResponse } from './types';

// Load environment variables
dotenv.config();

class BridgeSolver {
  private networks: { [key: string]: NetworkConfig } = {};
  private providers: { [key: string]: ethers.Provider } = {};
  private wallets: { [key: string]: ethers.Wallet } = {};
  private contracts: { [key: string]: ethers.Contract } = {};
  private config: SolverConfig = {
    minProfitMargin: 0.02,
    maxBidAmount: ethers.parseEther('1000'),
    bidIncrement: ethers.parseEther('1'),
    balanceBuffer: 0.1
  };
  private relayerUrl: string = 'http://localhost:3000';
  private isRunning: boolean = false;
  private activeIntents: Map<string, any> = new Map();
  private lastProcessedBlocks: { [key: string]: number } = {};
  private app!: express.Application;
  private server: any;

  constructor() {
    this.setupNetworks();
    this.setupConfig();
    this.setupConnections();
    this.setupExpressServer();
  }

  private setupNetworks() {
    this.networks = {
      horizen: {
        name: "Horizen Testnet",
        rpcUrl: process.env.HORIZEN_TESTNET_RPC_URL!,
        chainId: 845320009,
        bridgeAddress: process.env.BRIDGE_CONTRACT_HORIZEN_LATEST!,
        explorer: "https://horizen-explorer-testnet.appchain.base.org"
      },
      base: {
        name: "Base Sepolia",
        rpcUrl: process.env.BASE_SEPOLIA_RPC_URL!,
        chainId: 84532,
        bridgeAddress: process.env.BRIDGE_CONTRACT_BASE_LATEST!,
        explorer: "https://sepolia-explorer.base.org"
      }
    };
  }

  private setupConfig() {
    this.config = {
      minProfitMargin: parseFloat(process.env.MIN_PROFIT_MARGIN || '0.02'),
      maxBidAmount: ethers.parseEther(process.env.MAX_BID_AMOUNT || '1000'),
      bidIncrement: ethers.parseEther(process.env.BID_INCREMENT || '1'),
      balanceBuffer: parseFloat(process.env.BALANCE_BUFFER || '0.1')
    };
    this.relayerUrl = process.env.RELAYER_URL || 'http://localhost:3000';
  }

  private setupConnections() {
    const privateKey = process.env.PRIVATE_KEY!;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }

    this.providers = {};
    this.wallets = {};
    this.contracts = {};

    const contractArtifact = require('./BridgeIntent.json');

    for (const [networkKey, network] of Object.entries(this.networks)) {
      this.providers[networkKey] = new ethers.JsonRpcProvider(network.rpcUrl);
      this.wallets[networkKey] = new ethers.Wallet(privateKey, this.providers[networkKey]);
      this.contracts[networkKey] = new ethers.Contract(
        network.bridgeAddress,
        contractArtifact.abi,
        this.wallets[networkKey]
      );
    }
  }

  private setupExpressServer() {
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));

    // Health check endpoint
    this.app.get('/health', (req: express.Request, res: express.Response) => {
      res.json({
        status: 'healthy',
        service: 'bridge-solver',
        timestamp: new Date().toISOString(),
        networks: Object.keys(this.networks),
        activeIntents: this.activeIntents.size,
        isRunning: this.isRunning
      });
    });

    // Get solver status
    this.app.get('/status', (req: express.Request, res: express.Response) => {
      res.json({
        solver: {
          address: this.wallets['horizen']?.address,
          isRunning: this.isRunning,
          config: {
            minProfitMargin: this.config.minProfitMargin,
            maxBidAmount: ethers.formatEther(this.config.maxBidAmount),
            bidIncrement: ethers.formatEther(this.config.bidIncrement),
            balanceBuffer: this.config.balanceBuffer
          }
        },
        networks: Object.entries(this.networks).map(([key, network]) => ({
          name: network.name,
          chainId: network.chainId,
          lastProcessedBlock: this.lastProcessedBlocks[key] || 0
        })),
        activeIntents: Array.from(this.activeIntents.entries()).map(([intentId, info]) => ({
          intentId,
          networkKey: info.networkKey,
          isBidding: info.isBidding,
          profitableBid: ethers.formatEther(info.profitableBid)
        }))
      });
    });

    // Get active intents
    this.app.get('/active-intents', (req: express.Request, res: express.Response) => {
      const intents = Array.from(this.activeIntents.entries()).map(([intentId, info]) => ({
        intentId,
        networkKey: info.networkKey,
        user: info.user,
        tokenA: info.tokenA,
        tokenB: info.tokenB,
        amountA: ethers.formatEther(info.amountA),
        expectedAmountB: ethers.formatEther(info.expectedAmountB),
        reward: ethers.formatEther(info.reward),
        endTime: new Date(Number(info.endTime) * 1000).toISOString(),
        profitableBid: ethers.formatEther(info.profitableBid),
        isBidding: info.isBidding
      }));
      res.json({ intents });
    });

    // Stop solver endpoint
    this.app.post('/stop', (req: express.Request, res: express.Response) => {
      this.stop();
      res.json({ message: 'Solver stopped successfully' });
    });

    // Start solver endpoint
    this.app.post('/start', (req: express.Request, res: express.Response) => {
      if (!this.isRunning) {
        this.start().then(() => {
          res.json({ message: 'Solver started successfully' });
        }).catch(error => {
          res.status(500).json({ error: error.message });
        });
      } else {
        res.json({ message: 'Solver is already running' });
      }
    });

    // Manual intent status check endpoint
    this.app.get('/intent-status/:intentId/:network', async (req: express.Request, res: express.Response) => {
      try {
        const intentId = req.params.intentId;
        const networkKey = req.params.network;
        
        if (!this.networks[networkKey]) {
          return res.status(400).json({ error: `Invalid network: ${networkKey}. Valid networks: ${Object.keys(this.networks).join(', ')}` });
        }

        const contract = this.contracts[networkKey];
        const now = BigInt(Math.floor(Date.now() / 1000));

        // Get intent details
        const intent = await contract.intents(intentId);
        const [highestBid, highestBidder] = await contract.getHighestBid(intentId);
        
        const timeLeft = Number(intent.endTime - now);
        const isWinning = highestBidder === this.wallets[networkKey].address;
        
        const status = {
          intentId,
          network: networkKey,
          intent: {
            user: intent.user,
            tokenA: intent.tokenA,
            tokenB: intent.tokenB,
            amountA: ethers.formatEther(intent.amountA),
            expectedAmountB: ethers.formatEther(intent.expectedAmountB),
            reward: ethers.formatEther(intent.reward),
            endTime: new Date(Number(intent.endTime) * 1000).toISOString(),
            completed: intent.completed,
            deposited: intent.deposited,
            winningSolver: intent.winningSolver,
            winningBid: ethers.formatEther(intent.winningBid)
          },
          auction: {
            currentHighestBid: ethers.formatEther(highestBid),
            currentHighestBidder: highestBidder,
            timeLeftSeconds: timeLeft,
            timeLeftFormatted: timeLeft > 0 ? `${Math.floor(timeLeft/60)}m ${timeLeft%60}s` : 'Ended',
            hasEnded: timeLeft <= 0,
            ourAddress: this.wallets[networkKey].address,
            areWeWinning: isWinning,
            areWeParticipating: this.activeIntents.has(intentId)
          },
          currentTime: new Date().toISOString(),
          currentTimestamp: Number(now)
        };

        res.json(status);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Alternative endpoint with default network
    this.app.get('/intent-status/:intentId', async (req: express.Request, res: express.Response) => {
      try {
        const intentId = req.params.intentId;
        const networkKey = 'horizen'; // Default to horizen
        
        const contract = this.contracts[networkKey];
        const now = BigInt(Math.floor(Date.now() / 1000));

        // Get intent details
        const intent = await contract.intents(intentId);
        const [highestBid, highestBidder] = await contract.getHighestBid(intentId);
        
        const timeLeft = Number(intent.endTime - now);
        const isWinning = highestBidder === this.wallets[networkKey].address;
        
        const status = {
          intentId,
          network: networkKey,
          intent: {
            user: intent.user,
            tokenA: intent.tokenA,
            tokenB: intent.tokenB,
            amountA: ethers.formatEther(intent.amountA),
            expectedAmountB: ethers.formatEther(intent.expectedAmountB),
            reward: ethers.formatEther(intent.reward),
            endTime: new Date(Number(intent.endTime) * 1000).toISOString(),
            completed: intent.completed,
            deposited: intent.deposited,
            winningSolver: intent.winningSolver,
            winningBid: ethers.formatEther(intent.winningBid)
          },
          auction: {
            currentHighestBid: ethers.formatEther(highestBid),
            currentHighestBidder: highestBidder,
            timeLeftSeconds: timeLeft,
            timeLeftFormatted: timeLeft > 0 ? `${Math.floor(timeLeft/60)}m ${timeLeft%60}s` : 'Ended',
            hasEnded: timeLeft <= 0,
            ourAddress: this.wallets[networkKey].address,
            areWeWinning: isWinning,
            areWeParticipating: this.activeIntents.has(intentId)
          },
          currentTime: new Date().toISOString(),
          currentTimestamp: Number(now)
        };

        res.json(status);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Manual auction finalization endpoint
    this.app.post('/finalize-auction/:intentId/:network', async (req: express.Request, res: express.Response) => {
      try {
        const intentId = req.params.intentId;
        const networkKey = req.params.network;
        
        if (!this.networks[networkKey]) {
          return res.status(400).json({ error: `Invalid network: ${networkKey}. Valid networks: ${Object.keys(this.networks).join(', ')}` });
        }

        console.log(`🔨 Manual finalization requested for intent ${intentId} on ${networkKey}`);
        await this.handleAuctionEnd(networkKey, BigInt(intentId));
        
        res.json({ 
          message: `Auction finalization attempted for intent ${intentId}`,
          network: networkKey
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Alternative finalization endpoint with default network
    this.app.post('/finalize-auction/:intentId', async (req: express.Request, res: express.Response) => {
      try {
        const intentId = req.params.intentId;
        const networkKey = 'horizen';

        console.log(`🔨 Manual finalization requested for intent ${intentId} on ${networkKey}`);
        await this.handleAuctionEnd(networkKey, BigInt(intentId));
        
        res.json({ 
          message: `Auction finalization attempted for intent ${intentId}`,
          network: networkKey
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  public async start() {
    console.log('🚀 Starting Bridge Solver...');
    console.log(`💰 Min Profit Margin: ${this.config.minProfitMargin * 100}%`);
    console.log(`💸 Max Bid Amount: ${ethers.formatEther(this.config.maxBidAmount)} tokens`);
    console.log(`📈 Bid Increment: ${ethers.formatEther(this.config.bidIncrement)} tokens`);
    console.log(`🔗 Relayer URL: ${this.relayerUrl}`);

    this.isRunning = true;

    // Start HTTP server
    const port = 3001;
    this.server = this.app.listen(port, () => {
      console.log(`🌐 Solver HTTP server started on port ${port}`);
      console.log(`📡 Health check: http://localhost:${port}/health`);
      console.log(`📊 Status: http://localhost:${port}/status`);
      console.log(`🎯 Active intents: http://localhost:${port}/active-intents`);
    });

    // Initialize last processed blocks
    for (const [networkKey, network] of Object.entries(this.networks)) {
      const currentBlock = await this.providers[networkKey].getBlockNumber();
      this.lastProcessedBlocks[networkKey] = currentBlock;
      console.log(`📦 Starting from block ${currentBlock} on ${network.name}`);
    }

    // Start polling for events on both networks
    for (const [networkKey, network] of Object.entries(this.networks)) {
      this.startEventPolling(networkKey, network);
    }

    console.log('✅ Solver started and polling for events...');
  }

  private async startEventPolling(networkKey: string, network: NetworkConfig) {
    console.log(`👂 Starting event polling on ${network.name}...`);

    const pollInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(pollInterval);
        return;
      }

      try {
        await this.pollForEvents(networkKey, network);
      } catch (error) {
        console.error(`❌ Error polling events on ${network.name}:`, error);
      }
    }, 5000); // Poll every 5 seconds

    console.log(`✅ Event polling started for ${network.name}`);
  }

  private async pollForEvents(networkKey: string, network: NetworkConfig) {
    const provider = this.providers[networkKey];
    const contract = this.contracts[networkKey];
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = this.lastProcessedBlocks[networkKey] + 1;

    if (fromBlock > currentBlock) {
      return; // No new blocks
    }

    const toBlock = Math.min(fromBlock + 99, currentBlock); // Process max 100 blocks at a time

    try {
      // Get IntentCreated events
      const intentCreatedFilter = {
        address: contract.target,
        topics: [
          ethers.id('IntentCreated(uint256,address,address,address,uint256,uint256,uint256,uint256)')
        ],
        fromBlock: fromBlock,
        toBlock: toBlock
      };

      const intentCreatedLogs = await provider.getLogs(intentCreatedFilter);
      
      for (const log of intentCreatedLogs) {
        const parsedLog = contract.interface.parseLog(log);
        const [intentId, user, tokenA, tokenB, amountA, expectedAmountB, reward, endTime] = parsedLog!.args;
        
        console.log(`🎯 New intent created on ${network.name}:`);
        console.log(`   - Intent ID: ${intentId}`);
        console.log(`   - User: ${user}`);
        console.log(`   - TokenA: ${tokenA}`);
        console.log(`   - TokenB: ${tokenB}`);
        console.log(`   - AmountA: ${ethers.formatEther(amountA)}`);
        console.log(`   - ExpectedAmountB: ${ethers.formatEther(expectedAmountB)}`);
        console.log(`   - Reward: ${ethers.formatEther(reward)}`);
        console.log(`   - End Time: ${new Date(Number(endTime) * 1000).toISOString()}`);

        await this.handleNewIntent(networkKey, intentId, user, tokenA, tokenB, amountA, expectedAmountB, reward, endTime);
      }

      // Get BidPlaced events
      const bidPlacedFilter = {
        address: contract.target,
        topics: [
          ethers.id('BidPlaced(uint256,address,uint256,uint256)')
        ],
        fromBlock: fromBlock,
        toBlock: toBlock
      };

      const bidPlacedLogs = await provider.getLogs(bidPlacedFilter);
      
      for (const log of bidPlacedLogs) {
        const parsedLog = contract.interface.parseLog(log);
        const [intentId, solver, bidAmount, timestamp] = parsedLog!.args;
        
        if (solver === this.wallets[networkKey].address) {
          console.log(`🏆 Our bid placed on ${network.name}:`);
          console.log(`   - Intent ID: ${intentId}`);
          console.log(`   - Bid Amount: ${ethers.formatEther(bidAmount)}`);
        }
      }

      // Get IntentWon events
      const intentWonFilter = {
        address: contract.target,
        topics: [
          ethers.id('IntentWon(uint256,address,uint256)')
        ],
        fromBlock: fromBlock,
        toBlock: toBlock
      };

      const intentWonLogs = await provider.getLogs(intentWonFilter);
      
      for (const log of intentWonLogs) {
        const parsedLog = contract.interface.parseLog(log);
        const [intentId, solver, bidAmount] = parsedLog!.args;
        
        if (solver === this.wallets[networkKey].address) {
          console.log(`🎉 We won the auction on ${network.name}:`);
          console.log(`   - Intent ID: ${intentId}`);
          console.log(`   - Winning Bid: ${ethers.formatEther(bidAmount)}`);
          
          await this.handleAuctionWon(networkKey, intentId, bidAmount);
        }
      }

      // Update last processed block
      this.lastProcessedBlocks[networkKey] = toBlock;

    } catch (error) {
      console.error(`❌ Error polling events on ${network.name}:`, error);
    }
  }

  private async handleNewIntent(networkKey: string, intentId: bigint, user: string, tokenA: string, tokenB: string, amountA: bigint, expectedAmountB: bigint, reward: bigint, endTime: bigint) {
    try {
      // Check if we have enough balance
      const tokenContract = new ethers.Contract(tokenA, ['function balanceOf(address) view returns (uint256)'], this.wallets[networkKey]);
      const balance = await tokenContract.balanceOf(this.wallets[networkKey].address);
      
      console.log(`💰 Our balance: ${ethers.formatEther(balance)} tokens`);

      // Calculate maximum bid we can afford (considering buffer)
      const maxAffordableBid = balance * BigInt(Math.floor((1 - this.config.balanceBuffer) * 1000)) / 1000n;
      const maxBid = maxAffordableBid < this.config.maxBidAmount ? maxAffordableBid : this.config.maxBidAmount;

      if (maxBid <= 0) {
        console.log(`❌ Insufficient balance to bid on intent ${intentId}`);
        return;
      }

      // Calculate profitable bid
      const profitableBid = this.calculateProfitableBid(amountA, reward, maxBid);
      
      if (profitableBid <= 0) {
        console.log(`❌ No profitable bid possible for intent ${intentId}`);
        return;
      }

      console.log(`💡 Calculated profitable bid: ${ethers.formatEther(profitableBid)}`);

      // Start bidding process
      this.activeIntents.set(intentId.toString(), {
        networkKey,
        intentId,
        user,
        tokenA,
        tokenB,
        amountA,
        expectedAmountB,
        reward,
        endTime,
        profitableBid,
        isBidding: true
      });

      // Start bidding loop
      this.startBiddingLoop(networkKey, intentId, profitableBid, endTime);

    } catch (error) {
      console.error(`❌ Error handling new intent ${intentId}:`, error);
    }
  }

  private calculateProfitableBid(amountA: bigint, reward: bigint, maxBid: bigint): bigint {
    // Calculate minimum profitable bid (amountA + reward - profit margin)
    const minProfitableBid = amountA + reward;
    const profitMargin = minProfitableBid * BigInt(Math.floor(this.config.minProfitMargin * 1000)) / 1000n;
    const targetBid = minProfitableBid - profitMargin;

    // Ensure bid is within our budget
    if (targetBid > maxBid) {
      return 0n; // Can't afford profitable bid
    }

    return targetBid;
  }

  private async startBiddingLoop(networkKey: string, intentId: bigint, initialBid: bigint, endTime: bigint) {
    const contract = this.contracts[networkKey];
    let currentBid = initialBid;

    const bidInterval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(bidInterval);
        return;
      }

      const now = BigInt(Math.floor(Date.now() / 1000));
      const timeLeft = Number(endTime - now);
      
      console.log(`⏱️  Intent ${intentId} - Time left: ${timeLeft} seconds (${Math.floor(timeLeft/60)}m ${timeLeft%60}s)`);
      console.log(`   - Current time: ${now}`);
      console.log(`   - End time: ${endTime}`);
      
      if (now >= endTime) {
        console.log(`⏰ Auction ended for intent ${intentId}`);
        clearInterval(bidInterval);
        await this.handleAuctionEnd(networkKey, intentId);
        return;
      }

      try {
        // Check current highest bid
        const [highestBid, highestBidder] = await contract.getHighestBid(intentId);
        
        console.log(`📊 Intent ${intentId} status:`);
        console.log(`   - Current highest bid: ${ethers.formatEther(highestBid)}`);
        console.log(`   - Current highest bidder: ${highestBidder}`);
        console.log(`   - Our address: ${this.wallets[networkKey].address}`);
        console.log(`   - Are we winning? ${highestBidder === this.wallets[networkKey].address ? '✅' : '❌'}`);
        
        if (highestBidder === this.wallets[networkKey].address) {
          console.log(`🏆 We are currently winning intent ${intentId} with bid ${ethers.formatEther(highestBid)}`);
          
          // If auction is almost over and we're winning, prepare for finalization
          if (timeLeft <= 30) {
            console.log(`🔔 Auction ending soon for intent ${intentId}, we are winning! Preparing for finalization...`);
          }
        } else if (highestBid >= currentBid) {
          // Someone outbid us, increase our bid
          currentBid = highestBid + this.config.bidIncrement;
          console.log(`📈 Increasing bid for intent ${intentId} to ${ethers.formatEther(currentBid)}`);
          
          // Check if we can afford the new bid
          const tokenContract = new ethers.Contract(
            this.activeIntents.get(intentId.toString())?.tokenA || '',
            ['function balanceOf(address) view returns (uint256)'],
            this.wallets[networkKey]
          );
          const balance = await tokenContract.balanceOf(this.wallets[networkKey].address);
          
          if (currentBid > balance * BigInt(Math.floor((1 - this.config.balanceBuffer) * 1000)) / 1000n) {
            console.log(`❌ Cannot afford increased bid for intent ${intentId}`);
            clearInterval(bidInterval);
            return;
          }

          // Place new bid
          await this.placeBid(networkKey, intentId, currentBid);
        } else {
          // We're winning, no need to bid
          console.log(`✅ We're winning intent ${intentId} with bid ${ethers.formatEther(highestBid)}`);
        }
        
      } catch (error) {
        console.error(`❌ Error in bidding loop for intent ${intentId}:`, error);
      }
    }, 10000); // Check every 10 seconds

    // Place initial bid
    console.log(`🚀 Starting bidding for intent ${intentId} with initial bid ${ethers.formatEther(initialBid)}`);
    console.log(`⏰ Auction ends at: ${new Date(Number(endTime) * 1000).toISOString()}`);
    await this.placeBid(networkKey, intentId, currentBid);
  }

  private async placeBid(networkKey: string, intentId: bigint, bidAmount: bigint) {
    try {
      console.log(`🏁 Placing bid ${ethers.formatEther(bidAmount)} for intent ${intentId}...`);
      
      const contract = this.contracts[networkKey];
      
      // Approve tokens first
      const intentInfo = this.activeIntents.get(intentId.toString());
      if (!intentInfo) return;

      const tokenContract = new ethers.Contract(
        intentInfo.tokenA,
        [
          'function approve(address,uint256) returns (bool)',
          'function allowance(address,address) view returns (uint256)'
        ],
        this.wallets[networkKey]
      );

      const allowance = await tokenContract.allowance(this.wallets[networkKey].address, contract.target);
      if (allowance < bidAmount) {
        console.log(`🔐 Approving tokens for intent ${intentId}...`);
        const approveTx = await tokenContract.approve(contract.target, bidAmount);
        await approveTx.wait();
        console.log(`✅ Tokens approved for intent ${intentId}`);
      }

      // Place bid
      const tx = await contract.placeBid(intentId, bidAmount);
      await tx.wait();
      console.log(`✅ Bid placed successfully for intent ${intentId}`);

    } catch (error: any) {
      console.error(`❌ Error placing bid for intent ${intentId}:`, error.message);
    }
  }

  private async handleAuctionEnd(networkKey: string, intentId: bigint) {
    try {
      const contract = this.contracts[networkKey];
      
      // Check if we won
      const [highestBid, highestBidder] = await contract.getHighestBid(intentId);
      
      if (highestBidder === this.wallets[networkKey].address) {
        console.log(`🎉 We won the auction for intent ${intentId}!`);
        
        // Finalize auction
        console.log(`🔨 Finalizing auction for intent ${intentId}...`);
        const finalizeTx = await contract.finalizeAuction(intentId);
        await finalizeTx.wait();
        console.log(`✅ Auction finalized for intent ${intentId}`);
        
        // Handle deposit
        await this.handleDeposit(networkKey, intentId, highestBid);
      } else {
        console.log(`😔 We lost the auction for intent ${intentId}`);
        this.activeIntents.delete(intentId.toString());
      }
    } catch (error) {
      console.error(`❌ Error handling auction end for intent ${intentId}:`, error);
    }
  }

  private async handleAuctionWon(networkKey: string, intentId: bigint, bidAmount: bigint) {
    try {
      console.log(`💰 Processing deposit for intent ${intentId}...`);
      await this.handleDeposit(networkKey, intentId, bidAmount);
    } catch (error) {
      console.error(`❌ Error handling auction won for intent ${intentId}:`, error);
    }
  }

  private async handleDeposit(networkKey: string, intentId: bigint, bidAmount: bigint) {
    try {
      const contract = this.contracts[networkKey];
      const intentInfo = this.activeIntents.get(intentId.toString());
      
      if (!intentInfo) {
        console.log(`❌ No intent info found for ${intentId}`);
        return;
      }

      // Approve tokens for deposit
      const tokenContract = new ethers.Contract(
        intentInfo.tokenA,
        [
          'function approve(address,uint256) returns (bool)',
          'function allowance(address,address) view returns (uint256)'
        ],
        this.wallets[networkKey]
      );

      const allowance = await tokenContract.allowance(this.wallets[networkKey].address, contract.target);
      if (allowance < bidAmount) {
        console.log(`🔐 Approving tokens for deposit...`);
        const approveTx = await tokenContract.approve(contract.target, bidAmount);
        await approveTx.wait();
        console.log(`✅ Tokens approved for deposit`);
      }

      // Deposit and pickup
      console.log(`💳 Depositing ${ethers.formatEther(bidAmount)} for intent ${intentId}...`);
      const depositTx = await contract.depositAndPickup(intentId);
      await depositTx.wait();
      console.log(`✅ Deposit completed for intent ${intentId}`);

      // Handle cross-chain solution
      await this.handleCrossChainSolution(networkKey, intentId, intentInfo);

    } catch (error) {
      console.error(`❌ Error handling deposit for intent ${intentId}:`, error);
    }
  }

  private async handleCrossChainSolution(networkKey: string, intentId: bigint, intentInfo: any) {
    try {
      console.log(`🌐 Starting cross-chain solution for intent ${intentId}...`);

      // Determine destination network
      const destinationNetworkKey = networkKey === 'horizen' ? 'base' : 'horizen';
      const destinationNetwork = this.networks[destinationNetworkKey];

      // Get recipient information from relayer
      console.log(`📡 Fetching recipient info for intent ${intentId}...`);
      const recipientInfo = await this.getRecipientInfo(intentId.toString());
      
      if (!recipientInfo.success) {
        console.log(`❌ No recipient info found for intent ${intentId}`);
        console.log(`🔐 Creating fallback recipient for intent ${intentId}...`);
        
        // Create a fallback recipient if no stored info
        const fallbackRecipient = ethers.Wallet.createRandom();
        const fallbackRecipients = [fallbackRecipient.address];
        const fallbackAmounts = [intentInfo.expectedAmountB.toString()];
        
        console.log(`🎯 Fallback recipient: ${fallbackRecipient.address}`);
        console.log(`💰 Fallback amount: ${ethers.formatEther(intentInfo.expectedAmountB)}`);
        
        // Use fallback recipient info
        const fallbackRecipientInfo = {
          success: true,
          intentId: intentId.toString(),
          recipients: fallbackRecipients,
          amounts: fallbackAmounts,
          timestamp: Date.now(),
          chainId: destinationNetwork.chainId,
          totalAmount: intentInfo.expectedAmountB.toString()
        };
        
        await this.solveIntentWithRecipients(networkKey, intentId, intentInfo, fallbackRecipientInfo);
        return;
      }

      console.log(`📋 Recipient info:`, {
        recipients: recipientInfo.recipients.length,
        totalAmount: ethers.formatEther(BigInt(recipientInfo.totalAmount)),
        chainId: recipientInfo.chainId
      });

      // Solve intent with stored recipient information
      await this.solveIntentWithRecipients(networkKey, intentId, intentInfo, recipientInfo);

    } catch (error) {
      console.error(`❌ Error handling cross-chain solution for intent ${intentId}:`, error);
    }
  }

  private async solveIntentWithRecipients(networkKey: string, intentId: bigint, intentInfo: any, recipientInfo: RecipientInfo) {
    try {
      console.log(`🔄 Solving intent ${intentId}...`);
      
      // Determine destination network
      const destinationNetworkKey = networkKey === 'horizen' ? 'base' : 'horizen';
      const destinationNetwork = this.networks[destinationNetworkKey];
      const destinationContract = this.contracts[destinationNetworkKey];
      const destinationWallet = this.wallets[destinationNetworkKey];

      console.log(`🔐 Approving TokenB for destination chain...`);
      
      // Calculate total amount needed for all recipients
      const totalAmount = recipientInfo.amounts.reduce((sum: bigint, amount: string) => sum + BigInt(amount), 0n);
      const expectedAmountB = BigInt(intentInfo.expectedAmountB);
      
      console.log(`🔍 Amount validation:`);
      console.log(`   - Expected amount: ${ethers.formatEther(expectedAmountB)}`);
      console.log(`   - Stored total: ${ethers.formatEther(totalAmount)}`);
      
      // Validate and adjust amounts if needed
      let adjustedRecipients = recipientInfo.recipients;
      let adjustedAmounts = recipientInfo.amounts.map((amount: string) => BigInt(amount));
      
      if (totalAmount > expectedAmountB) {
          console.log(`⚠️  Total amount exceeds expected amount, scaling down proportionally...`);
          
          // Scale down amounts proportionally
          const scaleFactor = Number(expectedAmountB) / Number(totalAmount);
          adjustedAmounts = adjustedAmounts.map(amount => {
              const scaledAmount = BigInt(Math.floor(Number(amount) * scaleFactor));
              return scaledAmount > 0n ? scaledAmount : 1n; // Ensure minimum 1 wei
          });
          
          // Adjust the last amount to ensure total equals expected amount
          const adjustedTotal = adjustedAmounts.reduce((sum, amount) => sum + amount, 0n);
          if (adjustedTotal < expectedAmountB) {
              const difference = expectedAmountB - adjustedTotal;
              adjustedAmounts[adjustedAmounts.length - 1] += difference;
          }
          
          console.log(`   - Adjusted amounts: ${adjustedAmounts.map(a => ethers.formatEther(a)).join(', ')}`);
          console.log(`   - New total: ${ethers.formatEther(adjustedAmounts.reduce((sum, amount) => sum + amount, 0n))}`);
      }

      // Approve tokens for the adjusted total amount
      const requiredAmount = adjustedAmounts.reduce((sum, amount) => sum + amount, 0n);
      
      // Create token contract instance for TokenB
      const tokenBContract = new ethers.Contract(
        intentInfo.tokenB,
        [
          'function approve(address,uint256) returns (bool)',
          'function allowance(address,address) view returns (uint256)',
          'function balanceOf(address) view returns (uint256)'
        ],
        destinationWallet
      );

      // Check current allowance
      const currentAllowance = await tokenBContract.allowance(
        destinationWallet.address, 
        destinationContract.target
      );
      
      if (currentAllowance < requiredAmount) {
        console.log(`🔐 Approving ${ethers.formatEther(requiredAmount)} TokenB for bridge contract...`);
        const approveTx = await tokenBContract.approve(
          destinationContract.target,
          requiredAmount
        );
        await approveTx.wait();
        console.log(`✅ TokenB approved for destination chain`);
      } else {
        console.log(`✅ TokenB already has sufficient allowance`);
      }

      // Check balance
      const balance = await tokenBContract.balanceOf(destinationWallet.address);
      console.log(`💰 TokenB balance: ${ethers.formatEther(balance)}`);
      
      if (balance < requiredAmount) {
        throw new Error(`Insufficient TokenB balance. Required: ${ethers.formatEther(requiredAmount)}, Available: ${ethers.formatEther(balance)}`);
      }

      // Use the simple intent ID (no chain encoding)
      console.log(`🔧 Solving intent on ${destinationNetwork.name} with ${adjustedRecipients.length} recipients...`);
      console.log(`   - Using simple intent ID: ${intentId}`);
      console.log(`   - Intent ID as BigInt: ${intentId}`);
      console.log(`   - Intent ID as hex: 0x${intentId.toString(16)}`);
      console.log(`   - User from chain1: ${intentInfo.user}`);
      console.log(`   - TokenB: ${intentInfo.tokenB}`);
      console.log(`   - Expected amount: ${ethers.formatEther(expectedAmountB)}`);
      
      const solveTx = await destinationContract.solveIntentOnChain2(
        intentId, // Use simple intent ID
        intentInfo.user,
        intentInfo.tokenB,
        expectedAmountB, // Use original expected amount
        adjustedRecipients,
        adjustedAmounts // Use adjusted amounts
      );
      await solveTx.wait();
      console.log(`✅ Intent solved on ${destinationNetwork.name}`);

      // Wait for state to be updated before calling relayer
      console.log(`⏳ Waiting 10 seconds for state to be updated before calling relayer...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Call relayer to settle
      await this.callRelayerSettle(intentId, intentId, networkKey, destinationNetworkKey);

    } catch (error: any) {
      console.error(`❌ Error solving intent ${intentId}:`, error.message);
    }
  }

  private async getRecipientInfo(intentId: string): Promise<RecipientInfo> {
    try {
      const response = await axios.get(`${this.relayerUrl}/get-recipients/${intentId}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching recipient info:`, error);
      return {
        success: false,
        intentId: '',
        recipients: [],
        amounts: [],
        timestamp: 0,
        chainId: 0,
        totalAmount: '0'
      };
    }
  }

  private async callRelayerSettle(intentId: bigint, chain2IntentId: bigint, originNetworkKey: string, destinationNetworkKey: string) {
    try {
      console.log(`📡 Calling relayer to settle intent ${intentId}...`);
      
      const settleData = {
        intentId: intentId.toString(),
        chain2IntentId: chain2IntentId.toString(), // Use same simple ID
        originChainId: this.networks[originNetworkKey].chainId,
        destinationChainId: this.networks[destinationNetworkKey].chainId,
        solverAddress: this.wallets[originNetworkKey].address
      };

      const response = await axios.post(`${this.relayerUrl}/settle`, settleData, {
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result: RelayerResponse = response.data;

      if (result.success) {
        console.log(`✅ Settlement successful!`);
        console.log(`   - Transaction: ${result.transactionHash}`);
        console.log(`   - Block: ${result.blockNumber}`);
        console.log(`   - Network: ${result.network}`);

        // Wait for settlement and check balance
        await this.verifySettlement(originNetworkKey, intentId);
      } else {
        console.log(`❌ Settlement failed:`, result.error);
      }

    } catch (error: any) {
      console.error(`❌ Error calling relayer settle:`, error.message);
    }
  }

  private async verifySettlement(networkKey: string, intentId: bigint) {
    try {
      console.log(`⏳ Waiting 10 seconds for settlement to process...`);
      await new Promise(resolve => setTimeout(resolve, 10000));

      const intentInfo = this.activeIntents.get(intentId.toString());
      if (!intentInfo) return;

      const tokenContract = new ethers.Contract(
        intentInfo.tokenA,
        ['function balanceOf(address) view returns (uint256)'],
        this.wallets[networkKey]
      );

      const balance = await tokenContract.balanceOf(this.wallets[networkKey].address);
      console.log(`💰 Final balance on ${this.networks[networkKey].name}: ${ethers.formatEther(balance)} tokens`);

      // Clean up
      this.activeIntents.delete(intentId.toString());
      console.log(`✅ Intent ${intentId} completed successfully!`);

    } catch (error) {
      console.error(`❌ Error verifying settlement:`, error);
    }
  }

  public stop() {
    console.log('🛑 Stopping Bridge Solver...');
    this.isRunning = false;
    
    if (this.server) {
      this.server.close((err: any) => {
        if (err) {
          console.error('❌ Error closing HTTP server:', err);
        } else {
          console.log('✅ HTTP server closed');
        }
      });
    }
    
    console.log('✅ Solver stopped');
  }
}

// Start the solver
const solver = new BridgeSolver();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  solver.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  solver.stop();
  process.exit(0);
});

// Start the solver
solver.start().catch(error => {
  console.error('❌ Failed to start solver:', error);
  process.exit(1);
}); 