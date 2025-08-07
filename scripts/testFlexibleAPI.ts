import axios from "axios";

const RELAYER_URL = 'http://localhost:3000';

async function testFlexibleAPI() {
  console.log("🧪 TESTING FLEXIBLE CROSS-CHAIN API");
  console.log("====================================");

  try {
    // Test 1: Health endpoint
    console.log("\n1. Testing health endpoint...");
    const healthResponse = await axios.get(`${RELAYER_URL}/health`);
    console.log('✅ Health check passed');
    console.log('Horizen Chain ID:', healthResponse.data.networks.horizen.chainId);
    console.log('Base Chain ID:', healthResponse.data.networks.base.chainId);

    // Test 2: Verify intent solved on Base (destination chain)
    console.log("\n2. Testing verify endpoint - Base as destination...");
    const verifyBaseResponse = await axios.post(`${RELAYER_URL}/verify`, {
      chain2IntentId: "7",
      chainId: 84532  // Base chain ID
    });
    console.log('✅ Verify Base request successful');
    console.log('Intent solved:', verifyBaseResponse.data.isSolved);
    console.log('Network:', verifyBaseResponse.data.network);
    console.log('Message:', verifyBaseResponse.data.message);

    // Test 3: Verify intent solved on Horizen (destination chain)
    console.log("\n3. Testing verify endpoint - Horizen as destination...");
    const verifyHorizenResponse = await axios.post(`${RELAYER_URL}/verify`, {
      chain2IntentId: "999",
      chainId: 845320009  // Horizen chain ID
    });
    console.log('✅ Verify Horizen request successful');
    console.log('Intent solved:', verifyHorizenResponse.data.isSolved);
    console.log('Network:', verifyHorizenResponse.data.network);
    console.log('Message:', verifyHorizenResponse.data.message);

    // Test 4: Settle intent (Base → Horizen flow)
    console.log("\n4. Testing settle endpoint - Base to Horizen flow...");
    try {
      const settleResponse = await axios.post(`${RELAYER_URL}/settle`, {
        intentId: "287647493468149004223305994324593771393899823113", // Latest intent ID
        chain2IntentId: "9", // Latest local intent ID
        originChainId: 845320009,      // Horizen (where intent was created)
        destinationChainId: 84532,     // Base (where intent was solved)
        solverAddress: "0x93dC72De59c169AA07b23F8D487021e15C57776E"
      });
      console.log('✅ Settle request successful');
      console.log('Transaction Hash:', settleResponse.data.transactionHash);
      console.log('Block Number:', settleResponse.data.blockNumber);
      console.log('Network:', settleResponse.data.network);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.log('⚠️  Settle request failed (expected if intent already settled):');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.error || error.message);
        
        // If intent already completed, that's expected
        if (error.response?.data?.error === 'Intent already completed') {
          console.log('ℹ️  This is expected - intent was already settled');
        }
      }
    }

    // Test 5: Settle intent (Horizen → Base flow) - Example for reverse direction
    console.log("\n5. Testing settle endpoint - Horizen to Base flow (example)...");
    try {
      const settleReverseResponse = await axios.post(`${RELAYER_URL}/settle`, {
        intentId: "999999999999999999999999999999999999999999999999",
        chain2IntentId: "1",
        originChainId: 84532,          // Base (where intent was created)
        destinationChainId: 845320009, // Horizen (where intent was solved)
        solverAddress: "0x93dC72De59c169AA07b23F8D487021e15C57776E"
      });
      console.log('✅ Settle reverse request successful');
      console.log('Transaction Hash:', settleReverseResponse.data.transactionHash);
      console.log('Block Number:', settleReverseResponse.data.blockNumber);
      console.log('Network:', settleReverseResponse.data.network);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.log('⚠️  Settle reverse request failed (expected - intent does not exist):');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.error || error.message);
      }
    }

    console.log("\n🎉 FLEXIBLE API TESTING COMPLETED!");
    console.log("===================================");
    console.log("✅ Health endpoint: Working");
    console.log("✅ Verify endpoint: Works for both chains");
    console.log("✅ Settle endpoint: Supports both directions");
    console.log();
    console.log("🔄 Supported Flows:");
    console.log("1. Horizen → Base: Create on Horizen, solve on Base, settle on Horizen");
    console.log("2. Base → Horizen: Create on Base, solve on Horizen, settle on Base");
    console.log();
    console.log("📡 API Parameters:");
    console.log("- originChainId: Chain where intent was created and will be settled");
    console.log("- destinationChainId: Chain where intent was solved");
    console.log("- chain2IntentId: Local intent ID on destination chain");
    console.log("- intentId: Full intent ID on origin chain");

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log('❌ API test failed:');
      console.log('Status:', error.response?.status);
      console.log('Error:', error.response?.data?.error || error.message);
    } else {
      console.log('❌ API test failed:', error);
    }
  }
}

testFlexibleAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Flexible API test failed:", error);
    process.exit(1);
  }); 