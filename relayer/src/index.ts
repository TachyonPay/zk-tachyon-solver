import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Load contract ABI
const contractArtifact = require('./BridgeIntent.json');
const contractABI = contractArtifact.abi;

// Network configurations
const networks = {
  horizen: {
    name: "Horizen Testnet",
    rpcUrl: process.env.HORIZEN_TESTNET_RPC_URL!,
    chainId: 845320009,
    bridgeAddress: process.env.BRIDGE_CONTRACT_HORIZEN_LATEST!
  },
  base: {
    name: "Base Sepolia", 
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL!,
    chainId: 84532,
    bridgeAddress: process.env.BRIDGE_CONTRACT_BASE_LATEST!
  }
};

// Create providers
const providers = {
  horizen: new ethers.JsonRpcProvider(networks.horizen.rpcUrl),
  base: new ethers.JsonRpcProvider(networks.base.rpcUrl)
};

// Create wallet for signing transactions
const privateKey = process.env.PRIVATE_KEY!;
const wallet = new ethers.Wallet(privateKey);

// Create contract instances
const contracts = {
  horizen: new ethers.Contract(networks.horizen.bridgeAddress, contractABI, wallet.connect(providers.horizen)),
  base: new ethers.Contract(networks.base.bridgeAddress, contractABI, wallet.connect(providers.base))
};

// Verify middleware - checks if intent is solved on chain2
const verifyIntentSolved = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const { chain2IntentId, chainId } = req.body;

    if (!chain2IntentId || !chainId) {
      return res.status(400).json({
        error: 'Missing chain2IntentId or chainId for verification',
        required: ['chain2IntentId', 'chainId']
      });
    }

    // Determine which network to check based on chainId
    const networkKey = chainId === networks.horizen.chainId ? 'horizen' : 'base';
    const contract = contracts[networkKey];

    console.log(`🔍 Verifying intent ${chain2IntentId} is solved on ${networkKey}...`);

    // Check if intent is solved using the solvedIntents mapping
    const isSolved = await contract.solvedIntents(chain2IntentId);
    
    console.log(`📊 Intent ${chain2IntentId} solved status: ${isSolved}`);

    if (!isSolved) {
      return res.status(400).json({
        error: 'Intent not solved on chain2',
        chain2IntentId: chain2IntentId,
        network: networkKey,
        chainId: chainId,
        message: 'Intent must be solved on chain2 before settling on chain1'
      });
    }

    console.log(`✅ Intent ${chain2IntentId} verified as solved on ${networkKey}`);
    next();

  } catch (error) {
    console.error('❌ Error in verify middleware:', error);
    res.status(500).json({
      error: 'Failed to verify intent solved status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    networks: {
      horizen: {
        chainId: networks.horizen.chainId,
        bridgeAddress: networks.horizen.bridgeAddress
      },
      base: {
        chainId: networks.base.chainId,
        bridgeAddress: networks.base.bridgeAddress
      }
    }
  });
});

