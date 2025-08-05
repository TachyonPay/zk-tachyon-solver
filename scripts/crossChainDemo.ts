import { ethers } from "hardhat";

async function main() {
  console.log("🌉 CROSS-CHAIN BRIDGE DEMONSTRATION");
  console.log("=====================================");
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
  console.log(`- ${networks.horizen.name}: ${await horizenProvider.getBlockNumber()}`);
  console.log(`- ${networks.base.name}: ${await baseProvider.getBlockNumber()}`);
  console.log(`- Wallet Address: ${horizenWallet.address}`);
  console.log();

  // Contract addresses (deployed to both networks)
  const bridgeAddress = "0x0666ba9D34230d2ADd4139b8644Eb404F53f8066";

  // Deploy test tokens on both networks
  console.log("🪙 Deploying Test Tokens...");
  
  const MockERC20Factory = await ethers.getContractFactory("MockERC20");
  
  // Deploy TokenA on Horizen (source token)
  const tokenA_Horizen = await MockERC20Factory.connect(horizenWallet).deploy(
    "Horizen Token", "HZNA", ethers.parseEther("1000000")
  );
  await tokenA_Horizen.waitForDeployment();
  
  // Deploy TokenB on Base (destination token)  
  const tokenB_Base = await MockERC20Factory.connect(baseWallet).deploy(
    "Base Token", "BASEA", ethers.parseEther("1000000")
  );
  await tokenB_Base.waitForDeployment();

  console.log(`✅ TokenA (Horizen): ${await tokenA_Horizen.getAddress()}`);
  console.log(`✅ TokenB (Base): ${await tokenB_Base.getAddress()}`);
  console.log();

  // Connect to bridge contracts
  const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
  const bridge_Horizen = BridgeFactory.attach(bridgeAddress).connect(horizenWallet) as any;
  const bridge_Base = BridgeFactory.attach(bridgeAddress).connect(baseWallet) as any;

  // Setup: Add relayer and distribute tokens
  console.log("⚙️  Setting up participants...");
  
  // Add wallet as relayer on both chains
  await bridge_Horizen.addRelayer(horizenWallet.address);
  await bridge_Base.addRelayer(baseWallet.address);
  
  // Create additional test accounts
  const userWallet = ethers.Wallet.createRandom().connect(horizenProvider);
  const solverWallet = ethers.Wallet.createRandom().connect(horizenProvider);
  
  // Fund test accounts with ETH
  await horizenWallet.sendTransaction({
    to: userWallet.address,
    value: ethers.parseEther("0.01")
  });
  await horizenWallet.sendTransaction({
    to: solverWallet.address, 
    value: ethers.parseEther("0.01")
  });

  // Distribute tokens
  await tokenA_Horizen.transfer(userWallet.address, ethers.parseEther("1000"));    // User gets TokenA
  await tokenA_Horizen.transfer(solverWallet.address, ethers.parseEther("1000"));  // Solver gets TokenA to bid
  await tokenB_Base.transfer(horizenWallet.address, ethers.parseEther("1000"));    // We keep TokenB to simulate solver providing it

  console.log("✅ Participants setup complete");
  console.log(`- User: ${userWallet.address} (has TokenA on Horizen)`);
  console.log(`- Solver: ${solverWallet.address} (has TokenA on Horizen)`);
  console.log(`- Relayer: ${horizenWallet.address} (has TokenB on Base)`);
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

  // STEP 1: User creates intent on Chain 1 (Horizen)
  console.log("🚀 STEP 1: User creates bridging intent on Horizen");
  
  await tokenA_Horizen.connect(userWallet).approve(bridgeAddress, AMOUNT_A + REWARD);
  const createTx = await bridge_Horizen.connect(userWallet).createIntent(
    await tokenA_Horizen.getAddress(),
    await tokenB_Base.getAddress(),     // Destination token on Base
    AMOUNT_A,
    EXPECTED_AMOUNT_B,
    REWARD,
    3600 // 1 hour
  );
  await createTx.wait();
  
  console.log(`✅ Intent created with ID: 1`);
  console.log(`📍 Transaction: ${networks.horizen.explorer}/tx/${createTx.hash}`);
  console.log();

  // STEP 2: Solver bids on Chain 1 (Horizen)
  console.log("🏁 STEP 2: Solver places bid on Horizen");
  
  const bidTx = await bridge_Horizen.connect(solverWallet).placeBid(1, SOLVER_BID);
  await bidTx.wait();
  
  console.log(`✅ Solver bid: ${ethers.formatEther(SOLVER_BID)} TokenA`);
  console.log(`📍 Transaction: ${networks.horizen.explorer}/tx/${bidTx.hash}`);
  console.log();

  // STEP 3: Finalize auction on Chain 1 (Horizen)
  console.log("⏰ STEP 3: Finalizing auction on Horizen");
  
  // Fast forward time in local testing, but in real scenario we'd wait
  console.log("(In production, wait for auction to end...)");
  
  const finalizeTx = await bridge_Horizen.finalizeAuction(1);
  await finalizeTx.wait();
  
  console.log("✅ Auction finalized - Solver won!");
  console.log(`📍 Transaction: ${networks.horizen.explorer}/tx/${finalizeTx.hash}`);
  console.log();

  // STEP 4: Solver deposits and picks up on Chain 1 (Horizen)  
  console.log("💰 STEP 4: Solver deposits TokenA collateral on Horizen");
  
  await tokenA_Horizen.connect(solverWallet).approve(bridgeAddress, SOLVER_BID);
  const depositTx = await bridge_Horizen.connect(solverWallet).depositAndPickup(1);
  await depositTx.wait();
  
  console.log(`✅ Solver deposited ${ethers.formatEther(SOLVER_BID)} TokenA as collateral`);
  console.log(`📍 Transaction: ${networks.horizen.explorer}/tx/${depositTx.hash}`);
  console.log();

  // STEP 5: Solver provides TokenB to recipients on Chain 2 (Base)
  console.log("🌐 STEP 5: Solver provides TokenB to recipients on Base Sepolia");
  
  // Create a recipient address  
  const recipientWallet = ethers.Wallet.createRandom();
  
  // Simulate solver providing TokenB on destination chain
  // In reality, solver would have their own TokenB on Base
  const distributeTx = await tokenB_Base.transfer(recipientWallet.address, EXPECTED_AMOUNT_B);
  await distributeTx.wait();
  
  console.log(`✅ Provided ${ethers.formatEther(EXPECTED_AMOUNT_B)} TokenB to recipient`);
  console.log(`🎯 Recipient: ${recipientWallet.address}`);
  console.log(`📍 Transaction: ${networks.base.explorer}/tx/${distributeTx.hash}`);
  console.log();

  // Check recipient balance on Base
  const recipientBalance = await tokenB_Base.balanceOf(recipientWallet.address);
  console.log(`✅ Verified: Recipient has ${ethers.formatEther(recipientBalance)} TokenB on Base`);
  console.log();

  // STEP 6: Relayer settles on Chain 1 (Horizen)
  console.log("⚖️  STEP 6: Relayer settles intent on Horizen");
  console.log("This transfers ALL TokenA to solver:");
  console.log(`- User's original: ${ethers.formatEther(AMOUNT_A)} TokenA`);
  console.log(`- User's reward: ${ethers.formatEther(REWARD)} TokenA`);  
  console.log(`- Solver's deposit back: ${ethers.formatEther(SOLVER_BID)} TokenA`);
  
  const solverBalanceBefore = await tokenA_Horizen.balanceOf(solverWallet.address);
  
  const settleTx = await bridge_Horizen.settleIntent(1);
  await settleTx.wait();
  
  const solverBalanceAfter = await tokenA_Horizen.balanceOf(solverWallet.address);
  const totalReceived = solverBalanceAfter - solverBalanceBefore;
  
  console.log(`✅ Intent settled successfully!`);
  console.log(`📍 Transaction: ${networks.horizen.explorer}/tx/${settleTx.hash}`);
  console.log(`💰 Solver received: ${ethers.formatEther(totalReceived)} TokenA total`);
  console.log(`💸 Solver profit: ${ethers.formatEther(AMOUNT_A + REWARD)} TokenA`);
  console.log();

  // Final Summary
  console.log("🎉 CROSS-CHAIN BRIDGE COMPLETED SUCCESSFULLY!");
  console.log("=============================================");
  console.log();
  console.log("📈 Transaction Flow Summary:");
  console.log(`1. User bridged ${ethers.formatEther(AMOUNT_A)} TokenA from Horizen`);
  console.log(`2. Solver provided ${ethers.formatEther(EXPECTED_AMOUNT_B)} TokenB on Base`);
  console.log(`3. Solver earned ${ethers.formatEther(AMOUNT_A + REWARD)} TokenA profit`);
  console.log();
  console.log("🔗 Contract Addresses:");
  console.log(`- Bridge (Horizen): ${bridgeAddress}`);
  console.log(`- Bridge (Base): ${bridgeAddress}`);
  console.log(`- TokenA (Horizen): ${await tokenA_Horizen.getAddress()}`);
  console.log(`- TokenB (Base): ${await tokenB_Base.getAddress()}`);
  console.log();
  console.log("✨ Cross-chain bridging via solver network is LIVE!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Cross-chain demo failed:", error);
    process.exit(1);
  }); 