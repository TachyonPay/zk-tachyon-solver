import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying BridgeIntent Contracts with Chain ID Support");
  console.log("========================================================");

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

  console.log("🔗 Network Status:");
  console.log(`- ${networks.horizen.name}: Block ${await horizenProvider.getBlockNumber()}`);
  console.log(`- ${networks.base.name}: Block ${await baseProvider.getBlockNumber()}`);
  console.log(`- Wallet Address: ${horizenWallet.address}`);
  console.log();

  // Check balances
  const horizenBalance = await horizenProvider.getBalance(horizenWallet.address);
  const baseBalance = await baseProvider.getBalance(baseWallet.address);
  
  console.log("💰 Wallet Balances:");
  console.log(`- Horizen: ${ethers.formatEther(horizenBalance)} ETH`);
  console.log(`- Base: ${ethers.formatEther(baseBalance)} ETH`);
  console.log();

  // Deploy BridgeIntent contracts
  console.log("🏗️  Deploying BridgeIntent contracts...");
  
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  
  // Get current nonces
  let horizenNonce = await horizenProvider.getTransactionCount(horizenWallet.address);
  let baseNonce = await baseProvider.getTransactionCount(baseWallet.address);
  
  console.log(`- Horizen nonce: ${horizenNonce}`);
  console.log(`- Base nonce: ${baseNonce}`);
  
  // Deploy on Horizen
  console.log(`Deploying BridgeIntent on ${networks.horizen.name}...`);
  const bridge_Horizen = await (BridgeFactory as any).connect(horizenWallet).deploy(
    networks.horizen.chainId,
    { nonce: horizenNonce++ }
  );
  await bridge_Horizen.waitForDeployment();
  
  // Deploy on Base
  console.log(`Deploying BridgeIntent on ${networks.base.name}...`);
  const bridge_Base = await (BridgeFactory as any).connect(baseWallet).deploy(
    networks.base.chainId,
    { nonce: baseNonce++ }
  );
  await bridge_Base.waitForDeployment();

  console.log("✅ BridgeIntent contracts deployed successfully!");
  console.log();
  
  console.log("🔗 Contract Addresses:");
  console.log(`- Horizen: ${await bridge_Horizen.getAddress()}`);
  console.log(`- Base: ${await bridge_Base.getAddress()}`);
  console.log();

  // Verify chain IDs
  const horizenChainId = await (bridge_Horizen as any).getChainId();
  const baseChainId = await (bridge_Base as any).getChainId();
  
  console.log("🔗 Chain IDs:");
  console.log(`- Horizen Bridge Chain ID: ${horizenChainId}`);
  console.log(`- Base Bridge Chain ID: ${baseChainId}`);
  console.log();

  // Test intent ID generation
  console.log("🧪 Testing Intent ID Generation:");
  const testLocalId = 1;
  const horizenIntentId = await (bridge_Horizen as any).generateIntentId(testLocalId);
  const baseIntentId = await (bridge_Base as any).generateIntentId(testLocalId);
  
  console.log(`- Local Intent ID: ${testLocalId}`);
  console.log(`- Horizen Intent ID: ${horizenIntentId}`);
  console.log(`- Base Intent ID: ${baseIntentId}`);
  console.log();

  // Add relayers
  console.log("⚙️  Setting up relayers...");
  
  console.log("Adding relayer on Horizen...");
  const addRelayerTx1 = await bridge_Horizen.addRelayer(horizenWallet.address, { nonce: horizenNonce++ });
  await addRelayerTx1.wait();
  
  console.log("Adding relayer on Base...");
  const addRelayerTx2 = await bridge_Base.addRelayer(baseWallet.address, { nonce: baseNonce++ });
  await addRelayerTx2.wait();
  
  console.log("✅ Relayers added on both chains");
  console.log();

  // Deploy test tokens
  console.log("🪙 Deploying Test Tokens...");
  
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  
  // Deploy TokenA on Horizen (source token)
  console.log("Deploying TokenA on Horizen...");
  const tokenA_Horizen = await MockERC20Factory.connect(horizenWallet).deploy(
    "Horizen Token", "HZNA", ethers.parseEther("1000000"),
    { nonce: horizenNonce++ }
  );
  await tokenA_Horizen.waitForDeployment();
  
  // Deploy TokenB on Base (destination token)  
  console.log("Deploying TokenB on Base...");
  const tokenB_Base = await MockERC20Factory.connect(baseWallet).deploy(
    "Base Token", "BASEA", ethers.parseEther("1000000"),
    { nonce: baseNonce++ }
  );
  await tokenB_Base.waitForDeployment();

  console.log(`✅ TokenA (Horizen): ${await tokenA_Horizen.getAddress()}`);
  console.log(`✅ TokenB (Base): ${await tokenB_Base.getAddress()}`);
  console.log();

  // Final Summary
  console.log("🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
  console.log("=====================================");
  console.log();
  console.log("📋 Deployment Summary:");
  console.log(`1. BridgeIntent deployed on ${networks.horizen.name}: ${await bridge_Horizen.getAddress()}`);
  console.log(`2. BridgeIntent deployed on ${networks.base.name}: ${await bridge_Base.getAddress()}`);
  console.log(`3. TokenA deployed on ${networks.horizen.name}: ${await tokenA_Horizen.getAddress()}`);
  console.log(`4. TokenB deployed on ${networks.base.name}: ${await tokenB_Base.getAddress()}`);
  console.log(`5. Relayers configured on both chains`);
  console.log();
  console.log("🔗 Contract Addresses for liveCrossChain.ts:");
  console.log(`const bridgeAddress_Horizen = "${await bridge_Horizen.getAddress()}";`);
  console.log(`const bridgeAddress_Base = "${await bridge_Base.getAddress()}";`);
  console.log();
  console.log("🔗 All Transactions:");
  console.log(`- Horizen Explorer: ${networks.horizen.explorer}/address/${horizenWallet.address}`);
  console.log(`- Base Explorer: ${networks.base.explorer}/address/${baseWallet.address}`);
  console.log();
  console.log("✨ Ready for cross-chain bridging with chain ID support!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 