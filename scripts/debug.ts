import { ethers } from "hardhat";

async function main() {
  console.log("🔍 DEBUGGING CROSS-CHAIN BRIDGE");
  console.log("=================================");

  // Network configurations
  const networks = {
    horizen: {
      name: "Horizen Testnet",
      rpcUrl: process.env.HORIZEN_TESTNET_RPC_URL!,
      chainId: 845320009,
      explorer: "https://horizen-explorer-testnet.appchain.base.org"
    },
    base: {
      name: "Base Sepolia", 
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL!,
      chainId: 84532,
      explorer: "https://sepolia-explorer.base.org"
    }
  };

  // Create providers for both networks
  const horizenProvider = new ethers.JsonRpcProvider(networks.horizen.rpcUrl);
  const baseProvider = new ethers.JsonRpcProvider(networks.base.rpcUrl);

  // Create wallets for both networks
  const privateKey = process.env.PRIVATE_KEY!;
  const horizenWallet = new ethers.Wallet(privateKey, horizenProvider);
  const baseWallet = new ethers.Wallet(privateKey, baseProvider);

  // Contract addresses
  const bridgeAddress_Horizen = "0x8d692017aEA872De988AC27FfD6B9Fed3FF0FC13";
  const bridgeAddress_Base = "0xd2C8C5C6DAD1be31077b0EeDEb78fcB62f7e1066";

  // Connect to bridge contracts
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Horizen = BridgeFactory.attach(bridgeAddress_Horizen).connect(horizenWallet) as any;
  const bridge_Base = BridgeFactory.attach(bridgeAddress_Base).connect(baseWallet) as any;

  console.log("🔗 Contract Status:");
  console.log(`- Horizen Bridge: ${bridgeAddress_Horizen}`);
  console.log(`- Base Bridge: ${bridgeAddress_Base}`);

  // Check chain IDs
  const horizenChainId = await bridge_Horizen.getChainId();
  const baseChainId = await bridge_Base.getChainId();
  console.log(`- Horizen Chain ID: ${horizenChainId}`);
  console.log(`- Base Chain ID: ${baseChainId}`);

  // Test intent ID generation
  const testLocalId = 1;
  const horizenIntentId = await bridge_Horizen.generateIntentId(testLocalId);
  const baseIntentId = await bridge_Base.generateIntentId(testLocalId);
  
  console.log("\n🧪 Intent ID Generation Test:");
  console.log(`- Local Intent ID: ${testLocalId}`);
  console.log(`- Horizen Intent ID: ${horizenIntentId}`);
  console.log(`- Base Intent ID: ${baseIntentId}`);

  // Check if intent is already solved on Base
  const isAlreadySolved = await bridge_Base.isIntentSolvedOnChain2(horizenIntentId);
  console.log(`- Is intent ${horizenIntentId} already solved on Base: ${isAlreadySolved}`);

  // Test with a simple intent ID (not the complex one)
  const simpleIntentId = 1;
  const isSimpleSolved = await bridge_Base.isIntentSolvedOnChain2(simpleIntentId);
  console.log(`- Is simple intent ${simpleIntentId} already solved on Base: ${isSimpleSolved}`);

  // Get current nonces
  let baseNonce = await baseProvider.getTransactionCount(baseWallet.address);
  console.log(`\n📊 Base nonce: ${baseNonce}`);

  // Test parameters for solveIntentOnChain2
  const userAddress = horizenWallet.address;
  const tokenBAddress = "0x7b3941bc307108E0BfD86005e41989e26798125D"; // TokenB from deployment
  const expectedAmountB = ethers.parseEther("95");
  const recipientAddress = "0xF8101b2bA8B9cdCcDD76B49474af9900827F463b";

  console.log("\n🔍 Testing solveIntentOnChain2 parameters:");
  console.log(`- Intent ID: ${simpleIntentId}`);
  console.log(`- User: ${userAddress}`);
  console.log(`- TokenB: ${tokenBAddress}`);
  console.log(`- Expected Amount: ${ethers.formatEther(expectedAmountB)}`);
  console.log(`- Recipient: ${recipientAddress}`);

  // Check if we have enough TokenB
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const tokenB_Base = MockERC20Factory.attach(tokenBAddress).connect(baseWallet) as any;
  
  const tokenBBalance = await tokenB_Base.balanceOf(baseWallet.address);
  console.log(`- TokenB Balance: ${ethers.formatEther(tokenBBalance)}`);

  if (tokenBBalance < expectedAmountB) {
    console.log("❌ Not enough TokenB balance for testing");
    return;
  }

  // Try to call solveIntentOnChain2 with simple intent ID
  try {
    console.log("\n🚀 Attempting solveIntentOnChain2 with simple intent ID...");
    
    // Approve TokenB first
    const approveTx = await tokenB_Base.approve(bridgeAddress_Base, expectedAmountB, { nonce: baseNonce++ });
    await approveTx.wait();
    console.log("✅ Approved TokenB");

    const solveTx = await bridge_Base.solveIntentOnChain2(
      simpleIntentId,
      userAddress,
      tokenBAddress,
      expectedAmountB,
      [recipientAddress],
      [expectedAmountB],
      { nonce: baseNonce++ }
    );
    await solveTx.wait();
    console.log("✅ solveIntentOnChain2 succeeded!");
    console.log(`📍 Transaction: ${networks.base.explorer}/tx/${solveTx.hash}`);
  } catch (error) {
    console.log("❌ solveIntentOnChain2 failed:");
    console.log(error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Debug failed:", error);
    process.exit(1);
  }); 