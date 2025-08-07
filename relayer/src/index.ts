import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import axios from 'axios';
import * as path from 'path';

// Load environment variables from relayer directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large proof data

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

// zkVerify Configuration
const ZKV_API_URL = 'https://relayer-api.horizenlabs.io/api/v1';
const ZKV_API_KEY = process.env.ZKV_API_KEY;

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

// Store for proof verification results
const proofVerifications = new Map<string, { status: string; jobId?: string; finalized?: boolean }>();

// zkVerify proof verification middleware
const verifyProofForBase = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const { destinationChainId, proofData } = req.body;
    
    if (parseInt(destinationChainId.toString()) !== networks.base.chainId) {
      console.log("⏭️  Skipping proof verification - destination is not Base");
      return next();
    }
    
    if (!proofData || !proofData.proof || !proofData.publicSignals || !proofData.vk) {
      return res.status(400).json({ 
        error: 'Invalid proof data', 
        required: ['proof', 'publicSignals', 'vk'], 
        message: 'SP1 proof data must include proof, publicSignals, and vk' 
      });
    }
    
    if (!ZKV_API_KEY) {
      return res.status(500).json({ 
        error: 'ZKV_API_KEY not configured', 
        message: 'zkVerify API key is required for proof verification' 
      });
    }

    try {
      console.log("🔐 Verifying SP1 proof for Base destination...");
      
      // Step 2: Submit proof
      console.log("📤 Submitting proof...");
      const submitParams = {
        "proofType": "sp1",
        "vkRegistered": false,
        "proofData": {
          "proof": proofData.proof,
          "publicSignals": proofData.publicSignals,
          "vk": proofData.vk
        }
      };

      console.log("VK being used:", submitParams.proofData.vk);
      
      const submitResponse = await axios.post(`${ZKV_API_URL}/submit-proof/${ZKV_API_KEY}`, submitParams);
      
      if (submitResponse.data.optimisticVerify !== "success") {
        return res.status(400).json({ 
          error: 'Proof verification failed', 
          message: 'Proof failed optimistic verification', 
          response: submitResponse.data 
        });
      }
      
      const jobId = submitResponse.data.jobId;
      console.log("✅ Proof submitted successfully, jobId:", jobId);
      
      // Step 3: Poll for finalization
      console.log("⏳ Waiting for proof finalization...");
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max
      
      while (attempts < maxAttempts) {
        const statusResponse = await axios.get(`${ZKV_API_URL}/job-status/${ZKV_API_KEY}/${jobId}`);
        const status = statusResponse.data.status;
        
        console.log(`📊 Job status: ${status}`);
        
        if (status === "Finalized") {
          console.log("✅ Proof finalized successfully!");
          req.body.proofVerification = {
            jobId,
            status: 'Finalized',
            txHash: statusResponse.data.txHash,
            blockHash: statusResponse.data.blockHash,
            chainId: statusResponse.data.chainId,
            proofType: statusResponse.data.proofType
          };
          return next();
        } else if (status === "Failed") {
          return res.status(400).json({ 
            error: 'Proof verification failed', 
            jobId, 
            status: statusResponse.data 
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        attempts++;
      }
      
      return res.status(408).json({ 
        error: 'Proof verification timeout', 
        jobId, 
        message: 'Proof verification did not finalize within timeout period' 
      });
      
    } catch (error: any) {
      console.error("❌ Proof verification error:", error.response?.data || error.message);
      return res.status(500).json({ 
        error: 'Proof verification failed', 
        message: error.response?.data || error.message 
      });
    }
  } catch (error) {
    console.error("❌ Proof verification middleware error:", error);
    return res.status(500).json({ 
      error: 'Proof verification middleware error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Verify middleware - checks if intent is solved on destination chain
const verifyIntentSolved = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const { chain2IntentId, destinationChainId } = req.body;

    if (!chain2IntentId || !destinationChainId) {
      return res.status(400).json({
        error: 'Missing chain2IntentId or destinationChainId for verification',
        required: ['chain2IntentId', 'destinationChainId']
      });
    }

    // Determine which destination chain to check based on destinationChainId
    const destChainIdNum = parseInt(destinationChainId.toString());
    const destinationNetworkKey = destChainIdNum === networks.horizen.chainId ? 'horizen' : 'base';
    const contract = contracts[destinationNetworkKey];

    console.log(`🔍 Verifying intent ${chain2IntentId} is solved on ${destinationNetworkKey}...`);

    // Check if intent is solved using the solvedIntents mapping on destination chain
    const isSolved = await contract.solvedIntents(chain2IntentId);
    
    console.log(`📊 Intent ${chain2IntentId} solved status: ${isSolved}`);

    if (!isSolved) {
      return res.status(400).json({
        error: 'Intent not solved on destination chain',
        chain2IntentId: chain2IntentId,
        destinationNetwork: destinationNetworkKey,
        destinationChainId: destinationChainId,
        message: 'Intent must be solved on destination chain before settling on origin chain'
      });
    }

    console.log(`✅ Intent ${chain2IntentId} verified as solved on ${destinationNetworkKey}`);
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
    const chainIdNum = parseInt(chainId.toString());
    if (chainIdNum !== networks.horizen.chainId && chainIdNum !== networks.base.chainId) {
      return res.status(400).json({
        error: 'Invalid chainId',
        supported: [networks.horizen.chainId, networks.base.chainId]
      });
    }

    console.log(`🔍 Checking if intent ${chain2IntentId} is solved on chain ${chainId}...`);

    // Determine which network to check based on chainId
    const networkKey = chainIdNum === networks.horizen.chainId ? 'horizen' : 'base';
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
    const { intentId, chain2IntentId, originChainId, destinationChainId, solverAddress } = req.body;

    // Validate required parameters
    if (!intentId || !chain2IntentId || !originChainId || !destinationChainId || !solverAddress) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['intentId', 'chain2IntentId', 'originChainId', 'destinationChainId', 'solverAddress']
      });
    }

    // Validate origin chainId
    const originChainIdNum = parseInt(originChainId.toString());
    if (originChainIdNum !== networks.horizen.chainId && originChainIdNum !== networks.base.chainId) {
      return res.status(400).json({
        error: 'Invalid origin chainId',
        supported: [networks.horizen.chainId, networks.base.chainId]
      });
    }

    console.log(`🔄 Processing settle request:`);
    console.log(`- Intent ID: ${intentId}`);
    console.log(`- Chain2 Intent ID: ${chain2IntentId}`);
    console.log(`- Origin Chain ID: ${originChainId}`);
    console.log(`- Destination Chain ID: ${destinationChainId}`);
    console.log(`- Solver Address: ${solverAddress}`);

    // Determine which network to use for settlement (origin chain)
    const originNetworkKey = originChainIdNum === networks.horizen.chainId ? 'horizen' : 'base';
    const contract = contracts[originNetworkKey];
    const provider = providers[originNetworkKey];

    // Verify the relayer is authorized
    const isAuthorized = await contract.authorizedRelayers(wallet.address);
    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Relayer not authorized on this network',
        network: originNetworkKey,
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
      network: originNetworkKey,
      chainId: originChainIdNum,
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
      originChainId: req.body.originChainId,
      destinationChainId: req.body.destinationChainId,
      solverAddress: req.body.solverAddress
    });
  }
});

