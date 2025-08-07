import { ethers } from "hardhat";

async function main() {
  console.log("🔐 Registering relayer on both contracts...\n");

  // Get providers
  const horizenProvider = new ethers.JsonRpcProvider(process.env.HORIZEN_TESTNET_RPC_URL!);
  const baseProvider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL!);

  // Get contract addresses
  const bridgeAddress_Horizen = process.env.BRIDGE_CONTRACT_HORIZEN_LATEST!;
  const bridgeAddress_Base = process.env.BRIDGE_CONTRACT_BASE_LATEST!;

  // Create wallets
  const privateKey = process.env.PRIVATE_KEY!;
  const horizenWallet = new ethers.Wallet(privateKey, horizenProvider);
  const baseWallet = new ethers.Wallet(privateKey, baseProvider);

  const relayerAddress = horizenWallet.address; // Same address for both networks

  console.log(`📍 Relayer address: ${relayerAddress}`);
  console.log(`📍 Horizen contract: ${bridgeAddress_Horizen}`);
  console.log(`📍 Base contract: ${bridgeAddress_Base}\n`);

  // Connect to contracts
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Horizen = BridgeFactory.attach(bridgeAddress_Horizen).connect(horizenWallet) as any;
  const bridge_Base = BridgeFactory.attach(bridgeAddress_Base).connect(baseWallet) as any;

  // Check current authorization status
  console.log("🔍 Checking current authorization status...");
  
  const isAuthorizedHorizen = await bridge_Horizen.authorizedRelayers(relayerAddress);
  const isAuthorizedBase = await bridge_Base.authorizedRelayers(relayerAddress);
  
  console.log(`📍 Horizen authorization: ${isAuthorizedHorizen}`);
  console.log(`📍 Base authorization: ${isAuthorizedBase}\n`);

  // Register on Horizen if not already authorized
  if (!isAuthorizedHorizen) {
    console.log("🔐 Registering relayer on Horizen...");
    try {
      const tx = await bridge_Horizen.addRelayer(relayerAddress);
      await tx.wait();
      console.log("✅ Relayer registered on Horizen");
      console.log(`📍 Transaction: ${tx.hash}`);
    } catch (error: any) {
      console.log(`❌ Error registering on Horizen: ${error.message}`);
    }
  } else {
    console.log("✅ Relayer already authorized on Horizen");
  }

  // Register on Base if not already authorized
  if (!isAuthorizedBase) {
    console.log("🔐 Registering relayer on Base...");
    try {
      const tx = await bridge_Base.addRelayer(relayerAddress);
      await tx.wait();
      console.log("✅ Relayer registered on Base");
      console.log(`📍 Transaction: ${tx.hash}`);
    } catch (error: any) {
      console.log(`❌ Error registering on Base: ${error.message}`);
    }
  } else {
    console.log("✅ Relayer already authorized on Base");
  }

  // Verify final authorization status
  console.log("\n🔍 Verifying final authorization status...");
  
  const finalAuthHorizen = await bridge_Horizen.authorizedRelayers(relayerAddress);
  const finalAuthBase = await bridge_Base.authorizedRelayers(relayerAddress);
  
  console.log(`📍 Horizen authorization: ${finalAuthHorizen}`);
  console.log(`📍 Base authorization: ${finalAuthBase}`);

  if (finalAuthHorizen && finalAuthBase) {
    console.log("\n🎉 Relayer successfully authorized on both networks!");
  } else {
    console.log("\n⚠️  Relayer authorization incomplete!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 