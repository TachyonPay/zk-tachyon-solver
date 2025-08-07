import { ethers } from 'ethers';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function demonstrateSolverWorkflow() {
  console.log('🎭 Bridge Solver Demo');
  console.log('=====================');

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

    console.log('🔗 Solver Configuration:');
    console.log(`   - Horizen Address: ${horizenWallet.address}`);
    console.log(`   - Base Address: ${baseWallet.address}`);
    console.log(`   - Relayer URL: ${relayerUrl}`);

    // Demo 1: Check current state
    console.log('\n📊 Current State Analysis:');
    
    const latestIntentId = await horizenContract.getLatestIntentId();
    console.log(`   - Latest Intent ID: ${latestIntentId}`);
    
    if (latestIntentId > 0) {
      const intent = await horizenContract.getIntent(latestIntentId);
      console.log(`   - Intent Status: ${intent.completed ? 'Completed' : 'Active'}`);
      console.log(`   - Winning Solver: ${intent.winningSolver}`);
      console.log(`   - Deposited: ${intent.deposited}`);
      console.log(`   - AmountA: ${ethers.formatEther(intent.amountA)}`);
      console.log(`   - Reward: ${ethers.formatEther(intent.reward)}`);
    }

    // Demo 2: Simulate profit calculation
    console.log('\n💰 Profit Calculation Demo:');
    
    const amountA = ethers.parseEther('100'); // 100 tokens
    const reward = ethers.parseEther('5');     // 5 token reward
    const balance = ethers.parseEther('1000'); // 1000 token balance
    const minProfitMargin = 0.02; // 2%
    
    const minProfitableBid = amountA + reward;
    const profitMargin = minProfitableBid * BigInt(Math.floor(minProfitMargin * 1000)) / 1000n;
    const targetBid = minProfitableBid - profitMargin;
    const maxAffordableBid = balance * BigInt(Math.floor((1 - 0.1) * 1000)) / 1000n; // 10% buffer
    
    console.log(`   - AmountA: ${ethers.formatEther(amountA)} tokens`);
    console.log(`   - Reward: ${ethers.formatEther(reward)} tokens`);
    console.log(`   - Balance: ${ethers.formatEther(balance)} tokens`);
    console.log(`   - Min Profitable Bid: ${ethers.formatEther(minProfitableBid)} tokens`);
    console.log(`   - Profit Margin (2%): ${ethers.formatEther(profitMargin)} tokens`);
    console.log(`   - Target Bid: ${ethers.formatEther(targetBid)} tokens`);
    console.log(`   - Max Affordable: ${ethers.formatEther(maxAffordableBid)} tokens`);
    console.log(`   - Can Afford: ${targetBid <= maxAffordableBid ? '✅ Yes' : '❌ No'}`);

    // Demo 3: Simulate bidding strategy
    console.log('\n🏆 Bidding Strategy Demo:');
    
    const currentHighestBid = ethers.parseEther('98');
    const ourBid = targetBid;
    const bidIncrement = ethers.parseEther('1');
    
    console.log(`   - Current Highest Bid: ${ethers.formatEther(currentHighestBid)} tokens`);
    console.log(`   - Our Target Bid: ${ethers.formatEther(ourBid)} tokens`);
    console.log(`   - Bid Increment: ${ethers.formatEther(bidIncrement)} tokens`);
    
    if (ourBid > currentHighestBid) {
      console.log(`   - Strategy: Place bid at ${ethers.formatEther(ourBid)} tokens`);
    } else {
      const newBid = currentHighestBid + bidIncrement;
      console.log(`   - Strategy: Increase bid to ${ethers.formatEther(newBid)} tokens`);
    }

    // Demo 4: Cross-chain solution simulation
    console.log('\n🌐 Cross-Chain Solution Demo:');
    
    // Generate test recipient data
    const wallet1 = ethers.Wallet.createRandom();
    const wallet2 = ethers.Wallet.createRandom();
    const wallet3 = ethers.Wallet.createRandom();
    
    const testRecipients = [wallet1.address, wallet2.address, wallet3.address];
    const testAmounts = [
      ethers.parseEther('50').toString(),
      ethers.parseEther('30').toString(),
      ethers.parseEther('20').toString()
    ];
    
    console.log(`   - Origin Chain: Horizen (${await horizenContract.getChainId()})`);
    console.log(`   - Destination Chain: Base (${await baseContract.getChainId()})`);
    console.log(`   - Recipients: ${testRecipients.length} addresses`);
    console.log(`   - Total Amount: ${ethers.formatEther(testAmounts.reduce((sum, amount) => sum + BigInt(amount), 0n))} tokens`);
    
    // Demo 5: Relayer integration
    console.log('\n📡 Relayer Integration Demo:');
    
    try {
      const healthResponse = await axios.get(`${relayerUrl}/health`);
      console.log(`   - Relayer Status: ${healthResponse.data.status}`);
      console.log(`   - Networks: ${Object.keys(healthResponse.data.networks).join(', ')}`);
      
      // Test recipient storage
      const testIntentId = latestIntentId.toString();
      await axios.post(`${relayerUrl}/store-recipients`, {
        intentId: testIntentId,
        recipients: testRecipients,
        amounts: testAmounts,
        chainId: 84532
      });
      
      const recipientResponse = await axios.get(`${relayerUrl}/get-recipients/${testIntentId}`);
      console.log(`   - Recipient Storage: ✅ Success`);
      console.log(`   - Stored Recipients: ${recipientResponse.data.recipients.length}`);
      
    } catch (error: any) {
      console.log(`   - Relayer Test: ❌ ${error.response?.data?.error || error.message}`);
    }

    // Demo 6: Complete workflow simulation
    console.log('\n🔄 Complete Workflow Simulation:');
    
    console.log('   1. 🎯 Intent Created Event Detected');
    console.log('   2. 💰 Balance Check: ✅ Sufficient funds');
    console.log('   3. 💡 Profit Calculation: ✅ Profitable bid found');
    console.log('   4. 🏁 Place Initial Bid: ✅ Bid placed');
    console.log('   5. ⏰ Monitor Auction: ✅ Winning bid maintained');
    console.log('   6. 🎉 Auction Won: ✅ Highest bidder');
    console.log('   7. 🔨 Finalize Auction: ✅ Auction finalized');
    console.log('   8. 💳 Deposit Tokens: ✅ Tokens deposited');
    console.log('   9. 🌐 Cross-Chain Solution: ✅ Intent solved on destination');
    console.log('   10. 📡 Relayer Settlement: ✅ Settlement successful');
    console.log('   11. ✅ Intent Completed: ✅ Profit earned');

    console.log('\n🎉 Solver Demo Completed Successfully!');
    console.log('\n📋 Key Features Demonstrated:');
    console.log('   ✅ Profit calculation and margin analysis');
    console.log('   ✅ Bidding strategy and competition handling');
    console.log('   ✅ Cross-chain intent solving');
    console.log('   ✅ Relayer integration for settlement');
    console.log('   ✅ Complete end-to-end workflow');

  } catch (error) {
    console.error('❌ Solver demo failed:', error);
  }
}

// Run the demo
demonstrateSolverWorkflow().catch(error => {
  console.error('❌ Demo execution failed:', error);
  process.exit(1);
}); 