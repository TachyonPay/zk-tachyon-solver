import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying Cross-Chain Bridge with Solver Network...\n");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy BridgeIntent contract
  console.log("📦 Deploying BridgeIntent contract...");
  const BridgeIntent = await ethers.getContractFactory("BridgeIntent");
  const bridgeIntent = await BridgeIntent.deploy();
  await bridgeIntent.waitForDeployment();

  const bridgeAddress = await bridgeIntent.getAddress();
  console.log("✅ BridgeIntent deployed to:", bridgeAddress);

  // Deploy MockERC20 tokens for testing (optional)
  if (process.env.DEPLOY_TEST_TOKENS === "true") {
    console.log("\n🪙 Deploying test tokens...");
    
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    const tokenA = await MockERC20.deploy("Test Token A", "TKNA", ethers.parseEther("1000000"));
    await tokenA.waitForDeployment();
    
    const tokenB = await MockERC20.deploy("Test Token B", "TKNB", ethers.parseEther("1000000"));
    await tokenB.waitForDeployment();

    console.log("✅ Test Token A deployed to:", await tokenA.getAddress());
    console.log("✅ Test Token B deployed to:", await tokenB.getAddress());
  }

  console.log("\n🎉 Deployment completed!");
  console.log("\n📋 Contract Addresses:");
  console.log("BridgeIntent:", bridgeAddress);

  console.log("\n🔧 Next Steps:");
  console.log("1. Add authorized relayers using addRelayer(address)");
  console.log("2. Users can create intents using createIntent()");
  console.log("3. Solvers can bid on intents using placeBid()");
  console.log("4. Relayers can distribute funds using distributeFunds()");

  console.log("\n📖 For detailed usage, see the README.md file");

  // Verify contract on Etherscan (if supported)
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("\n🔍 Contract verification will be available shortly on Etherscan");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 