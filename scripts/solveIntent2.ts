import { ethers } from "hardhat";

async function main() {
  console.log("🔧 SOLVING INTENT 2 ON BASE");
  console.log("============================");

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

  // Contract addresses
  const bridgeAddress_Base = "0xd2C8C5C6DAD1be31077b0EeDEb78fcB62f7e1066";
  const tokenBAddress = "0xAb50d4703484B4F0079607c873E064b18F49D48e";

  // Connect to contracts
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Base = BridgeFactory.attach(bridgeAddress_Base).connect(baseWallet) as any;
  
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const tokenB_Base = MockERC20Factory.attach(tokenBAddress).connect(baseWallet) as any;

  console.log("🔗 Contract Status:");
  console.log(`- Base Bridge: ${bridgeAddress_Base}`);
  console.log(`- TokenB: ${tokenBAddress}`);

  // Check if intent 2 is already solved
  const isAlreadySolved = await bridge_Base.isIntentSolvedOnChain2(2);
  console.log(`\n🔍 Intent 2 solved: ${isAlreadySolved}`);

  if (isAlreadySolved) {
    console.log("✅ Intent 2 already solved!");
    return;
  }

  // Parameters for solving intent 2
  const userAddress = baseWallet.address;
  const expectedAmountB = ethers.parseEther("95");
  const recipientAddress = "0xbE8E125E9eF9aD25d336a3E7009c832Aac7EF48D";

  console.log("\n📊 Parameters:");
  console.log(`- Intent ID: 2`);
  console.log(`- User: ${userAddress}`);
  console.log(`- TokenB: ${tokenBAddress}`);
  console.log(`- Expected Amount: ${ethers.formatEther(expectedAmountB)}`);
  console.log(`- Recipient: ${recipientAddress}`);

  // Check TokenB balance
  const tokenBBalance = await tokenB_Base.balanceOf(baseWallet.address);
  console.log(`- TokenB Balance: ${ethers.formatEther(tokenBBalance)}`);

  if (tokenBBalance < expectedAmountB) {
    console.log("❌ Not enough TokenB balance");
    return;
  }

  // Get current nonce
  let baseNonce = await baseProvider.getTransactionCount(baseWallet.address);
  console.log(`\n📊 Base nonce: ${baseNonce}`);

  try {
    console.log("\n🚀 Solving intent 2...");
    
    // Approve TokenB first
    const approveTx = await tokenB_Base.approve(bridgeAddress_Base, expectedAmountB, { nonce: baseNonce++ });
    await approveTx.wait();
    console.log("✅ Approved TokenB");

    // Solve intent 2
    const solveTx = await bridge_Base.solveIntentOnChain2(
      2, // Intent ID
      userAddress,
      tokenBAddress,
      expectedAmountB,
      [recipientAddress],
      [expectedAmountB],
      { nonce: baseNonce++ }
    );
    await solveTx.wait();
    console.log("✅ Intent 2 solved successfully!");
    console.log(`📍 Transaction: ${networks.base.explorer}/tx/${solveTx.hash}`);

    // Verify recipient balance
    const recipientBalance = await tokenB_Base.balanceOf(recipientAddress);
    console.log(`\n✅ Recipient balance: ${ethers.formatEther(recipientBalance)} TokenB`);

  } catch (error) {
    console.log("❌ Failed to solve intent 2:");
    console.log(error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Solve intent 2 failed:", error);
    process.exit(1);
  }); 