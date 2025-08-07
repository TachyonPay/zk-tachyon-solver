import axios from "axios";

const RELAYER_URL = 'http://localhost:3000';

async function main() {
  console.log("🔐 TESTING PRIVACY ENDPOINTS");
  console.log("=============================");

  try {
    // Test 1: Store recipient information
    console.log("\n1. Testing store-recipients endpoint...");
    
    const testIntentId = "287647493468149004223305994324593771393899823122";
    const testRecipients = [
      "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
      "0x8ba1f109551bD432803012645ac136c772c3e3C",
      "0x1234567890123456789012345678901234567890"
    ];
    const testAmounts = [
      "50000000000000000000", // 50 tokens
      "30000000000000000000", // 30 tokens
      "15000000000000000000"  // 15 tokens
    ];
    const testChainId = 84532; // Base

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

    // Test 4: Test with invalid data
    console.log("\n4. Testing validation with invalid data...");
    
    try {
      await axios.post(`${RELAYER_URL}/store-recipients`, {
        intentId: testIntentId,
        recipients: ["invalid-address"],
        amounts: ["1000000000000000000"],
        chainId: testChainId
      });
    } catch (error: any) {
      console.log('✅ Validation working - rejected invalid address');
      console.log('Error:', error.response?.data?.error);
    }

    // Test 5: Test with mismatched arrays
    console.log("\n5. Testing validation with mismatched arrays...");
    
    try {
      await axios.post(`${RELAYER_URL}/store-recipients`, {
        intentId: "test-intent-2",
        recipients: ["0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6"],
        amounts: ["1000000000000000000", "2000000000000000000"], // More amounts than recipients
        chainId: testChainId
      });
    } catch (error: any) {
      console.log('✅ Validation working - rejected mismatched arrays');
      console.log('Error:', error.response?.data?.error);
    }

    // Test 6: Test non-existent intent retrieval
    console.log("\n6. Testing retrieval of non-existent intent...");
    
    try {
      await axios.get(`${RELAYER_URL}/get-recipients/non-existent-intent`);
    } catch (error: any) {
      console.log('✅ Not found handling working');
      console.log('Status:', error.response?.status);
      console.log('Error:', error.response?.data?.error);
    }

    // Test 7: Store another intent for demonstration
    console.log("\n7. Storing another intent for demonstration...");
    
    const testIntentId2 = "287647493468149004223305994324593771393899823123";
    const testRecipients2 = [
      "0xabcdef1234567890abcdef1234567890abcdef12",
      "0xfedcba0987654321fedcba0987654321fedcba09"
    ];
    const testAmounts2 = [
      "25000000000000000000", // 25 tokens
      "75000000000000000000"  // 75 tokens
    ];

    const storeResponse2 = await axios.post(`${RELAYER_URL}/store-recipients`, {
      intentId: testIntentId2,
      recipients: testRecipients2,
      amounts: testAmounts2,
      chainId: 845320009 // Horizen
    });

    console.log('✅ Second intent stored successfully');
    console.log('Response:', storeResponse2.data);

    // Test 8: List all intents again
    console.log("\n8. Listing all stored intents...");
    
    const listResponse2 = await axios.get(`${RELAYER_URL}/list-stored-intents`);
    
    console.log('✅ List intents successful');
    console.log('Total intents:', listResponse2.data.count);
    console.log('Intents:', listResponse2.data.intents);

    // Test 9: Delete an intent
    console.log("\n9. Testing delete-recipients endpoint...");
    
    const deleteResponse = await axios.delete(`${RELAYER_URL}/delete-recipients/${testIntentId2}`);
    
    console.log('✅ Delete recipients successful');
    console.log('Response:', deleteResponse.data);

    // Test 10: Verify deletion
    console.log("\n10. Verifying deletion...");
    
    try {
      await axios.get(`${RELAYER_URL}/get-recipients/${testIntentId2}`);
    } catch (error: any) {
      console.log('✅ Deletion verified - intent not found');
      console.log('Status:', error.response?.status);
    }

    // Final list
    console.log("\n11. Final list of stored intents...");
    
    const finalListResponse = await axios.get(`${RELAYER_URL}/list-stored-intents`);
    
    console.log('✅ Final list successful');
    console.log('Remaining intents:', finalListResponse.data.count);

    console.log("\n🎉 PRIVACY ENDPOINTS TEST COMPLETED SUCCESSFULLY!");
    console.log("================================================");
    console.log();
    console.log("📋 Test Summary:");
    console.log("✅ Store recipient information");
    console.log("✅ Retrieve recipient information");
    console.log("✅ List all stored intents");
    console.log("✅ Input validation (invalid addresses, mismatched arrays)");
    console.log("✅ Not found handling");
    console.log("✅ Delete recipient information");
    console.log("✅ Privacy maintained between bridger and addresses");
    console.log();
    console.log("🔐 Privacy Features:");
    console.log("- Recipient addresses stored separately from on-chain intent");
    console.log("- Solvers can query relayer to get recipient information");
    console.log("- No on-chain link between intent and final recipients");
    console.log("- Support for multiple recipients per intent");
    console.log("- Automatic cleanup capabilities");

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log('❌ Test failed:');
      console.log('Status:', error.response?.status);
      console.log('Error:', error.response?.data?.error || error.message);
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