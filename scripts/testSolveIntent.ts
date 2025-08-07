import { ethers } from "hardhat";

async function main() {
  const baseProvider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL!);
  const bridgeAddress_Base = "0xd2C8C5C6DAD1be31077b0EeDEb78fcB62f7e1066";
  
  // Create wallet
  const privateKey = process.env.PRIVATE_KEY!;
  const wallet = new ethers.Wallet(privateKey, baseProvider);
  
  // Connect to the contract
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Base = BridgeFactory.attach(bridgeAddress_Base).connect(wallet);
  
  // Deploy a test token
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const testToken = await MockERC20Factory.connect(wallet).deploy(
    "Test Token", "TEST", ethers.parseEther("1000000")
  );
  await testToken.waitForDeployment();
  
  console.log(`Test token deployed: ${await testToken.getAddress()}`);
  
  // Create a test intent ID (using a simple number to avoid complexity)
  const testIntentId = 123456789n;
  const testUser = wallet.address;
  const testAmount = ethers.parseEther("10");
  const testRecipients = [wallet.address];
  const testAmounts = [testAmount];
  
  console.log(`Testing solveIntentOnChain2 with:`);
  console.log(`- Intent ID: ${testIntentId}`);
  console.log(`- User: ${testUser}`);
  console.log(`- Token: ${await testToken.getAddress()}`);
  console.log(`- Amount: ${ethers.formatEther(testAmount)}`);
  console.log(`- Recipients: ${testRecipients.length}`);
  
  // Check if intent is already solved
  try {
    const isSolved = await bridge_Base.isIntentSolvedOnChain2(testIntentId);
    console.log(`Intent already solved: ${isSolved}`);
    
    if (isSolved) {
      console.log("Intent is already solved, skipping...");
      return;
    }
  } catch (error) {
    console.log(`Error checking if solved: ${error}`);
  }
  
  // Approve tokens
  console.log("Approving tokens...");
  const approveTx = await testToken.approve(bridgeAddress_Base, testAmount);
  await approveTx.wait();
  console.log("Tokens approved");
  
  // Try to solve the intent
  console.log("Calling solveIntentOnChain2...");
  try {
    const solveTx = await bridge_Base.solveIntentOnChain2(
      testIntentId,
      testUser,
      await testToken.getAddress(),
      testAmount,
      testRecipients,
      testAmounts
    );
    await solveTx.wait();
    console.log("✅ Intent solved successfully!");
    console.log(`Transaction: ${solveTx.hash}`);
  } catch (error) {
    console.log("❌ Error solving intent:");
    console.log(error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 