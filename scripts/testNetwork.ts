import { ethers } from "hardhat";

async function main() {
  console.log("🌐 Testing Horizen Testnet Connection...\n");

  try {
    // Get network information
    const network = await ethers.provider.getNetwork();
    console.log("📋 Network Information:");
    console.log("==========================================");
    console.log("Network Name:", network.name);
    console.log("Chain ID:", network.chainId.toString());
    console.log("==========================================\n");

    // Test connection by getting the latest block
    const blockNumber = await ethers.provider.getBlockNumber();
    console.log("🔗 Connection Test:");
    console.log("Latest Block Number:", blockNumber);

    // Get block details
    const block = await ethers.provider.getBlock(blockNumber);
    if (block) {
      console.log("Block Hash:", block.hash);
      console.log("Block Timestamp:", new Date(block.timestamp * 1000).toISOString());
    }

    console.log("\n✅ Successfully connected to Horizen Testnet!");
    console.log("\n🚀 Ready to deploy your bridge contract!");
    
    console.log("\n💡 Deploy command:");
    console.log("npx hardhat run scripts/deploy.ts --network horizen_testnet");

  } catch (error) {
    console.error("❌ Connection failed:", error);
    console.log("\n🔧 Troubleshooting:");
    console.log("1. Check if HORIZEN_TESTNET_RPC_URL is set in .env");
    console.log("2. Verify the RPC URL is accessible");
    console.log("3. Ensure your wallet has funds for gas fees");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  }); 