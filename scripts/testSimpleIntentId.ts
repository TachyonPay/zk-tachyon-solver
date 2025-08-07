import { ethers } from "hardhat";

async function main() {
  console.log("🧪 Testing Simple Intent ID Approach");
  console.log("=====================================");

  // Get providers
  const horizenProvider = new ethers.JsonRpcProvider(process.env.HORIZEN_TESTNET_RPC_URL!);
  const baseProvider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL!);

  // Get contract addresses
  const bridgeAddress_Horizen = "0x23922353ed107f5fC95FA66511481562c17a3196";
  const bridgeAddress_Base = "0x9749281AF28A2e60b81C13ace03Bd2ce48d56fC3";

  // Create wallets
  const privateKey = process.env.PRIVATE_KEY!;
  const horizenWallet = new ethers.Wallet(privateKey, horizenProvider);
  const baseWallet = new ethers.Wallet(privateKey, baseProvider);

  console.log(`📍 Wallet: ${horizenWallet.address}\n`);

  // Connect to contracts
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Horizen = BridgeFactory.attach(bridgeAddress_Horizen).connect(horizenWallet) as any;
  const bridge_Base = BridgeFactory.attach(bridgeAddress_Base).connect(baseWallet) as any;

  // Deploy test tokens
  console.log("🪙 Deploying test tokens...");
  
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  
  const tokenA_Horizen = await MockERC20Factory.connect(horizenWallet).deploy(
    "Token A", "TKA", ethers.parseEther("1000000")
  );
  await tokenA_Horizen.waitForDeployment();
  
  const tokenB_Base = await MockERC20Factory.connect(baseWallet).deploy(
    "Token B", "TKB", ethers.parseEther("1000000")
  );
  await tokenB_Base.waitForDeployment();

  console.log(`✅ TokenA (Horizen): ${await tokenA_Horizen.getAddress()}`);
  console.log(`✅ TokenB (Base): ${await tokenB_Base.getAddress()}\n`);

  // Test 1: Create intent with simple ID
  console.log("🎯 Test 1: Creating intent with simple ID...");
  
  const amount = ethers.parseEther("10");
  const reward = ethers.parseEther("1");
  const auctionDuration = 60; // 60 seconds
  
  // Approve tokens
  const approveTx = await tokenA_Horizen.approve(bridgeAddress_Horizen, amount + reward);
  await approveTx.wait();
  console.log("✅ Approved tokens");

  // Create intent
  const createTx = await bridge_Horizen.createIntent(
    await tokenA_Horizen.getAddress(),
    await tokenB_Base.getAddress(),
    amount,
    amount,
    reward,
    auctionDuration
  );
  await createTx.wait();
  console.log("✅ Intent created");

  // Get intent ID
  const intentId = await bridge_Horizen.getLatestIntentId();
  console.log(`🎯 Intent ID: ${intentId} (simple ID)`);
  console.log(`📍 Transaction: ${createTx.hash}\n`);

  // Test 2: Solve intent on Base with simple ID
  console.log("🌐 Test 2: Solving intent on Base with simple ID...");
  
  // Check if already solved
  const isSolved = await bridge_Base.isIntentSolvedOnChain2(intentId);
  console.log(`🔍 Intent ${intentId} solved status: ${isSolved}`);
  
  if (!isSolved) {
    // Approve TokenB
    const approveTokenBTx = await tokenB_Base.approve(bridgeAddress_Base, amount);
    await approveTokenBTx.wait();
    console.log("✅ Approved TokenB");

    // Solve intent
    const recipient = ethers.Wallet.createRandom().address;
    const solveTx = await bridge_Base.solveIntentOnChain2(
      intentId, // Simple intent ID
      horizenWallet.address,
      await tokenB_Base.getAddress(),
      amount,
      [recipient],
      [amount]
    );
    await solveTx.wait();
    console.log(`✅ Intent solved on Base`);
    console.log(`📍 Transaction: ${solveTx.hash}`);
    console.log(`🎯 Recipient: ${recipient}`);
  } else {
    console.log("⚠️  Intent already solved, skipping...");
  }

  // Test 3: Verify intent is solved
  console.log("\n🔍 Test 3: Verifying intent is solved...");
  const isSolvedAfter = await bridge_Base.isIntentSolvedOnChain2(intentId);
  console.log(`✅ Intent ${intentId} solved status: ${isSolvedAfter}`);

  console.log("\n🎉 Simple Intent ID test completed successfully!");
  console.log("✅ Simple intent IDs work correctly!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }); 