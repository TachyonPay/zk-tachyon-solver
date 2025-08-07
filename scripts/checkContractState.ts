import { ethers } from "hardhat";

async function main() {
  console.log("🔍 CHECKING BRIDGE CONTRACT STATE");
  console.log("==================================");

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
  const tokenB_Base = "0xbDD77345043e28b0d2BA0640B5A8ef4E8dCFf799";

  console.log("🔗 Contract Addresses:");
  console.log(`- Bridge (Base): ${bridgeAddress_Base}`);
  console.log(`- TokenB (Base): ${tokenB_Base}`);
  console.log();

  // Connect to contracts
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Base = BridgeFactory.attach(bridgeAddress_Base).connect(baseWallet) as any;
  
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const tokenB_Contract = MockERC20Factory.attach(tokenB_Base).connect(baseWallet) as any;

  // Check chain ID
  const chainId = await bridge_Base.getChainId();
  console.log(`🔗 Bridge Chain ID: ${chainId}`);

  // Check solved intents mapping
  console.log("\n🔍 Checking solved intents:");
  for (let i = 1; i <= 20; i++) {
    const isSolved = await bridge_Base.isIntentSolvedOnChain2(i);
    if (isSolved) {
      console.log(`✅ Intent ${i}: SOLVED`);
    }
  }

  // Check specific intent 17
  console.log("\n🔍 Detailed check for Intent 17:");
  const intent17Solved = await bridge_Base.isIntentSolvedOnChain2(17);
  console.log(`- Solved status: ${intent17Solved}`);

  // Check token balances
  console.log("\n💰 Token Balances:");
  const solverBalance = await tokenB_Contract.balanceOf(baseWallet.address);
  console.log(`- Solver balance: ${ethers.formatEther(solverBalance)} TokenB`);
  
  const bridgeBalance = await tokenB_Contract.balanceOf(bridgeAddress_Base);
  console.log(`- Bridge contract balance: ${ethers.formatEther(bridgeBalance)} TokenB`);
  
  const recipientBalance = await tokenB_Contract.balanceOf("0xE78aB27239a9A6697B22d8409423132f381E4D65");
  console.log(`- Recipient balance: ${ethers.formatEther(recipientBalance)} TokenB`);

  // Check allowances
  console.log("\n✅ Allowances:");
  const allowance = await tokenB_Contract.allowance(baseWallet.address, bridgeAddress_Base);
  console.log(`- Solver -> Bridge: ${ethers.formatEther(allowance)} TokenB`);

  // Check if bridge is a relayer
  console.log("\n🔐 Relayer Status:");
  try {
    const isRelayer = await bridge_Base.relayers(baseWallet.address);
    console.log(`- Is relayer: ${isRelayer}`);
  } catch (error) {
    console.log(`- Relayer check failed: ${error}`);
  }

  // Check contract owner
  console.log("\n👑 Contract Owner:");
  try {
    const owner = await bridge_Base.owner();
    console.log(`- Owner: ${owner}`);
  } catch (error) {
    console.log(`- Owner check failed: ${error}`);
  }

  // Check latest intent ID
  console.log("\n📊 Latest Intent ID:");
  try {
    const latestIntentId = await bridge_Base.getLatestIntentId();
    console.log(`- Latest: ${latestIntentId}`);
  } catch (error) {
    console.log(`- Latest intent check failed: ${error}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Contract state check failed:", error);
    process.exit(1);
  }); 