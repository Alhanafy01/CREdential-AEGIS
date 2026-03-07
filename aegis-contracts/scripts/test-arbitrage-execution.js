// Test script for StrategyVaultV2 Universal Executor - Multi-DEX Arbitrage
// Demonstrates AI-generated profit via SushiSwap <-> Uniswap V3 arbitrage
// Run on Tenderly Virtual Mainnet fork

const { ethers } = require("hardhat");

// ============================================================================
// TASK 1: Mainnet Constants
// ============================================================================

const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const SUSHISWAP_ROUTER = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";

// Whale address for pool manipulation
const WETH_WHALE = "0xF977814e90dA44bFA03b6295A0616a897441aceC"; // Binance Hot Wallet

const USDC_DECIMALS = 6;
const WETH_DECIMALS = 18;

// Uniswap V3 pool fee
const FEE_TIER_005 = 500; // 0.05%

// ============================================================================
// ABIs
// ============================================================================

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];

// SushiSwap Router (Uniswap V2 style)
const SUSHISWAP_ROUTER_ABI = [
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) external returns (uint256[] memory amounts)",
  "function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)"
];

// Uniswap V3 SwapRouter
const UNISWAP_V3_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
];

async function main() {
  console.log("=".repeat(70));
  console.log("StrategyVaultV2 Universal Executor - Multi-DEX Arbitrage Test");
  console.log("=".repeat(70));
  console.log("\n🎯 Strategy: Buy cheap WETH on SushiSwap, sell on Uniswap V3 for profit");

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
  console.log("  WETH Whale:", WETH_WHALE);

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

  // Deploy TrustedAgentRegistryV2
  const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
  const CCIP_ROUTER = "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D";

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
  // TASK 2: ACE Whitelist Preparation
  // ============================================================================

  console.log("\n🔒 ACE Whitelist Configuration:");
  const whitelistedTargets = [
    USDC_ADDRESS,
    WETH_ADDRESS,
    UNISWAP_V3_ROUTER,
    SUSHISWAP_ROUTER
  ];

  console.log("  Whitelisted targets:");
  console.log("    - USDC:", USDC_ADDRESS);
  console.log("    - WETH:", WETH_ADDRESS);
  console.log("    - Uniswap V3 Router:", UNISWAP_V3_ROUTER);
  console.log("    - SushiSwap Router:", SUSHISWAP_ROUTER);
  console.log("  ✅ Whitelist configured (4 targets)");

  // ============================================================================
  // Register and Verify AI Agent
  // ============================================================================

  console.log("\n🤖 Setting up AI Arbitrage Agent...");

  await registry.connect(user).registerAgent("ipfs://ai-arbitrage-agent", "0x");
  console.log("  Agent registered");

  const verifyReport = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes32"],
    [1, ethers.id("world-id-nullifier-arbitrage")]
  );
  await forwarder.deliverReportSimple(registryAddress, verifyReport);
  console.log("  Agent verified:", await registry.isAgentVerified(1));

  // ============================================================================
  // Fund User with USDC
  // ============================================================================

  console.log("\n💰 Funding user with USDC...");

  const usdcAmount = ethers.parseUnits("10000", USDC_DECIMALS);
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
  console.log("  User USDC balance:", ethers.formatUnits(await usdc.balanceOf(user.address), USDC_DECIMALS));

  // ============================================================================
  // User Deposits 1,000 USDC
  // ============================================================================

  console.log("\n📥 User depositing 1,000 USDC into vault...");

  const depositAmount = ethers.parseUnits("1000", USDC_DECIMALS);
  await usdc.approve(vaultAddress, depositAmount);
  await vault.connect(user).deposit(depositAmount);

  const userShares = await vault.balanceOf(user.address);
  const vaultUsdcInitial = await usdc.balanceOf(vaultAddress);

  console.log("  User shares:", ethers.formatUnits(userShares, USDC_DECIMALS));
  console.log("  Vault USDC:", ethers.formatUnits(vaultUsdcInitial, USDC_DECIMALS));

  // ============================================================================
  // TASK 3: Skew the SushiSwap Pool (Whale Dumps WETH)
  // ============================================================================

  console.log("\n" + "=".repeat(70));
  console.log("TASK 3: SKEWING SUSHISWAP POOL (WHALE MANIPULATION)");
  console.log("=".repeat(70));

  // Get WETH contract
  const weth = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, ethers.provider);

  // Check pre-manipulation prices
  const sushiRouter = new ethers.Contract(SUSHISWAP_ROUTER, SUSHISWAP_ROUTER_ABI, ethers.provider);

  const testAmount = ethers.parseUnits("1000", USDC_DECIMALS);
  const preManipAmounts = await sushiRouter.getAmountsOut(testAmount, [USDC_ADDRESS, WETH_ADDRESS]);
  const preManipWethFor1000Usdc = preManipAmounts[1];

  console.log("\n  📊 Pre-Manipulation Prices:");
  console.log("    SushiSwap: 1000 USDC → ", ethers.formatEther(preManipWethFor1000Usdc), "WETH");
  const preManipEthPrice = 1000 / Number(ethers.formatEther(preManipWethFor1000Usdc));
  console.log("    Implied ETH price: $", preManipEthPrice.toFixed(2));

  // Whale dumps 5,000 WETH on SushiSwap
  console.log("\n  🐋 Whale dumping 5,000 WETH on SushiSwap...");

  const whaleDumpAmount = ethers.parseEther("5000");
  const deadline = Math.floor(Date.now() / 1000) + 3600;

  // On Tenderly, use tenderly_setBalance and direct transaction sending
  // First, fund the deployer with WETH via storage manipulation
  // WETH balanceOf mapping is at slot 3
  const wethBalanceSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [deployer.address, 3]
    )
  );

  await ethers.provider.send("tenderly_setStorageAt", [
    WETH_ADDRESS,
    wethBalanceSlot,
    ethers.zeroPadValue(ethers.toBeHex(whaleDumpAmount), 32)
  ]);

  const wethAsDeployer = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, deployer);
  const deployerWethBalance = await wethAsDeployer.balanceOf(deployer.address);
  console.log("    Deployer WETH balance:", ethers.formatEther(deployerWethBalance));

  // Approve SushiSwap Router
  await wethAsDeployer.approve(SUSHISWAP_ROUTER, whaleDumpAmount);
  console.log("    Approved SushiSwap Router");

  // Execute massive WETH → USDC swap (crashes WETH price on Sushi)
  const sushiRouterAsDeployer = new ethers.Contract(SUSHISWAP_ROUTER, SUSHISWAP_ROUTER_ABI, deployer);

  const dumpTx = await sushiRouterAsDeployer.swapExactTokensForTokens(
    whaleDumpAmount,
    0, // Accept any amount (we're manipulating, not trading seriously)
    [WETH_ADDRESS, USDC_ADDRESS],
    deployer.address,
    deadline
  );
  await dumpTx.wait();
  console.log("    ✅ Deployer dumped 5,000 WETH (simulating whale)");

  // Check post-manipulation prices
  const postManipAmounts = await sushiRouter.getAmountsOut(testAmount, [USDC_ADDRESS, WETH_ADDRESS]);
  const postManipWethFor1000Usdc = postManipAmounts[1];

  console.log("\n  📊 Post-Manipulation Prices:");
  console.log("    SushiSwap: 1000 USDC → ", ethers.formatEther(postManipWethFor1000Usdc), "WETH");
  const postManipEthPrice = 1000 / Number(ethers.formatEther(postManipWethFor1000Usdc));
  console.log("    Implied ETH price: $", postManipEthPrice.toFixed(2));

  const priceImprovement = ((Number(ethers.formatEther(postManipWethFor1000Usdc)) / Number(ethers.formatEther(preManipWethFor1000Usdc))) - 1) * 100;
  console.log("    🎯 WETH is now", priceImprovement.toFixed(2), "% cheaper on SushiSwap!");

  // ============================================================================
  // Create Strategy Job
  // ============================================================================

  console.log("\n📋 Creating arbitrage strategy job...");
  await vault.connect(user).requestStrategyJob([1]);
  console.log("  Strategy job created (ID: 1)");

  // ============================================================================
  // TASK 4: Construct the AI Arbitrage Payload (4 Steps)
  // ============================================================================

  console.log("\n" + "=".repeat(70));
  console.log("TASK 4: AI GENERATING ARBITRAGE ROUTE");
  console.log("=".repeat(70));

  const arbAmount = ethers.parseUnits("1000", USDC_DECIMALS); // Use full 1000 USDC
  const maxUint256 = ethers.MaxUint256;

  // Interfaces for encoding
  const erc20Interface = new ethers.Interface(ERC20_ABI);
  const sushiInterface = new ethers.Interface(SUSHISWAP_ROUTER_ABI);
  const uniV3Interface = new ethers.Interface(UNISWAP_V3_ROUTER_ABI);

  // ── Step 1: Approve USDC for SushiSwap ──
  const step1Calldata = erc20Interface.encodeFunctionData("approve", [
    SUSHISWAP_ROUTER,
    arbAmount
  ]);

  console.log("\n  Step 1 - Approve USDC for SushiSwap:");
  console.log("    Target:", USDC_ADDRESS);
  console.log("    Amount:", ethers.formatUnits(arbAmount, USDC_DECIMALS), "USDC");

  // ── Step 2: Swap USDC → WETH on SushiSwap (Buy Cheap WETH) ──
  const step2Calldata = sushiInterface.encodeFunctionData("swapExactTokensForTokens", [
    arbAmount,
    0, // amountOutMin (in production, use proper slippage)
    [USDC_ADDRESS, WETH_ADDRESS],
    vaultAddress, // Send WETH to vault
    deadline
  ]);

  console.log("\n  Step 2 - Buy WETH on SushiSwap (discounted):");
  console.log("    Target:", SUSHISWAP_ROUTER);
  console.log("    amountIn:", ethers.formatUnits(arbAmount, USDC_DECIMALS), "USDC");
  console.log("    path: USDC → WETH");
  console.log("    recipient:", vaultAddress);

  // ── Step 3: Approve WETH for Uniswap V3 ──
  const step3Calldata = erc20Interface.encodeFunctionData("approve", [
    UNISWAP_V3_ROUTER,
    maxUint256 // Approve max for flexibility
  ]);

  console.log("\n  Step 3 - Approve WETH for Uniswap V3:");
  console.log("    Target:", WETH_ADDRESS);
  console.log("    Amount: MAX_UINT256");

  // ── Step 4: Swap WETH → USDC on Uniswap V3 (Sell at Higher Price) ──
  // We need to estimate how much WETH we'll get from step 2
  const expectedWeth = postManipWethFor1000Usdc;

  const step4Params = {
    tokenIn: WETH_ADDRESS,
    tokenOut: USDC_ADDRESS,
    fee: FEE_TIER_005,
    recipient: vaultAddress,
    deadline: deadline,
    amountIn: expectedWeth, // Swap all WETH received
    amountOutMinimum: 0, // In production, use proper slippage
    sqrtPriceLimitX96: 0
  };

  const step4Calldata = uniV3Interface.encodeFunctionData("exactInputSingle", [step4Params]);

  console.log("\n  Step 4 - Sell WETH on Uniswap V3 (higher price):");
  console.log("    Target:", UNISWAP_V3_ROUTER);
  console.log("    amountIn:", ethers.formatEther(expectedWeth), "WETH");
  console.log("    path: WETH → USDC");
  console.log("    recipient:", vaultAddress);

  // Construct the execution arrays
  const targets = [
    USDC_ADDRESS,      // Step 1: Approve
    SUSHISWAP_ROUTER,  // Step 2: Buy WETH
    WETH_ADDRESS,      // Step 3: Approve
    UNISWAP_V3_ROUTER  // Step 4: Sell WETH
  ];

  const values = [0, 0, 0, 0]; // No ETH sent

  const calldatas = [
    step1Calldata,
    step2Calldata,
    step3Calldata,
    step4Calldata
  ];

  // ============================================================================
  // Validate Targets Against Whitelist
  // ============================================================================

  console.log("\n🔐 ACE Whitelist Validation:");
  for (let i = 0; i < targets.length; i++) {
    const isWhitelisted = whitelistedTargets.includes(targets[i]);
    console.log(`  Step ${i + 1}: ${targets[i]} - ${isWhitelisted ? "✅ WHITELISTED" : "❌ BLOCKED"}`);
    if (!isWhitelisted) {
      throw new Error(`Target ${targets[i]} is not whitelisted!`);
    }
  }

  // ============================================================================
  // TASK 5: Execute Arbitrage via CRE
  // ============================================================================

  console.log("\n" + "=".repeat(70));
  console.log("TASK 5: EXECUTING ARBITRAGE VIA CRE FORWARDER");
  console.log("=".repeat(70));

  // Record balances before
  const vaultUsdcBefore = await usdc.balanceOf(vaultAddress);
  const vaultWethBefore = await weth.balanceOf(vaultAddress);

  console.log("\n  📊 Pre-Execution Balances:");
  console.log("    Vault USDC:", ethers.formatUnits(vaultUsdcBefore, USDC_DECIMALS));
  console.log("    Vault WETH:", ethers.formatEther(vaultWethBefore));

  // Encode the report
  const executionReport = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address[]", "uint256[]", "bytes[]"],
    [1, targets, values, calldatas]
  );

  console.log("\n  🚀 Executing 4-step arbitrage...");
  console.log("    Payload size:", executionReport.length, "bytes");
  console.log("    Number of calls:", targets.length);

  // Execute via forwarder
  const executeTx = await forwarder.deliverReportSimple(vaultAddress, executionReport);
  const receipt = await executeTx.wait();

  console.log("    TX Hash:", executeTx.hash);
  console.log("    Gas Used:", receipt.gasUsed.toString());

  // ============================================================================
  // Assertions
  // ============================================================================

  console.log("\n" + "=".repeat(70));
  console.log("ASSERTIONS");
  console.log("=".repeat(70));

  // Get final balances
  const vaultUsdcAfter = await usdc.balanceOf(vaultAddress);
  const vaultWethAfter = await weth.balanceOf(vaultAddress);

  console.log("\n  📊 Post-Execution Balances:");
  console.log("    Vault USDC:", ethers.formatUnits(vaultUsdcAfter, USDC_DECIMALS));
  console.log("    Vault WETH:", ethers.formatEther(vaultWethAfter));

  // 1. Transaction was successful
  const txSuccess = receipt.status === 1;
  console.log("\n1. Transaction successful:", txSuccess ? "✅ YES" : "❌ NO");

  // 2. Vault USDC balance is STRICTLY GREATER than 1,000 USDC
  const initialDeposit = ethers.parseUnits("1000", USDC_DECIMALS);
  const madeProfit = vaultUsdcAfter > initialDeposit;
  const profitAmount = vaultUsdcAfter - initialDeposit;

  console.log("\n2. Vault USDC > 1,000 (PROFIT CHECK):");
  console.log("   Initial deposit:", ethers.formatUnits(initialDeposit, USDC_DECIMALS), "USDC");
  console.log("   Final balance:", ethers.formatUnits(vaultUsdcAfter, USDC_DECIMALS), "USDC");
  console.log("   Profit:", ethers.formatUnits(profitAmount, USDC_DECIMALS), "USDC");
  console.log("   Result:", madeProfit ? "✅ PROFIT GENERATED" : "❌ NO PROFIT");

  // 3. User can withdraw more than deposited
  console.log("\n3. User withdrawal test (ERC-4626 share value):");

  const userSharesBefore = await vault.balanceOf(user.address);
  console.log("   User shares:", ethers.formatUnits(userSharesBefore, USDC_DECIMALS));

  // Preview what user would get
  const previewAmount = await vault.previewRedeem(userSharesBefore);
  console.log("   Preview redeem:", ethers.formatUnits(previewAmount, USDC_DECIMALS), "USDC");

  // Actually withdraw
  const userUsdcBefore = await usdc.balanceOf(user.address);
  await vault.connect(user).withdraw(userSharesBefore);
  const userUsdcAfter = await usdc.balanceOf(user.address);

  const withdrawnAmount = userUsdcAfter - userUsdcBefore;
  const userProfit = withdrawnAmount > depositAmount;

  console.log("   Deposited:", ethers.formatUnits(depositAmount, USDC_DECIMALS), "USDC");
  console.log("   Withdrawn:", ethers.formatUnits(withdrawnAmount, USDC_DECIMALS), "USDC");
  console.log("   User profit:", ethers.formatUnits(withdrawnAmount - depositAmount, USDC_DECIMALS), "USDC");
  console.log("   Result:", userProfit ? "✅ USER RECEIVED MORE THAN DEPOSITED" : "❌ NO USER PROFIT");

  // 4. Job marked complete
  const job = await vault.getJob(1);
  const jobComplete = job.completed && job.success;
  console.log("\n4. Job marked complete:", jobComplete ? "✅ PASSED" : "❌ FAILED");

  // ============================================================================
  // Profit Analysis
  // ============================================================================

  console.log("\n" + "=".repeat(70));
  console.log("PROFIT ANALYSIS");
  console.log("=".repeat(70));

  const profitUsd = Number(ethers.formatUnits(withdrawnAmount - depositAmount, USDC_DECIMALS));
  const profitPercent = (profitUsd / 1000) * 100;

  console.log("\n  💰 Arbitrage Results:");
  console.log("    Initial capital:", "1,000 USDC");
  console.log("    Final value:", ethers.formatUnits(withdrawnAmount, USDC_DECIMALS), "USDC");
  console.log("    Gross profit:", profitUsd.toFixed(2), "USDC");
  console.log("    ROI:", profitPercent.toFixed(2), "%");
  console.log("    Gas cost:", ethers.formatEther(receipt.gasUsed * receipt.gasPrice), "ETH");

  // ============================================================================
  // Final Summary
  // ============================================================================

  console.log("\n" + "=".repeat(70));
  console.log("TEST SUMMARY");
  console.log("=".repeat(70));

  const allPassed = txSuccess && madeProfit && userProfit && jobComplete;

  console.log("\n  🎯 Multi-DEX Arbitrage: SushiSwap → Uniswap V3");
  console.log("\n  Results:");
  console.log("    [1] Transaction Success:           ", txSuccess ? "✅" : "❌");
  console.log("    [2] Vault USDC > 1000 (Profit):    ", madeProfit ? "✅" : "❌");
  console.log("    [3] User Withdrawal > Deposit:    ", userProfit ? "✅" : "❌");
  console.log("    [4] Job Marked Complete:          ", jobComplete ? "✅" : "❌");
  console.log("\n  " + "─".repeat(50));
  console.log("  OVERALL:", allPassed ? "✅ ALL TESTS PASSED - ARBITRAGE PROFITABLE!" : "❌ SOME TESTS FAILED");
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
