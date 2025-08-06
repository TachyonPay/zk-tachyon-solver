import { ethers } from "hardhat";

async function main() {
  console.log("⚖️  SETTLING INTENT ON HORIZEN");
  console.log("===============================");

  // Network configurations
  const networks = {
    horizen: {
      name: "Horizen Testnet",
      rpcUrl: process.env.HORIZEN_TESTNET_RPC_URL!,
      chainId: 845320009,
      explorer: "https://horizen-explorer-testnet.appchain.base.org"
    }
  };

  // Create provider and wallet
  const horizenProvider = new ethers.JsonRpcProvider(networks.horizen.rpcUrl);
  const privateKey = process.env.PRIVATE_KEY!;
  const horizenWallet = new ethers.Wallet(privateKey, horizenProvider);

  // Contract addresses
  const bridgeAddress_Horizen = "0x8d692017aEA872De988AC27FfD6B9Fed3FF0FC13";
  const tokenAAddress = "0x6d5be3853E3b277f9Cd2de7B911e4318eE78cfCb";

  // Connect to contracts
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Horizen = BridgeFactory.attach(bridgeAddress_Horizen).connect(horizenWallet) as any;
  
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const tokenA_Horizen = MockERC20Factory.attach(tokenAAddress).connect(horizenWallet) as any;

  console.log("🔗 Contract Status:");
  console.log(`- Horizen Bridge: ${bridgeAddress_Horizen}`);
  console.log(`- TokenA: ${tokenAAddress}`);

  // Get latest intent ID
  const latestIntentId = await bridge_Horizen.getLatestIntentId();
  console.log(`\n📊 Latest Intent ID: ${latestIntentId}`);

  if (latestIntentId === 0) {
    console.log("❌ No intents found!");
    return;
  }

  // Get intent details
  const intentDetails = await bridge_Horizen.getIntentDetails(latestIntentId);
  console.log("\n📋 Intent Details:");
  console.log(`- Intent ID: ${latestIntentId}`);
  console.log(`- User: ${intentDetails.user}`);
  console.log(`- Completed: ${intentDetails.completed}`);
  console.log(`- WinningSolver: ${intentDetails.winningSolver}`);
  console.log(`- WinningBid: ${ethers.formatEther(intentDetails.winningBid)}`);
  console.log(`- AmountA: ${ethers.formatEther(intentDetails.amountA)}`);
  console.log(`- Reward: ${ethers.formatEther(intentDetails.reward)}`);

  if (intentDetails.completed) {
    console.log("✅ Intent already completed!");
    return;
  }

  // Check solver balance before
  const solverBalanceBefore = await tokenA_Horizen.balanceOf(horizenWallet.address);
  console.log(`\n💰 Solver balance before: ${ethers.formatEther(solverBalanceBefore)} TokenA`);

  // Get current nonce
  let horizenNonce = await horizenProvider.getTransactionCount(horizenWallet.address);
  console.log(`📊 Horizen nonce: ${horizenNonce}`);

  try {
    console.log("\n🚀 Settling intent...");
    
    // Extract local intent ID for chain2 verification
    const localIntentId = await bridge_Horizen.getLocalIntentId(latestIntentId);
    console.log(`🔍 Local Intent ID: ${localIntentId}`);

    // Settle intent with chain2 verification
    const settleTx = await bridge_Horizen.settleIntentWithChain2Verification(
      latestIntentId, 
      localIntentId, // chain2 intent ID
      { nonce: horizenNonce++ }
    );
    await settleTx.wait();
    console.log("✅ Intent settled successfully!");
    console.log(`📍 Transaction: ${networks.horizen.explorer}/tx/${settleTx.hash}`);

    // Check solver balance after
    const solverBalanceAfter = await tokenA_Horizen.balanceOf(horizenWallet.address);
    const totalReceived = solverBalanceAfter - solverBalanceBefore;
    console.log(`\n💰 Solver balance after: ${ethers.formatEther(solverBalanceAfter)} TokenA`);
    console.log(`💸 Total received: ${ethers.formatEther(totalReceived)} TokenA`);
    console.log(`🎯 Expected profit: ${ethers.formatEther(intentDetails.amountA + intentDetails.reward)} TokenA`);

  } catch (error) {
    console.log("❌ Failed to settle intent:");
    console.log(error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Settle intent failed:", error);
    process.exit(1);
  }); 