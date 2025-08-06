import { ethers } from "hardhat";

async function main() {
  console.log("🔍 CHECKING BRIDGE STATE");
  console.log("=========================");

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

  // Check latest intent IDs
  const latestHorizenIntentId = await bridge_Horizen.getLatestIntentId();
  const latestBaseIntentId = await bridge_Base.getLatestIntentId();
  
  console.log("\n📊 Latest Intent IDs:");
  console.log(`- Horizen: ${latestHorizenIntentId}`);
  console.log(`- Base: ${latestBaseIntentId}`);

  // Check active intents
  const activeHorizenIntents = await bridge_Horizen.getActiveIntents();
  const activeBaseIntents = await bridge_Base.getActiveIntents();
  
  console.log("\n🎯 Active Intents:");
  console.log(`- Horizen: ${activeHorizenIntents.length > 0 ? activeHorizenIntents.join(', ') : 'None'}`);
  console.log(`- Base: ${activeBaseIntents.length > 0 ? activeBaseIntents.join(', ') : 'None'}`);

  // Check solved intents on Base
  console.log("\n✅ Solved Intents on Base:");
  for (let i = 1; i <= 5; i++) {
    const isSolved = await bridge_Base.isIntentSolvedOnChain2(i);
    if (isSolved) {
      console.log(`- Intent ${i}: SOLVED`);
    }
  }

  // Check specific intent details
  if (latestHorizenIntentId > 0) {
    console.log("\n📋 Latest Intent Details:");
    try {
      const intentDetails = await bridge_Horizen.getIntentDetails(latestHorizenIntentId);
      console.log(`- Intent ID: ${latestHorizenIntentId}`);
      console.log(`- User: ${intentDetails.user}`);
      console.log(`- TokenA: ${intentDetails.tokenA}`);
      console.log(`- TokenB: ${intentDetails.tokenB}`);
      console.log(`- AmountA: ${ethers.formatEther(intentDetails.amountA)}`);
      console.log(`- ExpectedAmountB: ${ethers.formatEther(intentDetails.expectedAmountB)}`);
      console.log(`- Reward: ${ethers.formatEther(intentDetails.reward)}`);
      console.log(`- EndTime: ${intentDetails.endTime} (${new Date(Number(intentDetails.endTime) * 1000)})`);
      console.log(`- Completed: ${intentDetails.completed}`);
      console.log(`- WinningSolver: ${intentDetails.winningSolver}`);
      console.log(`- WinningBid: ${ethers.formatEther(intentDetails.winningBid)}`);
    } catch (error) {
      console.log(`- Error getting intent details: ${error}`);
    }
  }

  // Extract local intent ID
  if (latestHorizenIntentId > 0) {
    const localIntentId = await bridge_Horizen.getLocalIntentId(latestHorizenIntentId);
    console.log(`\n🔍 Local Intent ID: ${localIntentId}`);
    
    // Check if this local intent is solved on Base
    const isSolved = await bridge_Base.isIntentSolvedOnChain2(localIntentId);
    console.log(`- Is solved on Base: ${isSolved}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Check state failed:", error);
    process.exit(1);
  }); 