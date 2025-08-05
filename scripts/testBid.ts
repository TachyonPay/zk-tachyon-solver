import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Testing placeBid function...");
  
  const provider = new ethers.JsonRpcProvider(process.env.HORIZEN_TESTNET_RPC_URL!);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  
  console.log(`Wallet: ${wallet.address}`);
  
  const bridgeAddress = "0x2C5Ce1D2495d647F0BEf833444F134fDaF5D2868";
  console.log(`Contract: ${bridgeAddress}`);
  
  // Get contract factory and attach
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge = BridgeFactory.attach(bridgeAddress).connect(wallet) as any;
  
  console.log("✅ Contract attached");
  
  // Check latest intent ID
  try {
    const latestId = await bridge.getLatestIntentId();
    console.log(`📊 Latest Intent ID: ${latestId}`);
    
    if (latestId > 0) {
      // Try to get intent details
      const intentDetails = await bridge.getIntentDetails(latestId);
      console.log(`📋 Intent ${latestId} details:`);
      console.log(`  - User: ${intentDetails.user}`);
      console.log(`  - TokenA: ${intentDetails.tokenA}`);
      console.log(`  - AmountA: ${ethers.formatEther(intentDetails.amountA)}`);
      console.log(`  - End Time: ${new Date(Number(intentDetails.endTime) * 1000)}`);
      console.log(`  - Completed: ${intentDetails.completed}`);
      
      // Check if intent is still active
      const isActive = await bridge.isIntentActive(latestId);
      console.log(`  - Is Active: ${isActive}`);
      
      if (isActive) {
        console.log("\n🏁 Attempting to place bid...");
        const bidAmount = ethers.parseEther("98");
        
        console.log(`Bid amount: ${ethers.formatEther(bidAmount)} TokenA`);
        console.log(`Intent ID: ${latestId}`);
        
        // Try to estimate gas first
        try {
          const gasEstimate = await bridge.placeBid.estimateGas(latestId, bidAmount);
          console.log(`⛽ Gas estimate: ${gasEstimate}`);
          
          // Now try actual transaction
          const tx = await bridge.placeBid(latestId, bidAmount);
          console.log(`📝 Transaction hash: ${tx.hash}`);
          
          const receipt = await tx.wait();
          console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
          
        } catch (gasError: any) {
          console.log(`❌ Gas estimation failed:`, gasError.message);
        }
        
      } else {
        console.log("⚠️ Intent is not active");
      }
    } else {
      console.log("⚠️ No intents found");
    }
    
  } catch (error: any) {
    console.log("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }); 