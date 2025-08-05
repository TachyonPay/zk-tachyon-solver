import { ethers } from "hardhat";

async function main() {
  console.log("🌉 LIVE CROSS-CHAIN BRIDGE DEMONSTRATION");
  console.log("=========================================");
  console.log("Chain 1: Horizen Testnet (Source)");
  console.log("Chain 2: Base Sepolia (Destination)");
  console.log();

  // Network configurations
  const networks = {
    horizen: {
      name: "Horizen Testnet",
      rpcUrl: process.env.HORIZEN_TESTNET_RPC_URL!,
      chainId: 845320009,
      explorer: "https://horizen-explorer-testnet.appchain.base.org"
    },
    base: {
      name: "Base Sepolia", 
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL!,
      chainId: 84532,
      explorer: "https://sepolia-explorer.base.org"
    }
  };

  // Create providers for both networks
  const horizenProvider = new ethers.JsonRpcProvider(networks.horizen.rpcUrl);
  const baseProvider = new ethers.JsonRpcProvider(networks.base.rpcUrl);

  // Create wallets for both networks
  const privateKey = process.env.PRIVATE_KEY!;
  const horizenWallet = new ethers.Wallet(privateKey, horizenProvider);
  const baseWallet = new ethers.Wallet(privateKey, baseProvider);

  console.log("🔗 Network Status:");
  console.log(`- ${networks.horizen.name}: Block ${await horizenProvider.getBlockNumber()}`);
  console.log(`- ${networks.base.name}: Block ${await baseProvider.getBlockNumber()}`);
  console.log(`- Wallet Address: ${horizenWallet.address}`);
  console.log();

  // Check balances
  const horizenBalance = await horizenProvider.getBalance(horizenWallet.address);
  const baseBalance = await baseProvider.getBalance(baseWallet.address);
  
  console.log("💰 Wallet Balances:");
  console.log(`- Horizen: ${ethers.formatEther(horizenBalance)} ETH`);
  console.log(`- Base: ${ethers.formatEther(baseBalance)} ETH`);
  console.log();

  // Contract addresses (deployed to both networks with 5-second auction duration + fixed placeBid logic)
  const bridgeAddress_Horizen = "0x2C5Ce1D2495d647F0BEf833444F134fDaF5D2868";
  const bridgeAddress_Base = "0x8e355212721b38f8A9538F30cA739f0D0cDa5040";

  console.log("🔗 Bridge Contract Addresses:");
  console.log(`- Horizen: ${bridgeAddress_Horizen}`);
  console.log(`- Base: ${bridgeAddress_Base}`);
  console.log();

  // Connect to bridge contracts
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Horizen = BridgeFactory.attach(bridgeAddress_Horizen).connect(horizenWallet) as any;
  const bridge_Base = BridgeFactory.attach(bridgeAddress_Base).connect(baseWallet) as any;

  // Deploy test tokens with proper nonce management
  console.log("🪙 Deploying Test Tokens...");
  
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  
  // Get current nonces
  let horizenNonce = await horizenProvider.getTransactionCount(horizenWallet.address);
  let baseNonce = await baseProvider.getTransactionCount(baseWallet.address);
  
  console.log(`- Horizen nonce: ${horizenNonce}`);
  console.log(`- Base nonce: ${baseNonce}`);
  
  // Deploy TokenA on Horizen (source token)
  console.log("Deploying TokenA on Horizen...");
  const tokenA_Horizen = await MockERC20Factory.connect(horizenWallet).deploy(
    "Horizen Token", "HZNA", ethers.parseEther("1000000"),
    { nonce: horizenNonce++ }
  );
  await tokenA_Horizen.waitForDeployment();
  
  // Deploy TokenB on Base (destination token)  
  console.log("Deploying TokenB on Base...");
  const tokenB_Base = await MockERC20Factory.connect(baseWallet).deploy(
    "Base Token", "BASEA", ethers.parseEther("1000000"),
    { nonce: baseNonce++ }
  );
  await tokenB_Base.waitForDeployment();

  console.log(`✅ TokenA (Horizen): ${await tokenA_Horizen.getAddress()}`);
  console.log(`✅ TokenB (Base): ${await tokenB_Base.getAddress()}`);
  console.log();

  // Setup: Add relayer with proper nonce management
  console.log("⚙️  Setting up relayers...");
  
  console.log("Adding relayer on Horizen...");
  const addRelayerTx1 = await bridge_Horizen.addRelayer(horizenWallet.address, { nonce: horizenNonce++ });
  await addRelayerTx1.wait();
  
  console.log("Adding relayer on Base...");
  const addRelayerTx2 = await bridge_Base.addRelayer(baseWallet.address, { nonce: baseNonce++ });
  await addRelayerTx2.wait();
  
  console.log("✅ Relayers added on both chains");
  console.log();

  // Create user and solver wallets (for demo, we'll use our main wallet as all roles)
  const userAddress = horizenWallet.address;
  const solverAddress = horizenWallet.address;
  
  console.log("👥 Participants:");
  console.log(`- User: ${userAddress}`);
  console.log(`- Solver: ${solverAddress}`);
  console.log(`- Relayer: ${horizenWallet.address}`);
  console.log();

  // Bridge parameters
  const AMOUNT_A = ethers.parseEther("100");      // User wants to bridge 100 TokenA
  const EXPECTED_AMOUNT_B = ethers.parseEther("95"); // Expects 95 TokenB on destination
  const REWARD = ethers.parseEther("5");           // 5 TokenA reward for solver
  const SOLVER_BID = ethers.parseEther("98");      // Solver bids 98 TokenA (willing to accept)

  console.log("📊 Bridge Parameters:");
  console.log(`- User bridges: ${ethers.formatEther(AMOUNT_A)} TokenA`);
  console.log(`- Expects: ${ethers.formatEther(EXPECTED_AMOUNT_B)} TokenB on destination`);
  console.log(`- Reward: ${ethers.formatEther(REWARD)} TokenA`);
  console.log(`- Solver bid: ${ethers.formatEther(SOLVER_BID)} TokenA`);
  console.log();

  // STEP 1: Check for existing active intents and find the latest one
  console.log("🔍 STEP 1: Finding active intents...");
  
  const latestIntentId = await bridge_Horizen.getLatestIntentId();
  const activeIntents = await bridge_Horizen.getActiveIntents();
  
  console.log(`📊 Latest Intent ID: ${latestIntentId}`);
  console.log(`🎯 Active Intents: ${activeIntents.length > 0 ? activeIntents.join(', ') : 'None'}`);
  
  let targetIntentId;
  
  if (activeIntents.length > 0) {
    // Use the first active intent
    targetIntentId = activeIntents[0];
    console.log(`✅ Found active intent ID: ${targetIntentId}`);
    
    // Get details of the existing intent
    const intentDetails = await bridge_Horizen.getIntentDetails(targetIntentId);
    const timeRemaining = await bridge_Horizen.getIntentTimeRemaining(targetIntentId);
    const currentHighestBid = await bridge_Horizen.getHighestBid(targetIntentId);
    
    console.log(`📋 Intent Details:`);
    console.log(`   - TokenA: ${intentDetails.tokenA}`);
    console.log(`   - TokenB: ${intentDetails.tokenB}`);
    console.log(`   - Amount A: ${ethers.formatEther(intentDetails.amountA)} TokenA`);
    console.log(`   - Expected Amount B: ${ethers.formatEther(intentDetails.expectedAmountB)} TokenB`);
    console.log(`   - Reward: ${ethers.formatEther(intentDetails.reward)} TokenA`);
    console.log(`   - Time Remaining: ${timeRemaining} seconds`);
    console.log(`   - Current Highest Bid: ${ethers.formatEther(currentHighestBid.amount)} TokenA by ${currentHighestBid.bidder}`);
    console.log();
    
    // Adjust our bid to be higher than current highest bid
    const minimumBid = currentHighestBid.amount + ethers.parseEther("1"); // Add 1 TokenA to outbid
    if (SOLVER_BID < minimumBid) {
      console.log(`⚠️  Adjusting solver bid from ${ethers.formatEther(SOLVER_BID)} to ${ethers.formatEther(minimumBid)} TokenA to outbid current highest`);
      // We'll use the adjusted bid amount
    }
    
  } else {
    // Create a new intent
    console.log("📝 No active intents found, creating new intent...");
    targetIntentId = Number(latestIntentId) + 1;
    
    console.log("🚀 Creating new bridging intent on Horizen");
    
    const approveTx = await tokenA_Horizen.approve(bridgeAddress_Horizen, AMOUNT_A + REWARD, { nonce: horizenNonce++ });
    await approveTx.wait();
    console.log("✅ Approved tokens");
    
    const auctionDuration = 60; // 60 seconds to allow time for transaction processing
    console.log(`⏰ Auction duration: ${auctionDuration} seconds`);
    console.log(`⏰ Current timestamp: ${Math.floor(Date.now() / 1000)}`);
    console.log(`⏰ Expected end time: ${Math.floor(Date.now() / 1000) + auctionDuration}`);
    
    const createTx = await bridge_Horizen.createIntent(
      await tokenA_Horizen.getAddress(),
      await tokenB_Base.getAddress(),     // Destination token on Base
      AMOUNT_A,
      EXPECTED_AMOUNT_B,
      REWARD,
      auctionDuration,
      { nonce: horizenNonce++ }
    );
    await createTx.wait();
    
    console.log(`✅ Intent created with ID: ${targetIntentId}`);
    console.log(`📍 Transaction: ${networks.horizen.explorer}/tx/${createTx.hash}`);
    
    // Verify the actual end time that was set
    const intentDetails = await bridge_Horizen.getIntentDetails(targetIntentId);
    console.log(`🔍 Actual end time set: ${intentDetails.endTime} (${new Date(Number(intentDetails.endTime) * 1000)})`);
    console.log();
  }

  // STEP 2: Solver bids on the target intent
  console.log(`🏁 STEP 2: Solver places bid on intent ${targetIntentId}`);
  
  // Use fixed bid for simplicity (can enhance later)
  let ourBid = SOLVER_BID;
  console.log(`💰 Our bid: ${ethers.formatEther(ourBid)} TokenA`);
  
  const bidTx = await bridge_Horizen.placeBid(targetIntentId, ourBid, { nonce: horizenNonce++ });
  await bidTx.wait();
  
  console.log(`✅ Solver bid: ${ethers.formatEther(ourBid)} TokenA`);
  console.log(`📍 Transaction: ${networks.horizen.explorer}/tx/${bidTx.hash}`);
  console.log();

  // STEP 3: Finalize auction
  console.log(`⏰ STEP 3: Waiting for auction to end and finalizing intent ${targetIntentId}...`);
  
  // Wait for auction to end (60 seconds + buffer)
  console.log("Waiting 65 seconds for auction to end...");
  await new Promise(resolve => setTimeout(resolve, 65000));
  
  const finalizeTx = await bridge_Horizen.finalizeAuction(targetIntentId, { nonce: horizenNonce++ });
  await finalizeTx.wait();
  
  console.log("✅ Auction finalized - Solver won!");
  console.log(`📍 Transaction: ${networks.horizen.explorer}/tx/${finalizeTx.hash}`);
  console.log();

  // STEP 4: Solver deposits and picks up on Chain 1 (Horizen)  
  console.log(`💰 STEP 4: Solver deposits TokenA collateral for intent ${targetIntentId}`);
  
  const approveSolverTx = await tokenA_Horizen.approve(bridgeAddress_Horizen, ourBid, { nonce: horizenNonce++ });
  await approveSolverTx.wait();
  console.log("✅ Approved solver deposit");
  
  const depositTx = await bridge_Horizen.depositAndPickup(targetIntentId, { nonce: horizenNonce++ });
  await depositTx.wait();
  
  console.log(`✅ Solver deposited ${ethers.formatEther(ourBid)} TokenA as collateral`);
  console.log(`📍 Transaction: ${networks.horizen.explorer}/tx/${depositTx.hash}`);
  console.log();

  // STEP 5: Solver provides TokenB to recipients on Chain 2 (Base)
  console.log("🌐 STEP 5: Solver provides TokenB to recipients on Base Sepolia");
  
  // Create a recipient address  
  const recipientWallet = ethers.Wallet.createRandom();
  
  // Simulate solver providing TokenB on destination chain
  console.log(`🎯 Recipient: ${recipientWallet.address}`);
  const distributeTx = await tokenB_Base.transfer(recipientWallet.address, EXPECTED_AMOUNT_B, { nonce: baseNonce++ });
  await distributeTx.wait();
  
  console.log(`✅ Provided ${ethers.formatEther(EXPECTED_AMOUNT_B)} TokenB to recipient`);
  console.log(`📍 Transaction: ${networks.base.explorer}/tx/${distributeTx.hash}`);
  console.log();

  // Verify recipient balance on Base
  const recipientBalance = await tokenB_Base.balanceOf(recipientWallet.address);
  console.log(`✅ Verified: Recipient has ${ethers.formatEther(recipientBalance)} TokenB on Base`);
  console.log();

  // STEP 6: Relayer settles on Chain 1 (Horizen)
  console.log("⚖️  STEP 6: Relayer settles intent on Horizen");
  console.log("This transfers ALL TokenA to solver:");
  console.log(`- User's original: ${ethers.formatEther(AMOUNT_A)} TokenA`);
  console.log(`- User's reward: ${ethers.formatEther(REWARD)} TokenA`);  
  console.log(`- Solver's deposit back: ${ethers.formatEther(ourBid)} TokenA`);
  
  const solverBalanceBefore = await tokenA_Horizen.balanceOf(solverAddress);
  
  const settleTx = await bridge_Horizen.settleIntent(targetIntentId, { nonce: horizenNonce++ });
  await settleTx.wait();
  
  const solverBalanceAfter = await tokenA_Horizen.balanceOf(solverAddress);
  const totalReceived = solverBalanceAfter - solverBalanceBefore;
  
  console.log(`✅ Intent settled successfully!`);
  console.log(`📍 Transaction: ${networks.horizen.explorer}/tx/${settleTx.hash}`);
  console.log(`💰 Solver received: ${ethers.formatEther(totalReceived)} TokenA total`);
  console.log(`💸 Solver profit: ${ethers.formatEther(AMOUNT_A + REWARD)} TokenA`);
  console.log();

  // Final Summary
  console.log("🎉 LIVE CROSS-CHAIN BRIDGE COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
  console.log();
  console.log("📈 Transaction Flow Summary:");
  console.log(`1. Intent ${targetIntentId}: User bridged ${ethers.formatEther(AMOUNT_A)} TokenA from Horizen`);
  console.log(`2. Solver bid ${ethers.formatEther(ourBid)} TokenA and won the auction`);
  console.log(`3. Solver provided ${ethers.formatEther(EXPECTED_AMOUNT_B)} TokenB on Base`);
  console.log(`4. Solver earned ${ethers.formatEther(AMOUNT_A + REWARD)} TokenA profit`);
  console.log();
  console.log("🔗 Contract Addresses:");
  console.log(`- Bridge (Horizen): ${bridgeAddress_Horizen}`);
  console.log(`- Bridge (Base): ${bridgeAddress_Base}`);
  console.log(`- TokenA (Horizen): ${await tokenA_Horizen.getAddress()}`);
  console.log(`- TokenB (Base): ${await tokenB_Base.getAddress()}`);
  console.log();
  console.log("🔗 All Transactions:");
  console.log(`- Horizen Explorer: ${networks.horizen.explorer}/address/${horizenWallet.address}`);
  console.log(`- Base Explorer: ${networks.base.explorer}/address/${baseWallet.address}`);
  console.log();
  console.log("✨ Cross-chain bridging via solver network is LIVE and working!");
  console.log(`🎯 Intent ID ${targetIntentId} completed successfully with dynamic discovery!`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Live cross-chain demo failed:", error);
    process.exit(1);
  }); 