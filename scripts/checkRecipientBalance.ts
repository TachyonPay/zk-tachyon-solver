import { ethers } from "hardhat";

async function main() {
  console.log("🔍 CHECKING RECIPIENT BALANCE");
  console.log("=============================");

  // Network configurations
  const networks = {
    base: {
      name: "Base Sepolia", 
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL!,
      chainId: 84532,
      explorer: "https://sepolia-explorer.base.org"
    }
  };

  // Create provider
  const baseProvider = new ethers.JsonRpcProvider(networks.base.rpcUrl);

  // Contract addresses
  const bridgeAddress_Base = "0xd2C8C5C6DAD1be31077b0EeDEb78fcB62f7e1066";
  const tokenBAddress = "0xb0313e72ba6451A23E03B965EaF7B44725b8C21e"; // Latest deployed token

  // Connect to bridge contract
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Base = BridgeFactory.attach(bridgeAddress_Base).connect(baseProvider) as any;

  // Connect to token
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  const tokenB_Base = MockERC20Factory.attach(tokenBAddress).connect(baseProvider) as any;

  console.log("🔗 Network Status:");
  console.log(`- ${networks.base.name}: Block ${await baseProvider.getBlockNumber()}`);
  console.log(`- TokenB Address: ${tokenBAddress}`);
  console.log();

  // Check intent 11 status
  const localIntentId = 11;
  const isSolved = await bridge_Base.isIntentSolvedOnChain2(localIntentId);
  console.log(`Intent ${localIntentId} solved: ${isSolved}`);
  console.log();

  // Check recipient balance (from the test output)
  const recipientAddress = "0xA4dFA9d209Eb3406d8F7E8625f66C36b71A6E56f";
  const recipientBalance = await tokenB_Base.balanceOf(recipientAddress);
  console.log(`Recipient ${recipientAddress}:`);
  console.log(`- Balance: ${ethers.formatEther(recipientBalance)} TokenB`);
  console.log();

  // Check solver balance
  const solverAddress = "0x93dC72De59c169AA07b23F8D487021e15C57776E";
  const solverBalance = await tokenB_Base.balanceOf(solverAddress);
  console.log(`Solver ${solverAddress}:`);
  console.log(`- Balance: ${ethers.formatEther(solverBalance)} TokenB`);
  console.log();

  // Check bridge contract balance
  const bridgeBalance = await tokenB_Base.balanceOf(bridgeAddress_Base);
  console.log(`Bridge Contract ${bridgeAddress_Base}:`);
  console.log(`- Balance: ${ethers.formatEther(bridgeBalance)} TokenB`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed to check recipient balance:", error);
    process.exit(1);
  }); 