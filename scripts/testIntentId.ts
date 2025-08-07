import { ethers } from "hardhat";

async function main() {
  const baseProvider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL!);
  const bridgeAddress_Base = "0xd2C8C5C6DAD1be31077b0EeDEb78fcB62f7e1066";
  
  // Connect to the contract
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Base = BridgeFactory.attach(bridgeAddress_Base);
  
  // Test with the full intent ID
  const fullIntentId = 287647493468149004223305994324593771393899823140n;
  const localIntentId = 36n;
  
  console.log(`Full intent ID: ${fullIntentId}`);
  console.log(`Full intent ID as hex: 0x${fullIntentId.toString(16)}`);
  console.log(`Local intent ID: ${localIntentId}`);
  console.log(`Local intent ID as hex: 0x${localIntentId.toString(16)}`);
  
  // Check if intent is already solved with full ID
  try {
    const isSolvedFull = await bridge_Base.isIntentSolvedOnChain2(fullIntentId);
    console.log(`Intent ${fullIntentId} solved status: ${isSolvedFull}`);
  } catch (error) {
    console.log(`Error checking full intent ID: ${error}`);
  }
  
  // Check if intent is already solved with local ID
  try {
    const isSolvedLocal = await bridge_Base.isIntentSolvedOnChain2(localIntentId);
    console.log(`Intent ${localIntentId} solved status: ${isSolvedLocal}`);
  } catch (error) {
    console.log(`Error checking local intent ID: ${error}`);
  }
  
  // Test the getLocalIntentId function
  try {
    const extractedLocalId = await bridge_Base.getLocalIntentId(fullIntentId);
    console.log(`Extracted local ID from full ID: ${extractedLocalId}`);
  } catch (error) {
    console.log(`Error extracting local ID: ${error}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 