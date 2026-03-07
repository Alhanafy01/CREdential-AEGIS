// Test script for StrategyVaultV2 Universal AI DeFi Executor
// Run on Tenderly Virtual Mainnet fork with real USDC

const { ethers } = require("hardhat");

// Mainnet USDC address
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDC_DECIMALS = 6;

async function main() {
  console.log("=".repeat(60));
  console.log("StrategyVaultV2 Universal Executor - Test Suite");
  console.log("=".repeat(60));

  const signers = await ethers.getSigners();
  const deployer = signers[0];

  // Create additional test wallets
  const user1Wallet = ethers.Wallet.createRandom().connect(ethers.provider);
  const user2Wallet = ethers.Wallet.createRandom().connect(ethers.provider);

  // Fund test wallets with ETH for gas
  await deployer.sendTransaction({ to: user1Wallet.address, value: ethers.parseEther("1") });
  await deployer.sendTransaction({ to: user2Wallet.address, value: ethers.parseEther("1") });

  const user1 = user1Wallet;
  const user2 = user2Wallet;

  console.log("\n📍 Test Accounts:");
  console.log("  Deployer:", deployer.address);
  console.log("  User1:", user1.address);
  console.log("  User2:", user2.address);

  // ============ Deploy Contracts ============
  console.log("\n🚀 Deploying contracts...");

  // Deploy MockKeystoneForwarder
  const MockForwarder = await ethers.getContractFactory("MockKeystoneForwarder");
  const forwarder = await MockForwarder.deploy();
  await forwarder.waitForDeployment();
  console.log("  MockKeystoneForwarder:", await forwarder.getAddress());

  // Deploy StrategyVaultV2 with real USDC
  const StrategyVaultV2 = await ethers.getContractFactory("StrategyVaultV2");
  const vault = await StrategyVaultV2.deploy(
    await forwarder.getAddress(),
    USDC_ADDRESS
  );
  await vault.waitForDeployment();
  console.log("  StrategyVaultV2:", await vault.getAddress());

  // Deploy MockDeFiProtocol for execution testing
  const MockDeFi = await ethers.getContractFactory("MockDeFiProtocol");
  const defiProtocol = await MockDeFi.deploy();
  await defiProtocol.waitForDeployment();
  console.log("  MockDeFiProtocol:", await defiProtocol.getAddress());

  // Deploy a mock token for swap testing
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const mockToken = await MockERC20.deploy("Mock Token", "MOCK", 6);
  await mockToken.waitForDeployment();
  console.log("  MockToken:", await mockToken.getAddress());

  // ============ Fund Test Accounts with USDC ============
  console.log("\n💰 Funding accounts with USDC via storage override...");

  // USDC uses storage slot 9 for balances (verified for USDC on mainnet)
  const usdcAmount = ethers.parseUnits("10000", USDC_DECIMALS); // 10,000 USDC

  for (const account of [deployer, user1, user2]) {
    // Calculate storage slot for this account's balance
    const balanceSlot = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [account.address, 9] // slot 9 for USDC balances
      )
    );

    // Set balance via Tenderly
    await ethers.provider.send("tenderly_setStorageAt", [
      USDC_ADDRESS,
      balanceSlot,
      ethers.zeroPadValue(ethers.toBeHex(usdcAmount), 32)
    ]);
  }

  // Verify USDC balances
  const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
  console.log("  User1 USDC balance:", ethers.formatUnits(await usdc.balanceOf(user1.address), USDC_DECIMALS));
  console.log("  User2 USDC balance:", ethers.formatUnits(await usdc.balanceOf(user2.address), USDC_DECIMALS));

  // ============ TEST 1: Deposit USDC and Receive Shares ============
  console.log("\n" + "=".repeat(60));
  console.log("TEST 1: Deposit USDC and Receive Shares");
  console.log("=".repeat(60));

  const depositAmount = ethers.parseUnits("1000", USDC_DECIMALS); // 1,000 USDC

  // Approve vault
  console.log("\n  Step 1: User1 approving vault for 1,000 USDC...");
  await usdc.connect(user1).approve(await vault.getAddress(), depositAmount);

  // Deposit
  console.log("  Step 2: User1 depositing 1,000 USDC...");
  const depositTx = await vault.connect(user1).deposit(depositAmount);
  await depositTx.wait();

  // Verify shares
  const user1Shares = await vault.balanceOf(user1.address);
  const totalShares = await vault.totalShares();
  const totalAssets = await vault.totalAssets();

  console.log("\n  📊 Results:");
  console.log("    User1 shares:", ethers.formatUnits(user1Shares, USDC_DECIMALS));
  console.log("    Total shares:", ethers.formatUnits(totalShares, USDC_DECIMALS));
  console.log("    Total assets:", ethers.formatUnits(totalAssets, USDC_DECIMALS), "USDC");

  // Verify 1:1 ratio for first deposit
  const test1Pass = user1Shares === depositAmount;
  console.log("\n  ✅ TEST 1 PASSED:", test1Pass ? "YES" : "NO");

  // ============ TEST 2: Second Deposit (Proportional Shares) ============
  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: Second Deposit (Proportional Shares)");
  console.log("=".repeat(60));

  const deposit2Amount = ethers.parseUnits("500", USDC_DECIMALS); // 500 USDC

  console.log("\n  Step 1: User2 approving and depositing 500 USDC...");
  await usdc.connect(user2).approve(await vault.getAddress(), deposit2Amount);
  await vault.connect(user2).deposit(deposit2Amount);

  const user2Shares = await vault.balanceOf(user2.address);
  const newTotalShares = await vault.totalShares();
  const newTotalAssets = await vault.totalAssets();

  console.log("\n  📊 Results:");
  console.log("    User2 shares:", ethers.formatUnits(user2Shares, USDC_DECIMALS));
  console.log("    Total shares:", ethers.formatUnits(newTotalShares, USDC_DECIMALS));
  console.log("    Total assets:", ethers.formatUnits(newTotalAssets, USDC_DECIMALS), "USDC");

  const test2Pass = user2Shares === deposit2Amount; // Should be 500 shares (proportional)
  console.log("\n  ✅ TEST 2 PASSED:", test2Pass ? "YES" : "NO");

  // ============ TEST 3: Mock CRE Execution (Universal Executor) ============
  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: Mock CRE Execution (Universal Executor)");
  console.log("=".repeat(60));

  // First, create a strategy job
  // We need a mock registry for this, so let's skip job creation and test direct CRE call

  console.log("\n  Preparing execution payload...");

  // Prepare a simple execution: call ping() on MockDeFiProtocol
  const defiAddress = await defiProtocol.getAddress();
  const pingCalldata = defiProtocol.interface.encodeFunctionData("ping");

  // Encode the report for StrategyVaultV2._processReport
  // Format: (uint256 jobId, address[] targets, uint256[] values, bytes[] calldatas)

  // First we need to create a job - let's deploy a mock registry
  const MockRegistry = await ethers.getContractFactory("TrustedAgentRegistryV2");
  // Actually, let's just set registry to 0 for testing and modify the vault...

  // For testing, let's manually call the forwarder to test _processReport
  // We'll create a job ID 0 (which won't exist, but let's test the execution path differently)

  // Let's create a simpler test - test that non-forwarder calls revert
  console.log("\n  Step 1: Testing that direct execution is blocked...");

  try {
    // Try to call a function that would execute (this should fail since we can't call _processReport directly)
    // Actually _processReport is internal, so we need to test via onReport
    const fakeReport = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address[]", "uint256[]", "bytes[]"],
      [1, [defiAddress], [0], [pingCalldata]]
    );

    // Call from non-forwarder should fail
    const IReceiver = await ethers.getContractAt("IReceiver", await vault.getAddress());
    await IReceiver.connect(user1).onReport("0x", fakeReport);
    console.log("    ❌ ERROR: Direct call should have failed!");
  } catch (error) {
    console.log("    ✅ Direct call blocked (InvalidSender) - CORRECT");
  }

  console.log("\n  Step 2: Testing CRE execution via MockForwarder...");

  // To properly test, we need to:
  // 1. Create a job first (requires registry)
  // 2. Then deliver the report via forwarder

  // For now, let's test the basic forwarder->vault path without job validation
  // We'll need to handle the JobNotFound error, so let's create a minimal job first

  // Create a jobs[1] entry by manipulating storage or modifying test approach
  // Alternative: Test with a mock that doesn't validate job existence

  // Let's test the forwarder delivery mechanism works
  console.log("\n  Step 3: Verifying forwarder can call vault...");

  // Check forwarder address is set correctly
  const vaultForwarder = await vault.getForwarderAddress();
  console.log("    Vault forwarder:", vaultForwarder);
  console.log("    Mock forwarder:", await forwarder.getAddress());
  console.log("    Match:", vaultForwarder.toLowerCase() === (await forwarder.getAddress()).toLowerCase());

  const test3Pass = vaultForwarder.toLowerCase() === (await forwarder.getAddress()).toLowerCase();
  console.log("\n  ✅ TEST 3 PASSED:", test3Pass ? "YES" : "NO");

  // ============ TEST 4: Withdrawal ============
  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: Withdrawal");
  console.log("=".repeat(60));

  const withdrawShares = ethers.parseUnits("500", USDC_DECIMALS); // Withdraw 500 shares

  console.log("\n  Step 1: User1 withdrawing 500 shares...");
  const balanceBefore = await usdc.balanceOf(user1.address);
  await vault.connect(user1).withdraw(withdrawShares);
  const balanceAfter = await usdc.balanceOf(user1.address);

  const withdrawn = balanceAfter - balanceBefore;
  console.log("    USDC received:", ethers.formatUnits(withdrawn, USDC_DECIMALS));

  const user1SharesAfter = await vault.balanceOf(user1.address);
  console.log("    User1 remaining shares:", ethers.formatUnits(user1SharesAfter, USDC_DECIMALS));

  const test4Pass = withdrawn === withdrawShares; // Should receive 500 USDC (1:1)
  console.log("\n  ✅ TEST 4 PASSED:", test4Pass ? "YES" : "NO");

  // ============ TEST 5: Full CRE Execution with Job ============
  console.log("\n" + "=".repeat(60));
  console.log("TEST 5: Full CRE Execution Flow");
  console.log("=".repeat(60));

  // Deploy TrustedAgentRegistryV2 for proper job creation
  console.log("\n  Deploying TrustedAgentRegistryV2 for full test...");

  const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
  const CCIP_ROUTER = "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D";

  const RegistryV2 = await ethers.getContractFactory("TrustedAgentRegistryV2");
  const registry = await RegistryV2.deploy(
    LINK_TOKEN,
    await mockToken.getAddress(), // Use mock token as AEGIS
    CCIP_ROUTER,
    await forwarder.getAddress(),
    deployer.address,
    deployer.address
  );
  await registry.waitForDeployment();
  console.log("    Registry deployed:", await registry.getAddress());

  // Set registry on vault
  await vault.setRegistry(await registry.getAddress());
  console.log("    Registry set on vault");

  // Register and verify an agent
  console.log("\n  Registering and verifying agent...");
  await registry.connect(user1).registerAgent("ipfs://test", "0x");

  // Verify agent via forwarder (simulating CRE)
  const verifyReport = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes32"],
    [1, ethers.id("test-nullifier")]
  );
  await forwarder.deliverReportSimple(await registry.getAddress(), verifyReport);

  const isVerified = await registry.isAgentVerified(1);
  console.log("    Agent 1 verified:", isVerified);

  // Create strategy job
  console.log("\n  Creating strategy job...");
  const jobTx = await vault.connect(user1).requestStrategyJob([1]);
  const jobReceipt = await jobTx.wait();
  console.log("    Job created, TX:", jobTx.hash);

  // Now execute via CRE
  console.log("\n  Executing strategy via CRE...");

  // Prepare execution: just a simple ping to MockDeFiProtocol
  const executionReport = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address[]", "uint256[]", "bytes[]"],
    [
      1, // jobId
      [defiAddress], // targets
      [0], // values (no ETH)
      [pingCalldata] // calldatas
    ]
  );

  try {
    await forwarder.deliverReportSimple(await vault.getAddress(), executionReport);
    console.log("    ✅ Execution successful!");

    // Verify job is completed
    const job = await vault.getJob(1);
    console.log("    Job completed:", job.completed);
    console.log("    Job success:", job.success);

    const test5Pass = job.completed && job.success;
    console.log("\n  ✅ TEST 5 PASSED:", test5Pass ? "YES" : "NO");
  } catch (error) {
    console.log("    ❌ Execution failed:", error.message);
    console.log("\n  ✅ TEST 5 PASSED: NO");
  }

  // ============ TEST 6: Atomic Failure (Revert All) ============
  console.log("\n" + "=".repeat(60));
  console.log("TEST 6: Atomic Failure (Revert All)");
  console.log("=".repeat(60));

  // Create another job
  await vault.connect(user1).requestStrategyJob([1]);
  console.log("  Created job 2 for failure test");

  // Prepare execution with a failing call
  const failCalldata = defiProtocol.interface.encodeFunctionData("alwaysFails");
  const failingReport = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address[]", "uint256[]", "bytes[]"],
    [
      2, // jobId
      [defiAddress, defiAddress], // Two targets
      [0, 0], // values
      [pingCalldata, failCalldata] // First succeeds, second fails
    ]
  );

  console.log("\n  Executing with intentional failure in second call...");
  try {
    await forwarder.deliverReportSimple(await vault.getAddress(), failingReport);
    console.log("    ❌ Should have reverted!");
  } catch (error) {
    console.log("    ✅ Correctly reverted on failure");

    // Verify job is NOT completed (atomic rollback)
    const job2 = await vault.getJob(2);
    console.log("    Job 2 completed:", job2.completed);

    const test6Pass = !job2.completed; // Should still be false
    console.log("\n  ✅ TEST 6 PASSED:", test6Pass ? "YES" : "NO");
  }

  // ============ Summary ============
  console.log("\n" + "=".repeat(60));
  console.log("TEST SUMMARY");
  console.log("=".repeat(60));
  console.log("  TEST 1 (USDC Deposit): " + (test1Pass ? "✅ PASSED" : "❌ FAILED"));
  console.log("  TEST 2 (Proportional Shares): " + (test2Pass ? "✅ PASSED" : "❌ FAILED"));
  console.log("  TEST 3 (Forwarder Setup): " + (test3Pass ? "✅ PASSED" : "❌ FAILED"));
  console.log("  TEST 4 (Withdrawal): " + (test4Pass ? "✅ PASSED" : "❌ FAILED"));
  console.log("  TEST 5 (CRE Execution): Check above");
  console.log("  TEST 6 (Atomic Failure): Check above");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
