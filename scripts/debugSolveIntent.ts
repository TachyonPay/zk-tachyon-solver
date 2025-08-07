import { ethers } from "hardhat";

async function main() {
  console.log("🔍 DEBUG: solveIntentOnChain2 Issue");
  console.log("===================================");

  // Network configurations
  const networks = {
    base: {
      name: "Base Sepolia", 
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL!,
      chainId: 84532,
      explorer: "https://sepolia-explorer.base.org"
    }
  };

  // Create provider and wallet for Base
  const baseProvider = new ethers.JsonRpcProvider(networks.base.rpcUrl);
  const privateKey = process.env.PRIVATE_KEY!;
  const baseWallet = new ethers.Wallet(privateKey, baseProvider);

  console.log(`🔗 Network: ${networks.base.name}`);
  console.log(`👤 Wallet: ${baseWallet.address}`);
  console.log();

  // Contract addresses
  const bridgeAddress_Base = "0xd2C8C5C6DAD1be31077b0EeDEb78fcB62f7e1066";
  const tokenB_Base = "0xbDD77345043e28b0d2BA0640B5A8ef4E8dCFf799"; // From the test

  console.log("🔗 Contract Addresses:");
  console.log(`- Bridge (Base): ${bridgeAddress_Base}`);
  console.log(`- TokenB (Base): ${tokenB_Base}`);
  console.log();

  // Connect to contracts
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Base = BridgeFactory.attach(bridgeAddress_Base).connect(baseWallet) as any;
  
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const tokenB_Contract = MockERC20Factory.attach(tokenB_Base).connect(baseWallet) as any;

  // Check token balance
  const tokenBalance = await tokenB_Contract.balanceOf(baseWallet.address);
  console.log(`💰 TokenB Balance: ${ethers.formatEther(tokenBalance)}`);
  
  // Check allowance
  const allowance = await tokenB_Contract.allowance(baseWallet.address, bridgeAddress_Base);
  console.log(`✅ Allowance: ${ethers.formatEther(allowance)}`);
  
  // Check if we need to approve
  const EXPECTED_AMOUNT_B = ethers.parseEther("95");
  if (allowance < EXPECTED_AMOUNT_B) {
    console.log(`⚠️  Need to approve more tokens. Current: ${ethers.formatEther(allowance)}, Required: ${ethers.formatEther(EXPECTED_AMOUNT_B)}`);
    
    // Get current nonce
    const currentNonce = await baseProvider.getTransactionCount(baseWallet.address);
    console.log(`📊 Current nonce: ${currentNonce}`);
    
    // Approve tokens
    console.log("🔄 Approving tokens...");
    const approveTx = await tokenB_Contract.approve(bridgeAddress_Base, EXPECTED_AMOUNT_B, { nonce: currentNonce });
    await approveTx.wait();
    console.log(`✅ Approval successful: ${approveTx.hash}`);
    
    // Check new allowance
    const newAllowance = await tokenB_Contract.allowance(baseWallet.address, bridgeAddress_Base);
    console.log(`✅ New allowance: ${ethers.formatEther(newAllowance)}`);
  } else {
    console.log("✅ Sufficient allowance already exists");
  }

  // Test solveIntentOnChain2 with intent 17
  const localIntentId = 17n;
  const userAddress = "0x93dC72De59c169AA07b23F8D487021e15C57776E";
  const recipientAddress = "0xE78aB27239a9A6697B22d8409423132f381E4D65";
  
  console.log("\n🧪 Testing solveIntentOnChain2:");
  console.log(`- Local Intent ID: ${localIntentId}`);
  console.log(`- User Address: ${userAddress}`);
  console.log(`- TokenB Address: ${tokenB_Base}`);
  console.log(`- Expected Amount: ${ethers.formatEther(EXPECTED_AMOUNT_B)}`);
  console.log(`- Recipient: ${recipientAddress}`);
  
  // Get current nonce for the solve transaction
  const solveNonce = await baseProvider.getTransactionCount(baseWallet.address);
  console.log(`📊 Solve transaction nonce: ${solveNonce}`);
  
  try {
    // Call solveIntentOnChain2
    const solveTx = await bridge_Base.solveIntentOnChain2(
      localIntentId,
      userAddress,
      tokenB_Base,
      EXPECTED_AMOUNT_B,
      [recipientAddress],
      [EXPECTED_AMOUNT_B],
      { nonce: solveNonce }
    );
    
    console.log("⏳ Transaction sent, waiting for confirmation...");
    await solveTx.wait();
    console.log(`✅ solveIntentOnChain2 successful: ${solveTx.hash}`);
    
    // Check if intent is now solved
    const isSolved = await bridge_Base.isIntentSolvedOnChain2(localIntentId);
    console.log(`🔍 Intent ${localIntentId} solved status: ${isSolved}`);
    
    // Check recipient balance
    const recipientBalance = await tokenB_Contract.balanceOf(recipientAddress);
    console.log(`💰 Recipient balance: ${ethers.formatEther(recipientBalance)} TokenB`);
    
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