// Verify endpoint - check if intent is solved on chain2
app.post('/verify', async (req, res) => {
  try {
    const { chain2IntentId, chainId } = req.body;

    // Validate required parameters
    if (!chain2IntentId || !chainId) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['chain2IntentId', 'chainId']
      });
    }

    // Validate chainId
    if (chainId !== networks.horizen.chainId && chainId !== networks.base.chainId) {
      return res.status(400).json({
        error: 'Invalid chainId',
        supported: [networks.horizen.chainId, networks.base.chainId]
      });
    }

    console.log(`🔍 Checking if intent ${chain2IntentId} is solved on chain ${chainId}...`);

    // Determine which network to check based on chainId
    const networkKey = chainId === networks.horizen.chainId ? 'horizen' : 'base';
    const contract = contracts[networkKey];

    // Check if intent is solved using the solvedIntents mapping
    const isSolved = await contract.solvedIntents(chain2IntentId);
    
    console.log(`📊 Intent ${chain2IntentId} solved status: ${isSolved}`);

    res.json({
      success: true,
      chain2IntentId: chain2IntentId,
      chainId: chainId,
      network: networkKey,
      isSolved: isSolved,
      message: isSolved ? 'Intent is solved on chain2' : 'Intent is not solved on chain2'
    });

  } catch (error) {
    console.error('❌ Error in verify endpoint:', error);
    res.status(500).json({
      error: 'Failed to check intent solved status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Settle endpoint with verification middleware
app.post('/settle', verifyIntentSolved, async (req, res) => {
  try {
    const { intentId, chain2IntentId, chainId, solverAddress } = req.body;

    // Validate required parameters
    if (!intentId || !chain2IntentId || !chainId || !solverAddress) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['intentId', 'chain2IntentId', 'chainId', 'solverAddress']
      });
    }

    // Validate chainId
    if (chainId !== networks.horizen.chainId && chainId !== networks.base.chainId) {
      return res.status(400).json({
        error: 'Invalid chainId',
        supported: [networks.horizen.chainId, networks.base.chainId]
      });
    }

    console.log(`🔄 Processing settle request:`);
    console.log(`- Intent ID: ${intentId}`);
    console.log(`- Chain2 Intent ID: ${chain2IntentId}`);
    console.log(`- Chain ID: ${chainId}`);
    console.log(`- Solver Address: ${solverAddress}`);

    // Determine which network to use based on chainId
    const networkKey = chainId === networks.horizen.chainId ? 'horizen' : 'base';
    const contract = contracts[networkKey];
    const provider = providers[networkKey];

    // Verify the relayer is authorized
    const isAuthorized = await contract.authorizedRelayers(wallet.address);
    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Relayer not authorized on this network',
        network: networkKey,
        relayerAddress: wallet.address
      });
    }

    // Get intent details to verify it exists and is not completed
    try {
      const intentDetails = await contract.getIntent(intentId);
      console.log(`📋 Intent details:`, {
        completed: intentDetails.completed,
        winningSolver: intentDetails.winningSolver,
        deposited: intentDetails.deposited
      });

      if (intentDetails.completed) {
        return res.status(400).json({
          error: 'Intent already completed',
          intentId: intentId
        });
      }

      if (intentDetails.winningSolver !== solverAddress) {
        return res.status(400).json({
          error: 'Solver address mismatch',
          expected: intentDetails.winningSolver,
          provided: solverAddress
        });
      }

      if (!intentDetails.deposited) {
        return res.status(400).json({
          error: 'Solver has not deposited yet',
          intentId: intentId
        });
      }

    } catch (error) {
      return res.status(400).json({
        error: 'Failed to get intent details',
        intentId: intentId,
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Get current nonce
    const nonce = await provider.getTransactionCount(wallet.address);
    console.log(`📊 Current nonce: ${nonce}`);

    // Call settleIntentWithChain2Verification
    console.log(`🚀 Calling settleIntentWithChain2Verification...`);
    const tx = await contract.settleIntentWithChain2Verification(
      intentId,
      chain2IntentId,
      { nonce: nonce }
    );

    console.log(`⏳ Transaction sent: ${tx.hash}`);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);

    res.json({
      success: true,
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber,
      network: networkKey,
      chainId: chainId,
      intentId: intentId,
      chain2IntentId: chain2IntentId,
      solverAddress: solverAddress
    });

  } catch (error) {
    console.error('❌ Error in settle endpoint:', error);
    
    res.status(500).json({
      error: 'Failed to settle intent',
      details: error instanceof Error ? error.message : 'Unknown error',
      intentId: req.body.intentId,
      chain2IntentId: req.body.chain2IntentId,
      chainId: req.body.chainId,
      solverAddress: req.body.solverAddress
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Bridge Relayer started on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Verify endpoint: http://localhost:${PORT}/verify`);
  console.log(`🔗 Settle endpoint: http://localhost:${PORT}/settle`);
  console.log(`🔗 Networks configured:`);
  console.log(`   - Horizen (${networks.horizen.chainId}): ${networks.horizen.bridgeAddress}`);
  console.log(`   - Base (${networks.base.chainId}): ${networks.base.bridgeAddress}`);
  console.log(`👤 Relayer address: ${wallet.address}`);
});

export default app; 