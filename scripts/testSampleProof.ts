import axios from "axios";
import * as fs from "fs";
import * as path from "path";

const RELAYER_URL = 'http://localhost:3000';

async function testSampleProof() {
  console.log("🧪 TESTING SAMPLE SP1 PROOF VERIFICATION");
  console.log("=========================================");

  try {
    // Read the sample proof data
    const samplePath = path.join(__dirname, '../relayer/src/sample.json');
    const sampleData = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    
    console.log("📄 Sample proof data loaded:");
    console.log("- Proof length:", sampleData.proof.length);
    console.log("- Public signals count:", sampleData.publicSignals?.length || 'N/A');
    console.log("- VK:", sampleData.vk || 'N/A');

    // Test health endpoint first
    console.log("\n1. Testing health endpoint...");
    const healthResponse = await axios.get(`${RELAYER_URL}/health`);
    console.log('✅ Health check passed');
    console.log('Status:', healthResponse.data.status);

    // Test standalone proof submission with sample data
    console.log("\n2. Testing standalone proof submission with sample data...");
    try {
      const sampleProofData = {
        proof: sampleData.proof,
        publicSignals: sampleData.publicSignals || [],
        vk: sampleData.vk
      };
      
      const proofResponse = await axios.post(`${RELAYER_URL}/submit-proof`, { 
        proofData: sampleProofData 
      });
      console.log('✅ Sample proof submission successful');
      console.log('Job ID:', proofResponse.data.jobId);
      console.log('Status:', proofResponse.data.status);
      console.log('Message:', proofResponse.data.message);
      
      // Check proof status
      console.log("\n3. Checking proof status...");
      const statusResponse = await axios.get(`${RELAYER_URL}/proof-status/${proofResponse.data.jobId}`);
      console.log('✅ Proof status retrieved');
      console.log('Status:', statusResponse.data.status);
      console.log('Details:', statusResponse.data.details);
      
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.log('⚠️  Sample proof submission failed:');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.error || error.message);
        if (error.response?.data?.message) {
          console.log('Details:', error.response.data.message);
        }
      }
    }

    // Test settle-with-proof endpoint with a fresh intent ID
    console.log("\n4. Testing settle-with-proof endpoint (Base destination)...");
    console.log("⚠️  Note: You need to run 'npx ts-node scripts/createAndTestIntent.ts' first to create a fresh intent");
    console.log("Then update the intent IDs below with the actual values from that script");
    
    try {
      const sampleProofData = {
        proof: sampleData.proof,
        publicSignals: sampleData.publicSignals || [],
        vk: sampleData.vk
      };
      
      // TODO: Update these with actual intent IDs from createAndTestIntent.ts
      const freshIntentId = "287647493468149004223305994324593771393899823116"; // Intent 12 on Horizen
      const freshChain2IntentId = "12"; // Intent 12 on Base (confirmed solved)
      
      console.log(`Using intent ID: ${freshIntentId}`);
      console.log(`Using chain2 intent ID: ${freshChain2IntentId}`);
      
      const settleWithProofResponse = await axios.post(`${RELAYER_URL}/settle-with-proof`, {
        intentId: freshIntentId,
        chain2IntentId: freshChain2IntentId,
        originChainId: 845320009,
        destinationChainId: 84532, // Base - requires proof
        solverAddress: "0x93dC72De59c169AA07b23F8D487021e15C57776E",
        proofData: sampleProofData
      });
      console.log('✅ Settle with proof successful');
      console.log('Transaction Hash:', settleWithProofResponse.data.transactionHash);
      console.log('Proof Verification:', settleWithProofResponse.data.proofVerification);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.log('⚠️  Settle with proof failed:');
        console.log('Status:', error.response?.status);
        console.log('Error:', error.response?.data?.error || error.message);
        if (error.response?.data?.message) {
          console.log('Details:', error.response.data.message);
        }
      }
    }

    console.log("\n🎉 SAMPLE PROOF VERIFICATION TESTING COMPLETED!");
    console.log("===============================================");
    console.log("✅ Sample proof data loaded successfully");
    console.log("✅ Health endpoint: Working");
    console.log("✅ Proof submission endpoint: Tested");
    console.log("✅ Proof status endpoint: Tested");
    console.log("✅ Settle-with-proof endpoint: Tested");
    console.log();
    console.log("📋 Sample Proof Details:");
    console.log("- Proof type: SP1");
    console.log("- Proof size: Large (typical for SP1 proofs)");
    console.log("- Contains: proof, publicSignals, vk");
    console.log();
    console.log("🔐 Verification Flow Tested:");
    console.log("1. Standalone proof submission to zkVerify");
    console.log("2. Proof status checking");
    console.log("3. Settlement with proof verification for Base destination");

  } catch (error) {
    console.error("❌ Sample proof verification test failed:", error);
    if (axios.isAxiosError(error)) {
      console.error("Response:", error.response?.data);
    }
  }
}

testSampleProof()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Sample proof test failed:", error);
    process.exit(1);
  }); 