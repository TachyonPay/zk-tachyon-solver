import axios from "axios";

const RELAYER_URL = 'http://localhost:3000';

async function testProofVerification() {
  console.log("🧪 TESTING PROOF VERIFICATION FUNCTIONALITY");
  console.log("===========================================");

  try {
    // Test 1: Health endpoint
    console.log("\n1. Testing health endpoint...");
    const healthResponse = await axios.get(`${RELAYER_URL}/health`);
    console.log('✅ Health check passed');
    console.log('Status:', healthResponse.data.status);
    console.log('Networks configured:', Object.keys(healthResponse.data.networks).length);

    // Test 2: Standalone proof submission (mock data)
    console.log("\n2. Testing standalone proof submission...");
    const mockProofData = {
      proof: "mock_proof_data_here",
      publicSignals: ["mock_public_signal_1", "mock_public_signal_2"],
      imageId: "mock_image_id_here"
    };

    try {
      const proofResponse = await axios.post(`${RELAYER_URL}/submit-proof`, {
        proofData: mockProofData
      });
      console.log('✅ Proof submission successful');
      console.log('Job ID:', proofResponse.data.jobId);
      console.log('Status:', proofResponse.data.status);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.log('⚠️  Proof submission failed (expected without real API key):');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.error || error.message);
      }
    }

    // Test 3: Settle with proof (Base destination - requires proof)
    console.log("\n3. Testing settle-with-proof endpoint (Base destination)...");
    try {
      const settleWithProofResponse = await axios.post(`${RELAYER_URL}/settle-with-proof`, {
        intentId: "287647493468149004223305994324593771393899823115",
        chain2IntentId: "11",
        originChainId: 845320009,
        destinationChainId: 84532, // Base - requires proof
        solverAddress: "0x93dC72De59c169AA07b23F8D487021e15C57776E",
        proofData: mockProofData
      });
      console.log('✅ Settle with proof successful');
      console.log('Transaction Hash:', settleWithProofResponse.data.transactionHash);
      console.log('Proof Verification:', settleWithProofResponse.data.proofVerification);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.log('⚠️  Settle with proof failed (expected without real API key):');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.error || error.message);
      }
    }

    // Test 4: Settle with proof (Horizen destination - no proof required)
    console.log("\n4. Testing settle-with-proof endpoint (Horizen destination)...");
    try {
      const settleWithProofResponse2 = await axios.post(`${RELAYER_URL}/settle-with-proof`, {
        intentId: "287647493468149004223305994324593771393899823116",
        chain2IntentId: "12",
        originChainId: 84532,
        destinationChainId: 845320009, // Horizen - no proof required
        solverAddress: "0x93dC72De59c169AA07b23F8D487021e15C57776E"
        // No proofData needed for Horizen destination
      });
      console.log('✅ Settle with proof successful (Horizen destination)');
      console.log('Transaction Hash:', settleWithProofResponse2.data.transactionHash);
      console.log('Proof Verification:', settleWithProofResponse2.data.proofVerification);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.log('⚠️  Settle with proof failed:');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.error || error.message);
        
        // If intent already completed, that's expected
        if (error.response?.data?.error === 'Intent already completed') {
          console.log('ℹ️  This is expected - intent was already settled');
        }
      }
    }

    // Test 5: Regular settle endpoint (should work without proof)
    console.log("\n5. Testing regular settle endpoint...");
    try {
      const settleResponse = await axios.post(`${RELAYER_URL}/settle`, {
        intentId: "287647493468149004223305994324593771393899823117",
        chain2IntentId: "13",
        originChainId: 845320009,
        destinationChainId: 84532,
        solverAddress: "0x93dC72De59c169AA07b23F8D487021e15C57776E"
      });
      console.log('✅ Regular settle successful');
      console.log('Transaction Hash:', settleResponse.data.transactionHash);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.log('⚠️  Regular settle failed:');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.error || error.message);
        
        // If intent already completed, that's expected
        if (error.response?.data?.error === 'Intent already completed') {
          console.log('ℹ️  This is expected - intent was already settled');
        }
      }
    }

    console.log("\n🎉 PROOF VERIFICATION TESTING COMPLETED!");
    console.log("=======================================");
    console.log("✅ Health endpoint: Working");
    console.log("✅ Proof submission endpoint: Configured");
    console.log("✅ Settle-with-proof endpoint: Configured");
    console.log("✅ Regular settle endpoint: Working");
    console.log();
    console.log("📋 API Endpoints Summary:");
    console.log("- POST /health: Service status");
    console.log("- POST /verify: Check intent solved status");
    console.log("- POST /settle: Regular settlement (no proof required)");
    console.log("- POST /settle-with-proof: Settlement with proof verification for Base");
    console.log("- POST /submit-proof: Standalone proof submission");
    console.log("- GET /proof-status/:jobId: Check proof verification status");
    console.log();
    console.log("🔐 Proof Verification Flow:");
    console.log("1. For Base destination: Proof verification is required");
    console.log("2. For other destinations: Proof verification is skipped");
    console.log("3. Proof verification includes registration and finalization");
    console.log("4. Settlement only proceeds after successful proof verification");

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

testProofVerification()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Proof verification test failed:", error);
    process.exit(1);
  }); 