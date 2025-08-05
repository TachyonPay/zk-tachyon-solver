import { ethers } from "hardhat";

async function main() {
  console.log("🌉 Cross-Chain Bridge Demo with Settlement\n");

  // Get signers
  const [owner, user, solver, relayer] = await ethers.getSigners();

  console.log("👥 Participants:");
  console.log("- Owner:", await owner.getAddress());
  console.log("- User (wants to bridge):", await user.getAddress());
  console.log("- Solver (provides liquidity):", await solver.getAddress());
  console.log("- Relayer (verifies & settles):", await relayer.getAddress());
  console.log();

  // Deploy contracts for demo
  console.log("📦 Deploying demo contracts...");
  
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const tokenA = await MockERC20.deploy("Token A", "TKNA", ethers.parseEther("1000000"));
  const tokenB = await MockERC20.deploy("Token B", "TKNB", ethers.parseEther("1000000"));

  const BridgeIntent = await ethers.getContractFactory("BridgeIntent");
  const bridge = await BridgeIntent.deploy();

  console.log("✅ Contracts deployed!");
  console.log("- TokenA:", await tokenA.getAddress());
  console.log("- TokenB:", await tokenB.getAddress());
  console.log("- Bridge:", await bridge.getAddress());
  console.log();

  // Setup - distribute tokens and add relayer
  await tokenA.transfer(await user.getAddress(), ethers.parseEther("1000"));
  await tokenA.transfer(await solver.getAddress(), ethers.parseEther("1000")); // Solver needs tokenA to bid/deposit
  await bridge.addRelayer(await relayer.getAddress());

  const AMOUNT_A = ethers.parseEther("100");
  const EXPECTED_AMOUNT_B = ethers.parseEther("95");
  const REWARD = ethers.parseEther("5");
  const SOLVER_BID = ethers.parseEther("98"); // Solver bids in tokenA (how much they're willing to accept)

  console.log("🎯 Bridge Parameters:");
  console.log("- Amount to bridge:", ethers.formatEther(AMOUNT_A), "TokenA");
  console.log("- Expected on destination:", ethers.formatEther(EXPECTED_AMOUNT_B), "TokenB");
  console.log("- Reward for solver:", ethers.formatEther(REWARD), "TokenA");
  console.log("- Solver bid (tokenA willing to accept):", ethers.formatEther(SOLVER_BID), "TokenA");
  console.log();

  // Step 1: User creates intent
  console.log("🚀 Step 1: User creates bridging intent");
  await tokenA.connect(user).approve(await bridge.getAddress(), AMOUNT_A + REWARD);
  await bridge.connect(user).createIntent(
    await tokenA.getAddress(),
    await tokenB.getAddress(),
    AMOUNT_A,
    EXPECTED_AMOUNT_B,
    REWARD,
    3600 // 1 hour
  );
  console.log("✅ Intent created with ID: 1");
  console.log();

  // Step 2: Solver bids
  console.log("🏁 Step 2: Solver places bid");
  await bridge.connect(solver).placeBid(1, SOLVER_BID);
  console.log("✅ Solver bid:", ethers.formatEther(SOLVER_BID), "TokenA (amount willing to accept)");
  console.log();

  // Step 3: Finalize auction (simulate time passing)
  console.log("⏰ Step 3: Finalizing auction");
  await ethers.provider.send("evm_increaseTime", [3601]); // Fast forward 1 hour + 1 second
  await ethers.provider.send("evm_mine", []);
  
  await bridge.finalizeAuction(1);
  console.log("✅ Auction finalized - Solver won!");
  console.log();

  // Step 4: Solver deposits and picks up
  console.log("💰 Step 4: Solver deposits tokens and picks up intent");
  await tokenA.connect(solver).approve(await bridge.getAddress(), SOLVER_BID);
  await bridge.connect(solver).depositAndPickup(1);
  console.log("✅ Solver deposited", ethers.formatEther(SOLVER_BID), "TokenA (as collateral)");
  console.log();

  // Check balances before settlement
  const solverTokenABefore = await tokenA.balanceOf(await solver.getAddress());

  console.log("📊 Solver balance before settlement:");
  console.log("- TokenA:", ethers.formatEther(solverTokenABefore));
  console.log();

  // Step 5: Simulate solver completing bridge on destination chain
  console.log("🌐 Step 5: Solver completes bridge on destination chain");
  console.log("(In reality, solver provides", ethers.formatEther(EXPECTED_AMOUNT_B), "TokenB to recipients on Chain 2)");
  console.log("✅ Recipients on Chain 2 receive their TokenB");
  console.log();

  // Step 6: Relayer settles on source chain
  console.log("⚖️  Step 6: Relayer settles intent on source chain");
  console.log("This transfers ALL tokenA to solver:");
  console.log("- User's original amount:", ethers.formatEther(AMOUNT_A), "TokenA");
  console.log("- User's reward:", ethers.formatEther(REWARD), "TokenA");
  console.log("- Solver's deposit back:", ethers.formatEther(SOLVER_BID), "TokenA");
  
  const settleTx = await bridge.connect(relayer).settleIntent(1);
  const receipt = await settleTx.wait();
  
  console.log("✅ Intent settled! Transaction hash:", receipt?.hash);
  console.log();

  // Check final balances
  const solverTokenAAfter = await tokenA.balanceOf(await solver.getAddress());

  console.log("📊 Solver balance after settlement:");
  console.log("- TokenA:", ethers.formatEther(solverTokenAAfter), "(+" + ethers.formatEther(solverTokenAAfter - solverTokenABefore) + ")");
  console.log();

  console.log("💡 Settlement Summary:");
  console.log("Solver received total:", ethers.formatEther(solverTokenAAfter - solverTokenABefore), "TokenA");
  console.log("Breakdown:");
  console.log("- User's original amount:", ethers.formatEther(AMOUNT_A), "TokenA");
  console.log("- User's reward:", ethers.formatEther(REWARD), "TokenA");
  console.log("- Their deposit back:", ethers.formatEther(SOLVER_BID), "TokenA");
  console.log();

  console.log("🎉 Cross-chain bridge completed successfully!");
  console.log("💰 Solver profit:", ethers.formatEther(AMOUNT_A + REWARD), "TokenA for providing", ethers.formatEther(EXPECTED_AMOUNT_B), "TokenB on destination chain");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Demo failed:", error);
    process.exit(1);
  }); 