// Settle with proof endpoint - includes proof verification for Base destination
app.post('/settle-with-proof', verifyIntentSolved, verifyProofForBase, async (req, res) => {
  try {
    const { intentId, chain2IntentId, originChainId, destinationChainId, solverAddress, proofData } = req.body;

    // Validate required parameters
    if (!intentId || !chain2IntentId || !originChainId || !destinationChainId || !solverAddress) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['intentId', 'chain2IntentId', 'originChainId', 'destinationChainId', 'solverAddress']
      });
    }

    // Validate origin chainId
    const originChainIdNum = parseInt(originChainId.toString());
    if (originChainIdNum !== networks.horizen.chainId && originChainIdNum !== networks.base.chainId) {
      return res.status(400).json({
        error: 'Invalid origin chainId',
        supported: [networks.horizen.chainId, networks.base.chainId]
      });
    }

    console.log(`🔄 Processing settle-with-proof request:`);
    console.log(`- Intent ID: ${intentId}`);
    console.log(`- Chain2 Intent ID: ${chain2IntentId}`);
    console.log(`- Origin Chain ID: ${originChainId}`);
    console.log(`- Destination Chain ID: ${destinationChainId}`);
    console.log(`- Solver Address: ${solverAddress}`);
    
    if (req.body.proofVerification) {
      console.log(`- Proof Verification: ${JSON.stringify(req.body.proofVerification)}`);
    }

    // Determine which network to use for settlement (origin chain)
    const originNetworkKey = originChainIdNum === networks.horizen.chainId ? 'horizen' : 'base';
    const contract = contracts[originNetworkKey];
    const provider = providers[originNetworkKey];

    // Verify the relayer is authorized
    const isAuthorized = await contract.authorizedRelayers(wallet.address);
    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Relayer not authorized on this network',
        network: originNetworkKey,
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
      network: originNetworkKey,
      chainId: originChainIdNum,
      intentId: intentId,
      chain2IntentId: chain2IntentId,
      solverAddress: solverAddress,
      proofVerification: req.body.proofVerification || null
    });

  } catch (error) {
    console.error('❌ Error in settle-with-proof endpoint:', error);
    
    res.status(500).json({
      error: 'Failed to settle intent with proof',
      details: error instanceof Error ? error.message : 'Unknown error',
      intentId: req.body.intentId,
      chain2IntentId: req.body.chain2IntentId,
      originChainId: req.body.originChainId,
      destinationChainId: req.body.destinationChainId,
      solverAddress: req.body.solverAddress
    });
  }
});

