import { ethers } from "hardhat";

async function main() {
  const baseProvider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL!);
  const bridgeAddress_Base = "0xd2C8C5C6DAD1be31077b0EeDEb78fcB62f7e1066";
  
  // Connect to the contract
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Base = BridgeFactory.attach(bridgeAddress_Base);
  
  // Check if intent is already solved
  const intentId = 287647493468149004223305994324593771393899823132n;
  const isSolved = await bridge_Base.isIntentSolvedOnChain2(intentId);
  
  console.log(`Intent ${intentId} solved status: ${isSolved}`);
  
  // Also check with the solvedIntents mapping directly
  const solvedStatus = await bridge_Base.solvedIntents(intentId);
  console.log(`Intent ${intentId} solvedIntents mapping: ${solvedStatus}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 