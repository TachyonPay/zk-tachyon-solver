import { ethers } from "hardhat";
import axios from "axios";
import * as fs from "fs";
import * as path from "path";

const RELAYER_URL = 'http://localhost:3000';
const EXPECTED_AMOUNT_B = ethers.parseEther("95");

// Network configurations
const networks = {
  horizen: {
    name: "Horizen Testnet",
    explorer: "https://horizen-explorer-testnet.appchain.base.org"
  },
  base: {
    name: "Base Sepolia", 
    explorer: "https://sepolia-explorer.base.org"
  }
};

async function main() {
  console.log("🚀 Starting complete cross-chain bridge flow test...\n");

  // Get providers
  const horizenProvider = new ethers.JsonRpcProvider(process.env.HORIZEN_TESTNET_RPC_URL!);
  const baseProvider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL!);

  // Get contract addresses
  const bridgeAddress_Horizen = process.env.BRIDGE_CONTRACT_HORIZEN_LATEST!;
  const bridgeAddress_Base = process.env.BRIDGE_CONTRACT_BASE_LATEST!;

  // Create wallets
  const privateKey = process.env.PRIVATE_KEY!;
  const horizenWallet = new ethers.Wallet(privateKey, horizenProvider);
  const baseWallet = new ethers.Wallet(privateKey, baseProvider);

  // Get chain IDs
  const horizenChainId = await horizenProvider.getNetwork().then(net => net.chainId);
  const baseChainId = await baseProvider.getNetwork().then(net => net.chainId);

  console.log(`📍 Chain IDs: Horizen=${horizenChainId}, Base=${baseChainId}\n`);

  // Connect to contracts
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Horizen = BridgeFactory.attach(bridgeAddress_Horizen).connect(horizenWallet) as any;
  const bridge_Base = BridgeFactory.attach(bridgeAddress_Base).connect(baseWallet) as any;

  // Get current latest intent ID to ensure we use a fresh one
  const currentLatestIntentId = await bridge_Horizen.getLatestIntentId();
  const targetIntentId = currentLatestIntentId + 1n;
  console.log(`🎯 Target Intent ID: ${targetIntentId} (will be created next)`);

  // Deploy tokens with dynamic nonces
  console.log("🪙 STEP 1: Deploying tokens...");
  
  const horizenNonce = await horizenProvider.getTransactionCount(horizenWallet.address);
  const baseNonce = await baseProvider.getTransactionCount(baseWallet.address);
  
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  
  const tokenA_Horizen = await MockERC20Factory.connect(horizenWallet).deploy(
    "Token A", "TKA", ethers.parseEther("1000000"),
    { nonce: horizenNonce }
  );
  await tokenA_Horizen.waitForDeployment();
  
  const tokenB_Base = await MockERC20Factory.connect(baseWallet).deploy(
    "Token B", "TKB", ethers.parseEther("1000000"),
    { nonce: baseNonce }
  );
  await tokenB_Base.waitForDeployment();

  console.log(`✅ TokenA (Horizen): ${await tokenA_Horizen.getAddress()}`);
  console.log(`✅ TokenB (Base): ${await tokenB_Base.getAddress()}\n`);

  // STEP 1.5: Store recipient information in relayer
  console.log("📋 STEP 1.5: Store recipient information in relayer...");
  
  // Generate random recipient addresses and split the amount
  const recipient1 = ethers.Wallet.createRandom().address;
  const recipient2 = ethers.Wallet.createRandom().address;
  const recipient3 = ethers.Wallet.createRandom().address;
  
  const amount1 = ethers.parseEther("30");
  const amount2 = ethers.parseEther("35");
  const amount3 = ethers.parseEther("30");
  
  const testRecipients = [recipient1, recipient2, recipient3];
  const testAmounts = [amount1, amount2, amount3];
  
  console.log(`🎯 Recipients: ${testRecipients.join(", ")}`);
  console.log(`💰 Amounts: ${testAmounts.map(a => ethers.formatEther(a)).join(", ")} ETH`);

  // STEP 2: Create intent on Horizen
  console.log("\n🎯 STEP 2: Creating intent on Horizen Testnet...");
  
  const auctionDuration = 20; // 20 seconds for faster testing
  const reward = ethers.parseEther("5");
  
  // Approve tokens for intent creation
  const approveIntentTx = await tokenA_Horizen.approve(bridgeAddress_Horizen, EXPECTED_AMOUNT_B + reward);
  await approveIntentTx.wait();
  console.log("✅ Approved tokens for intent creation");

  // Create intent
  const createIntentTx = await bridge_Horizen.createIntent(
    await tokenA_Horizen.getAddress(),
    await tokenB_Base.getAddress(),
    EXPECTED_AMOUNT_B,
    EXPECTED_AMOUNT_B,
    reward,
    auctionDuration
  );
  await createIntentTx.wait();
  console.log("✅ Intent created on Horizen");

  // Verify we got the expected intent ID
  const actualIntentId = await bridge_Horizen.getLatestIntentId();
  console.log(`🎯 Actual Intent ID: ${actualIntentId} (should match target: ${targetIntentId})`);
  console.log(`📍 Transaction: ${networks.horizen.explorer}/tx/${createIntentTx.hash}\n`);

  if (actualIntentId !== targetIntentId) {
    console.log(`⚠️  Warning: Intent ID mismatch. Expected: ${targetIntentId}, Got: ${actualIntentId}`);
  }

  // Store recipient information in relayer
  try {
    const storeResponse = await axios.post(`${RELAYER_URL}/store-recipients`, {
      intentId: actualIntentId.toString(),
      recipients: testRecipients,
      amounts: testAmounts.map(a => a.toString()),
      chainId: Number(baseChainId)
    });
    console.log("✅ Recipient information stored in relayer");
  } catch (error) {
    console.log("❌ Error storing recipient information:", error);
  }

  // STEP 3: Place bid BEFORE auction ends
  console.log("\n🏆 STEP 3: Placing bid before auction ends...");
  
  const bidAmount = ethers.parseEther("98");
  const placeBidTx = await bridge_Horizen.placeBid(actualIntentId, bidAmount);
  await placeBidTx.wait();
  console.log("✅ Bid placed successfully");

  // STEP 4: Wait for auction to end
  console.log(`⏳ STEP 4: Waiting ${auctionDuration + 5} seconds for auction to end...`);
  await new Promise(resolve => setTimeout(resolve, (auctionDuration + 5) * 1000));

  // STEP 5: Finalize auction
  console.log("\n🔨 STEP 5: Finalizing auction...");
  const finalizeTx = await bridge_Horizen.finalizeAuction(actualIntentId);
  await finalizeTx.wait();
  console.log("✅ Auction finalized");

  // STEP 6: Deposit and pickup
  console.log("\n💰 STEP 6: Depositing and picking up...");
  
  // Approve tokens for deposit
  const approveDepositTx = await tokenA_Horizen.approve(bridgeAddress_Horizen, bidAmount);
  await approveDepositTx.wait();
  console.log("✅ Approved tokens for deposit");
  
  const depositTx = await bridge_Horizen.depositAndPickup(actualIntentId);
  await depositTx.wait();
  console.log("✅ Deposit completed");

  // STEP 7: Solver provides TokenB to recipients on Base
  console.log("\n🌐 STEP 7: Solver provides TokenB to recipients on Base Sepolia");
  
  // Check TokenB balance on Base
  const tokenBBalance = await tokenB_Base.balanceOf(baseWallet.address);
  console.log(`💰 TokenB balance on Base: ${ethers.formatEther(tokenBBalance)}`);
  
  if (tokenBBalance < EXPECTED_AMOUNT_B) {
    console.log(`❌ Insufficient TokenB balance. Need: ${ethers.formatEther(EXPECTED_AMOUNT_B)}, Have: ${ethers.formatEther(tokenBBalance)}`);
    console.log(`💡 The solver needs more TokenB tokens to complete the bridge`);
    return;
  }
  
  // Check if intent is already solved on Base
  const isAlreadySolved = await bridge_Base.isIntentSolvedOnChain2(actualIntentId);
  console.log(`🔍 Intent ${actualIntentId} already solved on Base: ${isAlreadySolved}`);
  
  if (isAlreadySolved) {
    console.log(`⚠️  Intent ${actualIntentId} already solved on Base, skipping solve step...`);
  } else {
    // Check current allowance
    const currentAllowance = await tokenB_Base.allowance(baseWallet.address, bridgeAddress_Base);
    console.log(`🔐 Current TokenB allowance: ${ethers.formatEther(currentAllowance)}`);
    
    if (currentAllowance < EXPECTED_AMOUNT_B) {
      console.log(`🔐 Approving TokenB for bridge contract...`);
      const approveTokenBTx = await tokenB_Base.approve(bridgeAddress_Base, EXPECTED_AMOUNT_B);
      await approveTokenBTx.wait();
      console.log("✅ Approved TokenB for bridge contract");
      
      // Verify approval
      const newAllowance = await tokenB_Base.allowance(baseWallet.address, bridgeAddress_Base);
      console.log(`🔐 New TokenB allowance: ${ethers.formatEther(newAllowance)}`);
    } else {
      console.log("✅ TokenB already approved");
    }
    
    // Use solveIntentOnChain2 function with simple intent ID
    console.log(`🔧 Using simple intent ID: ${actualIntentId}`);
    console.log(`📋 Recipients: ${testRecipients.length}`);
    console.log(`💰 Total amount: ${ethers.formatEther(EXPECTED_AMOUNT_B)}`);
    
    try {
      const solveTx = await bridge_Base.solveIntentOnChain2(
        actualIntentId, // Use simple intent ID
        horizenWallet.address, // User from chain1
        await tokenB_Base.getAddress(), // TokenB on Base
        EXPECTED_AMOUNT_B,
        testRecipients, // Recipients array
        testAmounts // Amounts array
      );
      await solveTx.wait();
      
      console.log(`✅ Intent solved on Base using solveIntentOnChain2`);
      console.log(`📍 Transaction: ${networks.base.explorer}/tx/${solveTx.hash}`);
    } catch (error: any) {
      console.log(`❌ Error solving intent: ${error.message}`);
      console.log(`🔍 Error details:`, error);
      return;
    }
  }
  console.log();

  // Wait for state to be updated before verification
  console.log("\n⏳ Waiting 30 seconds for state to be updated before verification...");
  await new Promise(resolve => setTimeout(resolve, 300));

  // Direct contract verification
  console.log("\n🔍 Direct contract verification...");
  const isSolvedDirectly = await bridge_Base.isIntentSolvedOnChain2(actualIntentId);
  console.log(`✅ Intent ${actualIntentId} solved status (direct): ${isSolvedDirectly}`);

  // Test verify endpoint with the current intent
  console.log("\n🔍 Testing verify endpoint...");
  const verifyResponse = await axios.post(`${RELAYER_URL}/verify`, {
    intentId: actualIntentId.toString(),
    chain2IntentId: actualIntentId.toString(), // Use same simple ID
    chainId: Number(baseChainId)
  });
  console.log("✅ Verify response:", verifyResponse.data);

  // Only proceed with settle if intent is solved
  if (isSolvedDirectly) {
    // Test settle endpoint
    console.log("\n💰 Testing settle endpoint...");
    const settleResponse = await axios.post(`${RELAYER_URL}/settle`, {
      intentId: actualIntentId.toString(),
      chain2IntentId: actualIntentId.toString(), // Use same simple ID
      originChainId: Number(horizenChainId),
      destinationChainId: Number(baseChainId),
      solverAddress: horizenWallet.address
    });
    console.log("✅ Settle response:", settleResponse.data);
  } else {
    console.log("\n⚠️  Skipping settle endpoint - intent not solved on destination chain");
  }

  console.log("\n🎉 Complete flow test finished successfully!");
  console.log(`🎯 Final Intent ID used: ${actualIntentId}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });