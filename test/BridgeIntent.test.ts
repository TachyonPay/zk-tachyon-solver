import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("BridgeIntent", function () {
  let bridgeIntent: any;
  let tokenA: any;
  let tokenB: any;
  let owner: Signer;
  let user: Signer;
  let solver1: Signer;
  let solver2: Signer;
  let relayer: Signer;
  let recipient: Signer;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const AMOUNT_A = ethers.parseEther("100");
  const EXPECTED_AMOUNT_B = ethers.parseEther("95");
  const REWARD = ethers.parseEther("5");
  const AUCTION_DURATION = 3600; // 1 hour

  beforeEach(async function () {
    [owner, user, solver1, solver2, relayer, recipient] = await ethers.getSigners();

    // Deploy mock ERC20 tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    tokenA = await MockERC20Factory.deploy("Token A", "TKNA", INITIAL_SUPPLY);
    tokenB = await MockERC20Factory.deploy("Token B", "TKNB", INITIAL_SUPPLY);

    // Deploy BridgeIntent contract
    const BridgeIntentFactory = await ethers.getContractFactory("BridgeIntent");
    bridgeIntent = await BridgeIntentFactory.deploy();

    // Distribute tokens - solvers need tokenA to bid/deposit, not tokenB
    await tokenA.transfer(await user.getAddress(), ethers.parseEther("10000"));
    await tokenA.transfer(await solver1.getAddress(), ethers.parseEther("10000"));
    await tokenA.transfer(await solver2.getAddress(), ethers.parseEther("10000"));

    // Add relayer
    await bridgeIntent.addRelayer(await relayer.getAddress());
  });

  describe("Intent Creation", function () {
    it("Should create an intent successfully", async function () {
      // Approve tokens
      await tokenA.connect(user).approve(await bridgeIntent.getAddress(), AMOUNT_A + REWARD);

      // Create intent
      const tx = await bridgeIntent.connect(user).createIntent(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        AMOUNT_A,
        EXPECTED_AMOUNT_B,
        REWARD,
        AUCTION_DURATION
      );

      await expect(tx)
        .to.emit(bridgeIntent, "IntentCreated");
    });

    it("Should fail with invalid parameters", async function () {
      await expect(
        bridgeIntent.connect(user).createIntent(
          ethers.ZeroAddress,
          await tokenB.getAddress(),
          AMOUNT_A,
          EXPECTED_AMOUNT_B,
          REWARD,
          AUCTION_DURATION
        )
      ).to.be.revertedWith("Invalid token addresses");
    });
  });

  describe("Bidding Process", function () {
    let intentId: number;

    beforeEach(async function () {
      await tokenA.connect(user).approve(await bridgeIntent.getAddress(), AMOUNT_A + REWARD);
      await bridgeIntent.connect(user).createIntent(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        AMOUNT_A,
        EXPECTED_AMOUNT_B,
        REWARD,
        AUCTION_DURATION
      );
      intentId = 1;
    });

    it("Should allow solvers to place bids", async function () {
      const bidAmount = ethers.parseEther("96");
      
      await expect(bridgeIntent.connect(solver1).placeBid(intentId, bidAmount))
        .to.emit(bridgeIntent, "BidPlaced");
    });

    it("Should not allow bids below expected amount", async function () {
      const lowBid = ethers.parseEther("90");
      
      await expect(
        bridgeIntent.connect(solver1).placeBid(intentId, lowBid)
      ).to.be.revertedWith("Bid too low");
    });

    it("Should finalize auction correctly", async function () {
      const bid1 = ethers.parseEther("96");
      const bid2 = ethers.parseEther("98");

      // Place bids
      await bridgeIntent.connect(solver1).placeBid(intentId, bid1);
      await bridgeIntent.connect(solver2).placeBid(intentId, bid2);

      // Fast forward time
      await time.increase(AUCTION_DURATION + 1);

      // Finalize auction
      await expect(bridgeIntent.finalizeAuction(intentId))
        .to.emit(bridgeIntent, "IntentWon");
    });
  });

  describe("Solver Deposit and Fund Distribution", function () {
    let intentId: number;
    const winningBid = ethers.parseEther("98");

    beforeEach(async function () {
      // Create intent
      await tokenA.connect(user).approve(await bridgeIntent.getAddress(), AMOUNT_A + REWARD);
      await bridgeIntent.connect(user).createIntent(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        AMOUNT_A,
        EXPECTED_AMOUNT_B,
        REWARD,
        AUCTION_DURATION
      );
      intentId = 1;

      // Place bid and finalize
      await bridgeIntent.connect(solver1).placeBid(intentId, winningBid);
      await time.increase(AUCTION_DURATION + 1);
      await bridgeIntent.finalizeAuction(intentId);
    });

    it("Should allow winning solver to deposit tokens", async function () {
      await tokenA.connect(solver1).approve(await bridgeIntent.getAddress(), winningBid);
      
      await expect(bridgeIntent.connect(solver1).depositAndPickup(intentId))
        .to.emit(bridgeIntent, "SolverDeposited");
    });

    it("Should settle intent correctly - transferring both user funds and deposit to solver", async function () {
      // Solver deposits
      await tokenA.connect(solver1).approve(await bridgeIntent.getAddress(), winningBid);
      await bridgeIntent.connect(solver1).depositAndPickup(intentId);

      // Check initial solver balances
      const solverTokenABalanceBefore = await tokenA.balanceOf(await solver1.getAddress());

      // Settle the intent (simulating successful completion on destination chain)
      await expect(bridgeIntent.connect(relayer).settleIntent(intentId))
        .to.emit(bridgeIntent, "IntentSettled")
        .to.emit(bridgeIntent, "IntentCompleted");

      // Check final solver balances
      const solverTokenABalanceAfter = await tokenA.balanceOf(await solver1.getAddress());

      // Solver should receive:
      // 1. User's original amount (AMOUNT_A)
      // 2. User's reward (REWARD)  
      // 3. Their own deposit back (winningBid) - all in tokenA
      expect(solverTokenABalanceAfter - solverTokenABalanceBefore).to.equal(AMOUNT_A + REWARD + winningBid);
    });

    it("Should not allow unauthorized user to settle", async function () {
      await tokenA.connect(solver1).approve(await bridgeIntent.getAddress(), winningBid);
      await bridgeIntent.connect(solver1).depositAndPickup(intentId);

      await expect(
        bridgeIntent.connect(user).settleIntent(intentId)
      ).to.be.revertedWith("Not authorized relayer");
    });
  });

  describe("Intent Cancellation", function () {
    it("Should allow intent cancellation after timeout", async function () {
      await tokenA.connect(user).approve(await bridgeIntent.getAddress(), AMOUNT_A + REWARD);
      await bridgeIntent.connect(user).createIntent(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        AMOUNT_A,
        EXPECTED_AMOUNT_B,
        REWARD,
        AUCTION_DURATION
      );

      // Fast forward past end time + 1 hour
      await time.increase(AUCTION_DURATION + 3601);

      const userBalanceBefore = await tokenA.balanceOf(await user.getAddress());
      await bridgeIntent.connect(user).cancelIntent(1);
      const userBalanceAfter = await tokenA.balanceOf(await user.getAddress());

      expect(userBalanceAfter - userBalanceBefore).to.equal(AMOUNT_A + REWARD);
    });
  });
}); 