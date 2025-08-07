import { ethers } from "hardhat";

async function main() {
  console.log("🔍 GETTING LATEST INTENT IDS");
  console.log("============================");

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

  // Create providers
  const horizenProvider = new ethers.JsonRpcProvider(networks.horizen.rpcUrl);
  const baseProvider = new ethers.JsonRpcProvider(networks.base.rpcUrl);

  // Contract addresses
  const bridgeAddress_Horizen = "0x8d692017aEA872De988AC27FfD6B9Fed3FF0FC13";
  const bridgeAddress_Base = "0xd2C8C5C6DAD1be31077b0EeDEb78fcB62f7e1066";

  // Connect to bridge contracts
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Horizen = BridgeFactory.attach(bridgeAddress_Horizen).connect(horizenProvider) as any;
  const bridge_Base = BridgeFactory.attach(bridgeAddress_Base).connect(baseProvider) as any;

  console.log("🔗 Network Status:");
  console.log(`- ${networks.horizen.name}: Block ${await horizenProvider.getBlockNumber()}`);
  console.log(`- ${networks.base.name}: Block ${await baseProvider.getBlockNumber()}`);
  console.log();

  // Get latest intent IDs
  console.log("📊 Latest Intent IDs:");
  
  const latestHorizenIntentId = await bridge_Horizen.getLatestIntentId();
  console.log(`- Horizen Latest Intent ID: ${latestHorizenIntentId}`);
  
  if (latestHorizenIntentId > 0) {
    const localHorizenIntentId = await bridge_Horizen.getLocalIntentId(latestHorizenIntentId);
    console.log(`- Horizen Local Intent ID: ${localHorizenIntentId}`);
  }

  const latestBaseIntentId = await bridge_Base.getLatestIntentId();
  console.log(`- Base Latest Intent ID: ${latestBaseIntentId}`);
  
  if (latestBaseIntentId > 0) {
    const localBaseIntentId = await bridge_Base.getLocalIntentId(latestBaseIntentId);
    console.log(`- Base Local Intent ID: ${localBaseIntentId}`);
  }

  console.log();

  // Check solved status for recent intents
  console.log("🔍 Recent Intent Solved Status:");
  
  if (latestHorizenIntentId > 0) {
    const localHorizenIntentId = await bridge_Horizen.getLocalIntentId(latestHorizenIntentId);
    const isSolvedOnBase = await bridge_Base.isIntentSolvedOnChain2(localHorizenIntentId);
    console.log(`- Intent ${localHorizenIntentId} solved on Base: ${isSolvedOnBase}`);
  }

  if (latestBaseIntentId > 0) {
    const localBaseIntentId = await bridge_Base.getLocalIntentId(latestBaseIntentId);
    const isSolvedOnHorizen = await bridge_Horizen.isIntentSolvedOnChain2(localBaseIntentId);
    console.log(`- Intent ${localBaseIntentId} solved on Horizen: ${isSolvedOnHorizen}`);
  }

  console.log();
  console.log("📡 API Test Commands:");
  console.log("=====================");
  
  if (latestHorizenIntentId > 0) {
    const localHorizenIntentId = await bridge_Horizen.getLocalIntentId(latestHorizenIntentId);
    console.log(`# Test verify endpoint for latest Horizen intent:`);
    console.log(`curl -X POST http://localhost:3000/verify -H "Content-Type: application/json" -d '{"chain2IntentId": "${localHorizenIntentId}", "chainId": 84532}'`);
    console.log();
    console.log(`# Test settle endpoint for latest Horizen intent:`);
    console.log(`curl -X POST http://localhost:3000/settle -H "Content-Type: application/json" -d '{"intentId": "${latestHorizenIntentId}", "chain2IntentId": "${localHorizenIntentId}", "originChainId": 845320009, "destinationChainId": 84532, "solverAddress": "0x93dC72De59c169AA07b23F8D487021e15C57776E"}'`);
    console.log();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed to get latest intent IDs:", error);
    process.exit(1);
  }); 