// Test script for StrategyVaultV2 Universal Executor - Live Uniswap V3 Swap
// Simulates AI-generated routing payload: USDC -> WETH on Uniswap V3
// Run on Tenderly Virtual Mainnet fork

const { ethers } = require("hardhat");

// ============================================================================
// TASK 1: Mainnet Constants
// ============================================================================

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

const USDC_DECIMALS = 6;
const WETH_DECIMALS = 18;

// Uniswap V3 pool fee tiers
const FEE_TIER_005 = 500;   // 0.05%
const FEE_TIER_030 = 3000;  // 0.30%
const FEE_TIER_100 = 10000; // 1.00%

// ============================================================================
// ABIs for interaction
// ============================================================================

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)"
];

// Uniswap V3 SwapRouter exactInputSingle
const UNISWAP_V3_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
];

async function main() {
  console.log("=".repeat(70));
  console.log("StrategyVaultV2 Universal Executor - Live Uniswap V3 Swap Test");
  console.log("=".repeat(70));

  // ============================================================================
  // Setup
  // ============================================================================

  const signers = await ethers.getSigners();
  const deployer = signers[0];

  // Create test user wallet
  const userWallet = ethers.Wallet.createRandom().connect(ethers.provider);
  await deployer.sendTransaction({ to: userWallet.address, value: ethers.parseEther("2") });
  const user = userWallet;

  console.log("\n📍 Test Accounts:");
  console.log("  Deployer:", deployer.address);
  console.log("  User:", user.address);

  // ============================================================================
  // Deploy Contracts
  // ============================================================================

  console.log("\n🚀 Deploying contracts...");

  // Deploy MockKeystoneForwarder
  const MockForwarder = await ethers.getContractFactory("MockKeystoneForwarder");
  const forwarder = await MockForwarder.deploy();
  await forwarder.waitForDeployment();
  const forwarderAddress = await forwarder.getAddress();
  console.log("  MockKeystoneForwarder:", forwarderAddress);

  // Deploy StrategyVaultV2 with USDC as base asset
  const StrategyVaultV2 = await ethers.getContractFactory("StrategyVaultV2");
  const vault = await StrategyVaultV2.deploy(forwarderAddress, USDC_ADDRESS);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("  StrategyVaultV2:", vaultAddress);

  // Deploy TrustedAgentRegistryV2 for job creation
  const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
  const CCIP_ROUTER = "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D";

  // Deploy mock AEGIS token for registry
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const aegisToken = await MockERC20.deploy("AEGIS Token", "AEGIS", 18);
  await aegisToken.waitForDeployment();

  const RegistryV2 = await ethers.getContractFactory("TrustedAgentRegistryV2");
  const registry = await RegistryV2.deploy(
    LINK_TOKEN,
    await aegisToken.getAddress(),
    CCIP_ROUTER,
    forwarderAddress,
    deployer.address,
    deployer.address
  );
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("  TrustedAgentRegistryV2:", registryAddress);

  // Set registry on vault
  await vault.setRegistry(registryAddress);

  // ============================================================================
  // TASK 2: ACE Whitelist Preparation (Mock)
  // ============================================================================

  console.log("\n🔒 ACE Whitelist Configuration:");
  console.log("  Whitelisted targets:");
  console.log("    - USDC:", USDC_ADDRESS, "(for approval)");
  console.log("    - Uniswap V3 Router:", UNISWAP_V3_ROUTER, "(for swap)");

  // In production, this would be checked by the ACE PolicyEngine
  // For this test, we're demonstrating that the execution will work
  // because we're targeting whitelisted contracts

  const whitelistedTargets = [USDC_ADDRESS, UNISWAP_V3_ROUTER];
  console.log("  ✅ Whitelist configured (2 targets)");

  // ============================================================================
  // Register and Verify Agent
  // ============================================================================

  console.log("\n🤖 Setting up AI Agent...");

  // Register agent
  await registry.connect(user).registerAgent("ipfs://ai-trading-agent", "0x");
  console.log("  Agent registered");

  // Verify agent via forwarder (simulating CRE World ID verification)
  const verifyReport = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes32"],
    [1, ethers.id("world-id-nullifier-hash")]
  );
  await forwarder.deliverReportSimple(registryAddress, verifyReport);

  const isVerified = await registry.isAgentVerified(1);
  console.log("  Agent verified:", isVerified);

  // ============================================================================
  // Fund User with USDC
  // ============================================================================

  console.log("\n💰 Funding user with USDC...");

  // USDC uses storage slot 9 for balances
  const usdcAmount = ethers.parseUnits("10000", USDC_DECIMALS); // 10,000 USDC

  const balanceSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [user.address, 9]
    )
  );

  await ethers.provider.send("tenderly_setStorageAt", [
    USDC_ADDRESS,
    balanceSlot,
    ethers.zeroPadValue(ethers.toBeHex(usdcAmount), 32)
  ]);

  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, user);
  const userUsdcBalance = await usdc.balanceOf(user.address);
  console.log("  User USDC balance:", ethers.formatUnits(userUsdcBalance, USDC_DECIMALS));

  // ============================================================================
  // TASK 4: Fund & Deposit
  // ============================================================================

  console.log("\n📥 User depositing 1,000 USDC into vault...");

  const depositAmount = ethers.parseUnits("1000", USDC_DECIMALS);

  // Approve vault
  await usdc.approve(vaultAddress, depositAmount);
  console.log("  Approved vault for 1,000 USDC");

  // Deposit
  await vault.connect(user).deposit(depositAmount);
  console.log("  Deposited 1,000 USDC");

  // Check vault balance
  const vaultUsdcBefore = await usdc.balanceOf(vaultAddress);
  console.log("  Vault USDC balance:", ethers.formatUnits(vaultUsdcBefore, USDC_DECIMALS));

  // Check WETH balance before (should be 0)
  const weth = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, ethers.provider);
  const vaultWethBefore = await weth.balanceOf(vaultAddress);
  console.log("  Vault WETH balance:", ethers.formatEther(vaultWethBefore));

  // ============================================================================
  // Create Strategy Job
  // ============================================================================

  console.log("\n📋 Creating strategy job...");

  const jobTx = await vault.connect(user).requestStrategyJob([1]); // Agent ID 1
  await jobTx.wait();
  console.log("  Strategy job created (ID: 1)");

  // ============================================================================
  // TASK 3: Construct the AI Payload (The Route)
  // ============================================================================

  console.log("\n🤖 AI Agent generating execution route...");
  console.log("  Route: USDC -> WETH via Uniswap V3 (0.05% pool)");

  const swapAmount = ethers.parseUnits("500", USDC_DECIMALS); // Swap 500 USDC
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  // Step 1: Approve USDC for Uniswap Router
  const usdcInterface = new ethers.Interface(ERC20_ABI);
  const approveCalldata = usdcInterface.encodeFunctionData("approve", [
    UNISWAP_V3_ROUTER,
    swapAmount
  ]);

  console.log("\n  Step 1 - Approve USDC:");
  console.log("    Target:", USDC_ADDRESS);
  console.log("    Spender:", UNISWAP_V3_ROUTER);
  console.log("    Amount:", ethers.formatUnits(swapAmount, USDC_DECIMALS), "USDC");

  // Step 2: Swap USDC for WETH via exactInputSingle
  const routerInterface = new ethers.Interface(UNISWAP_V3_ROUTER_ABI);
  const swapParams = {
    tokenIn: USDC_ADDRESS,
    tokenOut: WETH_ADDRESS,
    fee: FEE_TIER_005,           // 0.05% pool (best for stablecoin-ETH)
    recipient: vaultAddress,      // Receive WETH back to vault
    deadline: deadline,
    amountIn: swapAmount,
    amountOutMinimum: 0,          // In production, use proper slippage
    sqrtPriceLimitX96: 0          // No price limit
  };

  const swapCalldata = routerInterface.encodeFunctionData("exactInputSingle", [swapParams]);

  console.log("\n  Step 2 - Swap on Uniswap V3:");
  console.log("    Target:", UNISWAP_V3_ROUTER);
  console.log("    tokenIn:", USDC_ADDRESS, "(USDC)");
  console.log("    tokenOut:", WETH_ADDRESS, "(WETH)");
  console.log("    fee:", FEE_TIER_005, "(0.05%)");
  console.log("    recipient:", vaultAddress, "(vault)");
  console.log("    amountIn:", ethers.formatUnits(swapAmount, USDC_DECIMALS), "USDC");

  // Construct the execution arrays
  const targets = [USDC_ADDRESS, UNISWAP_V3_ROUTER];
  const values = [0, 0]; // No ETH sent with these calls
  const calldatas = [approveCalldata, swapCalldata];

  // ============================================================================
  // Validate Targets Against Whitelist
  // ============================================================================

  console.log("\n🔐 ACE Whitelist Validation:");
  for (let i = 0; i < targets.length; i++) {
    const isWhitelisted = whitelistedTargets.includes(targets[i]);
    console.log(`  Target ${i + 1}: ${targets[i]} - ${isWhitelisted ? "✅ WHITELISTED" : "❌ BLOCKED"}`);
    if (!isWhitelisted) {
      throw new Error(`Target ${targets[i]} is not whitelisted! ACE would reject this transaction.`);
    }
  }

  // ============================================================================
  // TASK 4: Deliver Payload via CRE
  // ============================================================================

  console.log("\n🚀 Executing via CRE Forwarder...");

  // Encode the report for StrategyVaultV2._processReport
  const executionReport = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address[]", "uint256[]", "bytes[]"],
    [1, targets, values, calldatas] // jobId = 1
  );

  console.log("  Payload size:", executionReport.length, "bytes");
  console.log("  Number of calls:", targets.length);

  // Deliver via forwarder
  const executeTx = await forwarder.deliverReportSimple(vaultAddress, executionReport);
  const receipt = await executeTx.wait();

  console.log("  TX Hash:", executeTx.hash);
  console.log("  Gas Used:", receipt.gasUsed.toString());

  // ============================================================================
  // TASK 4: Assertions
  // ============================================================================

  console.log("\n" + "=".repeat(70));
  console.log("ASSERTIONS");
  console.log("=".repeat(70));

  // 1. Assert transaction was successful
  const txSuccess = receipt.status === 1;
  console.log("\n1. Transaction successful:", txSuccess ? "✅ YES" : "❌ NO");

  // 2. Assert vault's USDC balance decreased
  const vaultUsdcAfter = await usdc.balanceOf(vaultAddress);
  const usdcDecreased = vaultUsdcAfter < vaultUsdcBefore;
  const usdcDelta = vaultUsdcBefore - vaultUsdcAfter;

  console.log("\n2. Vault USDC decreased:");
  console.log("   Before:", ethers.formatUnits(vaultUsdcBefore, USDC_DECIMALS), "USDC");
  console.log("   After:", ethers.formatUnits(vaultUsdcAfter, USDC_DECIMALS), "USDC");
  console.log("   Delta:", ethers.formatUnits(usdcDelta, USDC_DECIMALS), "USDC");
  console.log("   Result:", usdcDecreased ? "✅ PASSED" : "❌ FAILED");

  // 3. Assert vault's WETH balance is > 0
  const vaultWethAfter = await weth.balanceOf(vaultAddress);
  const wethReceived = vaultWethAfter > 0n;

  console.log("\n3. Vault received WETH:");
  console.log("   Before:", ethers.formatEther(vaultWethBefore), "WETH");
  console.log("   After:", ethers.formatEther(vaultWethAfter), "WETH");
  console.log("   Result:", wethReceived ? "✅ PASSED" : "❌ FAILED");

  // 4. Verify job was marked as completed
  const job = await vault.getJob(1);
  const jobCompleted = job.completed && job.success;
  console.log("\n4. Job marked complete:", jobCompleted ? "✅ PASSED" : "❌ FAILED");

  // 5. Calculate effective swap rate
  if (wethReceived) {
    const effectiveRate = Number(ethers.formatEther(vaultWethAfter)) / Number(ethers.formatUnits(usdcDelta, USDC_DECIMALS));
    const ethPriceUsd = 1 / effectiveRate;
    console.log("\n📊 Swap Analysis:");
    console.log("   USDC spent:", ethers.formatUnits(usdcDelta, USDC_DECIMALS));
    console.log("   WETH received:", ethers.formatEther(vaultWethAfter));
    console.log("   Effective ETH price: $", ethPriceUsd.toFixed(2));
  }

  // ============================================================================
  // Final Summary
  // ============================================================================

  console.log("\n" + "=".repeat(70));
  console.log("TEST SUMMARY");
  console.log("=".repeat(70));

  const allPassed = txSuccess && usdcDecreased && wethReceived && jobCompleted;

  console.log("\n  🎯 USDC -> WETH Uniswap V3 Swap via Universal Executor");
  console.log("\n  Results:");
  console.log("    [1] Transaction Success:      ", txSuccess ? "✅" : "❌");
  console.log("    [2] USDC Balance Decreased:   ", usdcDecreased ? "✅" : "❌");
  console.log("    [3] WETH Balance Received:    ", wethReceived ? "✅" : "❌");
  console.log("    [4] Job Marked Complete:      ", jobCompleted ? "✅" : "❌");
  console.log("\n  " + "─".repeat(50));
  console.log("  OVERALL:", allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED");
  console.log("=".repeat(70));

  if (!allPassed) {
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed with error:");
    console.error(error);
    process.exit(1);
  });
