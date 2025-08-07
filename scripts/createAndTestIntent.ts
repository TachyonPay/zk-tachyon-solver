import { ethers } from "hardhat";

async function createAndTestIntent() {
  console.log("🔧 CREATING AND TESTING FRESH INTENT WITH PROOF");
  console.log("===============================================");

  try {
    // Get network configurations
    const networks = {
      horizen: {
        name: "Horizen Testnet",
        rpcUrl: process.env.HORIZEN_TESTNET_RPC_URL!,
        chainId: 845320009,
        bridgeAddress: process.env.BRIDGE_CONTRACT_HORIZEN_LATEST!
      },
      base: {
        name: "Base Sepolia", 
        rpcUrl: process.env.BASE_SEPOLIA_RPC_URL!,
        chainId: 84532,
        bridgeAddress: process.env.BRIDGE_CONTRACT_BASE_LATEST!
      }
    };

    // Create providers
    const horizenProvider = new ethers.JsonRpcProvider(networks.horizen.rpcUrl);
    const baseProvider = new ethers.JsonRpcProvider(networks.base.rpcUrl);
    
    // Create wallet
    const privateKey = process.env.PRIVATE_KEY!;
    const wallet = new ethers.Wallet(privateKey);
    
    // Connect to contracts
    const BridgeFactory = await ethers.getContractFactory("BridgeIntent");
    const bridge_Horizen = BridgeFactory.attach(networks.horizen.bridgeAddress).connect(wallet.connect(horizenProvider)) as any;
    const bridge_Base = BridgeFactory.attach(networks.base.bridgeAddress).connect(wallet.connect(baseProvider)) as any;

    console.log("🔗 Network Status:");
    console.log(`- ${networks.horizen.name}: Block ${await horizenProvider.getBlockNumber()}`);
    console.log(`- ${networks.base.name}: Block ${await baseProvider.getBlockNumber()}`);
    console.log();

    // Deploy test tokens
    console.log("🪙 Deploying Test Tokens...");
    
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    
    // Get current nonces
    let horizenNonce = await horizenProvider.getTransactionCount(wallet.address);
    let baseNonce = await baseProvider.getTransactionCount(wallet.address);
    
    console.log(`- Horizen nonce: ${horizenNonce}`);
    console.log(`- Base nonce: ${baseNonce}`);
    
    // Deploy TokenA on Horizen (source token)
    console.log("Deploying TokenA on Horizen...");
    const tokenA_Horizen = await MockERC20Factory.connect(wallet.connect(horizenProvider)).deploy(
      "Horizen Token", "HZNA", ethers.parseEther("1000000"),
      { nonce: horizenNonce++ }
    );
    await tokenA_Horizen.waitForDeployment();
    
    // Deploy TokenB on Base (destination token)  
    console.log("Deploying TokenB on Base...");
    const tokenB_Base = await MockERC20Factory.connect(wallet.connect(baseProvider)).deploy(
      "Base Token", "BASEA", ethers.parseEther("1000000"),
      { nonce: baseNonce++ }
    );
    await tokenB_Base.waitForDeployment();

    console.log(`✅ TokenA (Horizen): ${await tokenA_Horizen.getAddress()}`);
    console.log(`✅ TokenB (Base): ${await tokenB_Base.getAddress()}`);
    console.log();

    // Setup: Add relayer
    console.log("⚙️  Setting up relayers...");
    
    console.log("Adding relayer on Horizen...");
    const addRelayerTx1 = await bridge_Horizen.addRelayer(wallet.address, { nonce: horizenNonce++ });
    await addRelayerTx1.wait();
    
    console.log("Adding relayer on Base...");
    const addRelayerTx2 = await bridge_Base.addRelayer(wallet.address, { nonce: baseNonce++ });
    await addRelayerTx2.wait();
    
    console.log("✅ Relayers added on both chains");
    console.log();

    // Bridge parameters
    const AMOUNT_A = ethers.parseEther("100");      // User wants to bridge 100 TokenA
    const EXPECTED_AMOUNT_B = ethers.parseEther("95"); // Expects 95 TokenB on destination
    const REWARD = ethers.parseEther("5");           // 5 TokenA reward for solver

    console.log("📊 Bridge Parameters:");
    console.log(`- User bridges: ${ethers.formatEther(AMOUNT_A)} TokenA`);
    console.log(`- Expects: ${ethers.formatEther(EXPECTED_AMOUNT_B)} TokenB on destination`);
    console.log(`- Reward: ${ethers.formatEther(REWARD)} TokenA`);
    console.log();

    // Step 1: Create a new intent on Horizen
    console.log("📝 STEP 1: Creating new intent on Horizen...");
    const currentIntentId = await bridge_Horizen.getLatestIntentId();
    console.log(`Current latest intent ID: ${currentIntentId}`);
    
    const targetIntentId = currentIntentId + 1n;
    console.log(`Target intent ID: ${targetIntentId}`);
    
    // Approve tokens for bridge
    const approveTx = await tokenA_Horizen.approve(networks.horizen.bridgeAddress, AMOUNT_A + REWARD, { nonce: horizenNonce++ });
    await approveTx.wait();
    console.log("✅ Approved tokens");
    
    const auctionDuration = 60; // 60 seconds
    console.log(`⏰ Auction duration: ${auctionDuration} seconds`);
    
    const createTx = await bridge_Horizen.createIntent(
      await tokenA_Horizen.getAddress(),
      await tokenB_Base.getAddress(),
      AMOUNT_A,
      EXPECTED_AMOUNT_B,
      REWARD,
      auctionDuration,
      { nonce: horizenNonce++ }
    );
    await createTx.wait();
    console.log(`✅ Intent created with ID: ${targetIntentId}`);
    console.log(`Transaction: ${createTx.hash}`);
    console.log();

    // Step 2: Solve intent on Base (destination chain)
    console.log("🔧 STEP 2: Solving intent on Base...");
    const localIntentId = await bridge_Horizen.getLocalIntentId(targetIntentId);
    console.log(`Local intent ID for Base: ${localIntentId}`);
    
    // Check solver balance (deployer gets initial supply)
    const solverBalance = await tokenB_Base.balanceOf(wallet.address);
    console.log(`Solver TokenB balance: ${ethers.formatEther(solverBalance)}`);
    
    // Approve tokens for bridge
    const approveTokenBTx = await tokenB_Base.approve(networks.base.bridgeAddress, EXPECTED_AMOUNT_B, { nonce: baseNonce++ });
    await approveTokenBTx.wait();
    console.log("✅ Approved TokenB for bridge contract");
    
    // Create a recipient address  
    const recipientWallet = ethers.Wallet.createRandom();
    console.log(`🎯 Recipient: ${recipientWallet.address}`);
    
    // Check if intent is already solved
    const isAlreadySolved = await bridge_Base.isIntentSolvedOnChain2(localIntentId);
    console.log(`Intent ${localIntentId} already solved: ${isAlreadySolved}`);
    
    if (!isAlreadySolved) {
      // Solve intent on Base
      console.log("Calling solveIntentOnChain2...");
      const solveTx = await bridge_Base.solveIntentOnChain2(
        localIntentId,
        wallet.address, // User from chain1
        await tokenB_Base.getAddress(), // TokenB on Base
        EXPECTED_AMOUNT_B,
        [recipientWallet.address], // Recipients array
        [EXPECTED_AMOUNT_B], // Amounts array
        { nonce: baseNonce++ }
      );
      await solveTx.wait();
      console.log(`✅ Intent solved on Base with local ID: ${localIntentId}`);
      console.log(`Transaction: ${solveTx.hash}`);
    } else {
      console.log("⚠️  Intent already solved, skipping...");
    }
    console.log();

    // Step 3: Verify intent is solved
    console.log("🔍 STEP 3: Verifying intent is solved...");
    const isSolved = await bridge_Base.isIntentSolvedOnChain2(localIntentId);
    console.log(`Intent ${localIntentId} solved on Base: ${isSolved}`);
    console.log();

    // Step 4: Test settle-with-proof using the relayer
    console.log("🔐 STEP 4: Testing settle-with-proof with sample proof...");
    console.log("Now you can run: npx ts-node scripts/testSampleProof.ts");
    console.log(`Use intent ID: ${targetIntentId}`);
    console.log(`Use chain2 intent ID: ${localIntentId}`);
    console.log();

    console.log("📋 SUMMARY:");
    console.log(`- Intent ID (Horizen): ${targetIntentId}`);
    console.log(`- Chain2 Intent ID (Base): ${localIntentId}`);
    console.log(`- Intent solved on Base: ${isSolved}`);
    console.log(`- Ready for settle-with-proof test`);

  } catch (error) {
    console.error("❌ Failed to create and test intent:", error);
    process.exit(1);
  }
}

createAndTestIntent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Create and test intent failed:", error);
    process.exit(1);
  }); 