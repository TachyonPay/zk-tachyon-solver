import axios from "axios";
import { ethers } from "ethers";

const RELAYER_URL = 'http://localhost:3000';

async function main() {
  console.log("🔐 TESTING PRIVACY ENDPOINTS (SIMPLE)");
  console.log("======================================");

  try {
    // Generate valid Ethereum addresses
    const wallet1 = ethers.Wallet.createRandom();
    const wallet2 = ethers.Wallet.createRandom();
    const wallet3 = ethers.Wallet.createRandom();

    // Test 1: Store recipient information with valid addresses
    console.log("\n1. Testing store-recipients endpoint...");
    
    const testIntentId = "287647493468149004223305994324593771393899823122";
    const testRecipients = [
      wallet1.address,
      wallet2.address,
      wallet3.address
    ];
    const testAmounts = [
      "50000000000000000000", // 50 tokens
      "30000000000000000000", // 30 tokens
      "15000000000000000000"  // 15 tokens
    ];
    const testChainId = 84532; // Base

    console.log("Generated addresses:");
    console.log("- Recipient 1:", wallet1.address);
    console.log("- Recipient 2:", wallet2.address);
    console.log("- Recipient 3:", wallet3.address);

    const storeResponse = await axios.post(`${RELAYER_URL}/store-recipients`, {
      intentId: testIntentId,
      recipients: testRecipients,
      amounts: testAmounts,
      chainId: testChainId
    });

    console.log('✅ Store recipients successful');
    console.log('Response:', storeResponse.data);

    // Test 2: Retrieve recipient information
    console.log("\n2. Testing get-recipients endpoint...");
    
    const getResponse = await axios.get(`${RELAYER_URL}/get-recipients/${testIntentId}`);
    
    console.log('✅ Get recipients successful');
    console.log('Response:', getResponse.data);

    // Test 3: List all stored intents
    console.log("\n3. Testing list-stored-intents endpoint...");
    
    const listResponse = await axios.get(`${RELAYER_URL}/list-stored-intents`);
    
    console.log('✅ List intents successful');
    console.log('Response:', listResponse.data);

    console.log("\n🎉 PRIVACY ENDPOINTS TEST COMPLETED SUCCESSFULLY!");
    console.log("================================================");

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log('❌ Test failed:');
      console.log('Status:', error.response?.status);
      console.log('Error:', error.response?.data?.error || error.message);
      console.log('Details:', error.response?.data);
    } else {
      console.log('❌ Test failed:', error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Privacy endpoints test failed:", error);
    process.exit(1);
  }); 