import { ethers } from "hardhat";

async function main() {
  console.log("🔍 DEBUG: solveIntentOnChain2 for Intent ID 8");
  console.log("=============================================");

  // Network configurations
  const networks = {
    base: {
      name: "Base Sepolia", 
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL!,
      chainId: 84532,
      explorer: "https://sepolia-explorer.base.org"
    }
  };

  // Create provider and wallet
  const baseProvider = new ethers.JsonRpcProvider(networks.base.rpcUrl);
  const privateKey = process.env.PRIVATE_KEY!;
  const baseWallet = new ethers.Wallet(privateKey, baseProvider);

  console.log("🔗 Network Status:");
  console.log(`- ${networks.base.name}: Block ${await baseProvider.getBlockNumber()}`);
  console.log(`- Wallet Address: ${baseWallet.address}`);
  console.log();

  // Contract addresses
  const bridgeAddress_Base = "0xd2C8C5C6DAD1be31077b0EeDEb78fcB62f7e1066";
  const tokenBAddress = "0xEE63b402Eb36B29Aee4D52F5d43425ca6514d73b"; // Latest deployed token

  // Connect to bridge contract
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Base = BridgeFactory.attach(bridgeAddress_Base).connect(baseWallet) as any;

  // Connect to token
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const tokenB_Base = MockERC20Factory.attach(tokenBAddress).connect(baseWallet) as any;
  console.log(`✅ Using TokenB: ${tokenBAddress}`);

  // Test parameters for intent ID 8
  const localIntentId = 8;
  const userAddress = "0x93dC72De59c169AA07b23F8D487021e15C57776E";
  const expectedAmountB = ethers.parseEther("95");
  const recipientAddress = "0x503D509193031F7B3D47DD69Bda93DC9868c2f5E";

  console.log("📊 Test Parameters:");
  console.log(`- Local Intent ID: ${localIntentId}`);
  console.log(`- User Address: ${userAddress}`);
  console.log(`- Token Address: ${tokenBAddress}`);
  console.log(`- Expected Amount: ${ethers.formatEther(expectedAmountB)} TokenB`);
  console.log(`- Recipient: ${recipientAddress}`);
  console.log();

  // Check if intent is already solved
  console.log("🔍 Checking if intent is already solved...");
  const isAlreadySolved = await bridge_Base.isIntentSolvedOnChain2(localIntentId);
  console.log(`Intent ${localIntentId} solved: ${isAlreadySolved}`);
  console.log();

  if (isAlreadySolved) {
    console.log("⚠️  Intent already solved, skipping...");
    return;
  }

  // Check token balance
  console.log("💰 Checking token balance...");
  const balance = await tokenB_Base.balanceOf(baseWallet.address);
  console.log(`Solver balance: ${ethers.formatEther(balance)} TokenB`);

  if (balance < expectedAmountB) {
    console.log("❌ Insufficient balance for solving intent");
    return;
  }

  // Check current allowance
  const currentAllowance = await tokenB_Base.allowance(baseWallet.address, bridgeAddress_Base);
  console.log(`Current allowance: ${ethers.formatEther(currentAllowance)} TokenB`);

  // Approve tokens if needed
  if (currentAllowance < expectedAmountB) {
    console.log("✅ Approving tokens...");
    const currentNonce = await baseProvider.getTransactionCount(baseWallet.address);
    const approveTx = await tokenB_Base.approve(bridgeAddress_Base, expectedAmountB, { nonce: currentNonce });
    await approveTx.wait();
    console.log("✅ Tokens approved");
  } else {
    console.log("✅ Sufficient allowance already exists");
  }

  // Check final allowance
  const finalAllowance = await tokenB_Base.allowance(baseWallet.address, bridgeAddress_Base);
  console.log(`Final allowance: ${ethers.formatEther(finalAllowance)} TokenB`);
  console.log();

  // Try to solve intent with detailed error handling
  console.log("🚀 Attempting to solve intent...");
  try {
    const currentNonce = await baseProvider.getTransactionCount(baseWallet.address);
    console.log(`Using nonce: ${currentNonce}`);
    
    const solveTx = await bridge_Base.solveIntentOnChain2(
      localIntentId,
      userAddress,
      tokenBAddress,
      expectedAmountB,
      [recipientAddress],
      [expectedAmountB],
      { nonce: currentNonce }
    );
    await solveTx.wait();
    console.log("✅ Intent solved successfully!");
    console.log(`📍 Transaction: ${networks.base.explorer}/tx/${solveTx.hash}`);
  } catch (error: any) {
    console.log("❌ Failed to solve intent:");
    console.log("Error details:", error);
    
    // Try to decode the error
    if (error.data) {
      console.log("Error data:", error.data);
    }
    
    // Check if it's a custom error
    if (error.reason) {
      console.log("Error reason:", error.reason);
    }
  }

  // Check if intent is now solved
  const isNowSolved = await bridge_Base.isIntentSolvedOnChain2(localIntentId);
  console.log(`Intent ${localIntentId} solved after attempt: ${isNowSolved}`);

  // Check recipient balance
  const recipientBalance = await tokenB_Base.balanceOf(recipientAddress);
  console.log(`Recipient balance: ${ethers.formatEther(recipientBalance)} TokenB`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Debug failed:", error);
    process.exit(1);
  }); 