// Standalone proof submission endpoint
app.post('/submit-proof', async (req, res) => {
  try {
    const { proofData } = req.body;
    
    if (!proofData || !proofData.proof || !proofData.publicSignals || !proofData.vk) {
      return res.status(400).json({ 
        error: 'Invalid proof data', 
        required: ['proof', 'publicSignals', 'vk'], 
        message: 'SP1 proof data must include proof, publicSignals, and vk' 
      });
    }
    
    if (!ZKV_API_KEY) {
      return res.status(500).json({ 
        error: 'ZKV_API_KEY not configured', 
        message: 'zkVerify API key is required for proof verification' 
      });
    }
    
    console.log("🔐 Submitting standalone SP1 proof...");
    
    // Step 2: Submit proof
    console.log("📤 Submitting proof...");
    const submitParams = {
      "proofType": "sp1",
      "vkRegistered": false,
      "proofData": {
        "proof": proofData.proof,
        "publicSignals": proofData.publicSignals,
        "vk": proofData.vk
      }
    };
    
    const submitResponse = await axios.post(`${ZKV_API_URL}/submit-proof/${ZKV_API_KEY}`, submitParams);
    
    if (submitResponse.data.optimisticVerify !== "success") {
      return res.status(400).json({ 
        error: 'Proof verification failed', 
        message: 'Proof failed optimistic verification', 
        response: submitResponse.data 
      });
    }
    
    const jobId = submitResponse.data.jobId;
    console.log("✅ Proof submitted successfully, jobId:", jobId);
    
    res.json({
      success: true,
      jobId: jobId,
      status: 'Submitted',
      message: 'Proof submitted successfully. Use /proof-status/:jobId to check status.'
    });
    
  } catch (error: any) {
    console.error("❌ Proof submission error:", error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Proof submission failed', 
      message: error.response?.data || error.message 
    });
  }
});

// Get proof verification status endpoint
app.get('/proof-status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        error: 'Missing job ID',
        required: ['jobId']
      });
    }

    // Check if we have API key
    if (!ZKV_API_KEY) {
      return res.status(500).json({
        error: 'ZKV_API_KEY not configured',
        message: 'zkVerify API key is required for proof verification'
      });
    }

    try {
      const statusResponse = await axios.get(`${ZKV_API_URL}/job-status/${ZKV_API_KEY}/${jobId}`);
      
      res.json({
        success: true,
        jobId: jobId,
        status: statusResponse.data.status,
        details: statusResponse.data
      });

    } catch (error: any) {
      console.error("❌ Proof status check error:", error.response?.data || error.message);
      return res.status(500).json({
        error: 'Failed to get proof status',
        details: error.response?.data || error.message
      });
    }

  } catch (error) {
    console.error('❌ Error in proof-status endpoint:', error);
    res.status(500).json({
      error: 'Failed to get proof status',
      details: error instanceof Error ? error.message : 'Unknown error'
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
  console.log(`🔗 Settle with proof endpoint: http://localhost:${PORT}/settle-with-proof`);
  console.log(`🔐 Proof submission endpoint: http://localhost:${PORT}/submit-proof`);
  console.log(`🔗 Networks configured:`);
  console.log(`   - Horizen (${networks.horizen.chainId}): ${networks.horizen.bridgeAddress}`);
  console.log(`   - Base (${networks.base.chainId}): ${networks.base.bridgeAddress}`);
  console.log(`👤 Relayer address: ${wallet.address}`);
});

export default app; 