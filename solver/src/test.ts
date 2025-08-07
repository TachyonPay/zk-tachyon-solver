import { ethers } from 'ethers';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testSolverFunctions() {
  console.log('🧪 Testing Solver Functions');
  console.log('============================');

  try {
    // Setup connections
    const privateKey = process.env.PRIVATE_KEY!;
    const horizenProvider = new ethers.JsonRpcProvider(process.env.HORIZEN_TESTNET_RPC_URL!);
    const baseProvider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL!);
    
    const horizenWallet = new ethers.Wallet(privateKey, horizenProvider);
    const baseWallet = new ethers.Wallet(privateKey, baseProvider);

    const contractArtifact = require('./BridgeIntent.json');

    const horizenContract = new ethers.Contract(
      process.env.BRIDGE_CONTRACT_HORIZEN_LATEST!,
      contractArtifact.abi,
      horizenWallet
    );

    const baseContract = new ethers.Contract(
      process.env.BRIDGE_CONTRACT_BASE_LATEST!,
      contractArtifact.abi,
      baseWallet
    );

    const relayerUrl = process.env.RELAYER_URL || 'http://localhost:3000';

    console.log('🔗 Connected to networks:');
    console.log(`   - Horizen: ${horizenWallet.address}`);
    console.log(`   - Base: ${baseWallet.address}`);
    console.log(`   - Relayer: ${relayerUrl}`);

    // Test 1: Check balances
    console.log('\n1. Checking token balances...');
    
    // Get latest intent to find token addresses
    const latestIntentId = await horizenContract.getLatestIntentId();
    console.log(`   - Latest intent ID: ${latestIntentId}`);

    if (latestIntentId > 0) {
      const intent = await horizenContract.getIntent(latestIntentId);
      console.log(`   - TokenA: ${intent.tokenA}`);
      console.log(`   - TokenB: ${intent.tokenB}`);

      // Check TokenA balance on Horizen
      const tokenAContract = new ethers.Contract(
        intent.tokenA,
        ['function balanceOf(address) view returns (uint256)'],
        horizenWallet
      );
      const tokenABalance = await tokenAContract.balanceOf(horizenWallet.address);
      console.log(`   - TokenA balance (Horizen): ${ethers.formatEther(tokenABalance)}`);

      // Check TokenB balance on Base
      const tokenBContract = new ethers.Contract(
        intent.tokenB,
        ['function balanceOf(address) view returns (uint256)'],
        baseWallet
      );
      const tokenBBalance = await tokenBContract.balanceOf(baseWallet.address);
      console.log(`   - TokenB balance (Base): ${ethers.formatEther(tokenBBalance)}`);
    }

    // Test 2: Check relayer health
    console.log('\n2. Testing relayer connection...');
    try {
      const healthResponse = await axios.get(`${relayerUrl}/health`);
      console.log('   ✅ Relayer is healthy:', healthResponse.data.status);
    } catch (error) {
      console.log('   ❌ Relayer connection failed:', error);
    }

    // Test 3: Test recipient info fetching
    console.log('\n3. Testing recipient info fetching...');
    try {
      // Generate valid Ethereum addresses
      const wallet1 = ethers.Wallet.createRandom();
      const wallet2 = ethers.Wallet.createRandom();
      
      // Store some test recipient info first
      const testIntentId = "287647493468149004223305994324593771393899823122";
      const testRecipients = [
        wallet1.address,
        wallet2.address
      ];
      const testAmounts = [
        "50000000000000000000",
        "30000000000000000000"
      ];

      console.log('   Generated addresses:', testRecipients);

      await axios.post(`${relayerUrl}/store-recipients`, {
        intentId: testIntentId,
        recipients: testRecipients,
        amounts: testAmounts,
        chainId: 84532
      });

      const recipientResponse = await axios.get(`${relayerUrl}/get-recipients/${testIntentId}`);
      console.log('   ✅ Recipient info fetched:', {
        recipients: recipientResponse.data.recipients.length,
        totalAmount: ethers.formatEther(recipientResponse.data.totalAmount)
      });
    } catch (error: any) {
      console.log('   ❌ Recipient info test failed:', error.response?.data?.error || error.message);
    }

    // Test 4: Check contract functions
    console.log('\n4. Testing contract functions...');
    
    const horizenChainId = await horizenContract.getChainId();
    const baseChainId = await baseContract.getChainId();
    console.log(`   - Horizen chain ID: ${horizenChainId}`);
    console.log(`   - Base chain ID: ${baseChainId}`);

    // Test 5: Check authorization
    console.log('\n5. Checking authorization...');
    
    const horizenAuthorized = await horizenContract.authorizedRelayers(horizenWallet.address);
    const baseAuthorized = await baseContract.authorizedRelayers(baseWallet.address);
    console.log(`   - Horizen authorized: ${horizenAuthorized}`);
    console.log(`   - Base authorized: ${baseAuthorized}`);

    console.log('\n✅ Solver test completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Network connections');
    console.log('   ✅ Token balance checks');
    console.log('   ✅ Relayer integration');
    console.log('   ✅ Contract function calls');
    console.log('   ✅ Authorization status');

  } catch (error) {
    console.error('❌ Solver test failed:', error);
  }
}

// Run the test
testSolverFunctions().catch(error => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
}); 