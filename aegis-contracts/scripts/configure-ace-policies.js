/**
 * Configure Already-Deployed ACE Policy Contracts
 *
 * Contract addresses from previous deployment:
 * - TargetWhitelistPolicy: 0x4e8AE4901AcADB406b2022450A20a4CfC3b13d9b
 * - TargetBlacklistPolicy: 0x430036d589B95AD5c5bD442C05411A572ea7Ab93
 * - VolumeLimitPolicy: 0xA410dD183beeFee8ebf8e8175ff49eaEb3483D47
 * - ACEPolicyEngine: 0xCF2F38772b578A61681DD128EDd5c05cb3872634
 */
const { ethers } = require("hardhat");

// Deployed ACE Policy addresses
const ACE_CONTRACTS = {
  WHITELIST: "0x4e8AE4901AcADB406b2022450A20a4CfC3b13d9b",
  BLACKLIST: "0x430036d589B95AD5c5bD442C05411A572ea7Ab93",
  VOLUME: "0xA410dD183beeFee8ebf8e8175ff49eaEb3483D47",
  ENGINE: "0xCF2F38772b578A61681DD128EDd5c05cb3872634",
};

// Ethereum Mainnet DeFi Protocol Addresses
const WHITELIST_TARGETS = [
  // Tokens
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
  "0x6B175474E89094C44Da98b954EecdeCB5BE3d2d",  // DAI
  "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT

  // DEX Routers
  "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router
  "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Uniswap V3 Router02
  "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", // SushiSwap Router

  // Lending
  "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Aave V3 Pool
  "0xc3d688B66703497DAA19211EEdff47f25384cdc3", // Compound V3 USDC

  // Other
  "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6", // Uniswap V3 Quoter
];

// Known malicious/sanctioned addresses (OFAC Tornado Cash)
const BLACKLIST_TARGETS = [
  "0x8589427373D6D84E98730D7795D8f6f8731FDA16",
  "0x722122dF12D4e14e13Ac3b6895a86e84145b6967",
  "0xDD4c48C0B24039969fC16D1cdF626eaB821d3384",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=".repeat(70));
  console.log("Configuring ACE Policy Contracts");
  console.log("=".repeat(70));
  console.log("Deployer:", deployer.address);
  console.log();

  // Get contract instances
  const whitelistPolicy = await ethers.getContractAt(
    "TargetWhitelistPolicy",
    ACE_CONTRACTS.WHITELIST,
    deployer
  );

  const blacklistPolicy = await ethers.getContractAt(
    "TargetBlacklistPolicy",
    ACE_CONTRACTS.BLACKLIST,
    deployer
  );

  const policyEngine = await ethers.getContractAt(
    "ACEPolicyEngine",
    ACE_CONTRACTS.ENGINE,
    deployer
  );

  // ========================================
  // STEP 1: Configure Whitelist
  // ========================================
  console.log("1. Configuring Whitelist Policy...");

  // Filter to valid addresses only
  const validWhitelistTargets = WHITELIST_TARGETS.filter(addr => {
    try {
      return ethers.isAddress(addr);
    } catch {
      console.log("   Invalid address skipped:", addr);
      return false;
    }
  });

  console.log("   Adding", validWhitelistTargets.length, "addresses...");
  const tx1 = await whitelistPolicy.addWhitelistedAddresses(validWhitelistTargets);
  await tx1.wait();
  console.log("   [OK] Whitelist configured");

  // ========================================
  // STEP 2: Configure Blacklist
  // ========================================
  console.log("\n2. Configuring Blacklist Policy...");
  const tx2 = await blacklistPolicy.addBlacklistedAddresses(BLACKLIST_TARGETS);
  await tx2.wait();
  console.log("   [OK] Blacklist configured with", BLACKLIST_TARGETS.length, "addresses");

  // ========================================
  // STEP 3: Configure Policy Engine
  // ========================================
  console.log("\n3. Configuring ACE Policy Engine...");
  const tx3 = await policyEngine.configureAll(
    ACE_CONTRACTS.WHITELIST,  // whitelist policy
    ACE_CONTRACTS.BLACKLIST,  // blacklist policy
    ACE_CONTRACTS.VOLUME,     // volume policy
    true,                      // enable whitelist
    true,                      // enable blacklist
    false                      // disable volume (max uint256 for testing)
  );
  await tx3.wait();
  console.log("   [OK] Policy Engine configured");
  console.log("   - Whitelist: ENABLED");
  console.log("   - Blacklist: ENABLED");
  console.log("   - Volume: DISABLED (max uint256)");

  // ========================================
  // STEP 4: Verify Configuration
  // ========================================
  console.log("\n4. Verifying Configuration...");

  const whitelistCount = await whitelistPolicy.getWhitelistCount();
  console.log("   Whitelist count:", whitelistCount.toString());

  const blacklistCount = await blacklistPolicy.getBlacklistCount();
  console.log("   Blacklist count:", blacklistCount.toString());

  const isUsdcWhitelisted = await whitelistPolicy.isWhitelisted("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  console.log("   USDC whitelisted:", isUsdcWhitelisted);

  const isUniswapWhitelisted = await whitelistPolicy.isWhitelisted("0xE592427A0AEce92De3Edee1F18E0157C05861564");
  console.log("   Uniswap V3 Router whitelisted:", isUniswapWhitelisted);

  // Test validation
  console.log("\n5. Testing Validation...");
  const testTargets = [
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    "0xE592427A0AEce92De3Edee1F18E0157C05861564"  // Uniswap
  ];
  const testValues = [0, 0];

  try {
    const result = await policyEngine.validateExecution(testTargets, testValues);
    console.log("   [OK] Validation passed:", result);
  } catch (error) {
    console.log("   [FAIL] Validation failed:", error.message);
  }

  // ========================================
  // SUMMARY
  // ========================================
  console.log("\n" + "=".repeat(70));
  console.log("ACE POLICY CONFIGURATION COMPLETE");
  console.log("=".repeat(70));
  console.log("\nContract Addresses:");
  console.log("  TargetWhitelistPolicy:", ACE_CONTRACTS.WHITELIST);
  console.log("  TargetBlacklistPolicy:", ACE_CONTRACTS.BLACKLIST);
  console.log("  VolumeLimitPolicy:", ACE_CONTRACTS.VOLUME);
  console.log("  ACEPolicyEngine:", ACE_CONTRACTS.ENGINE);

  console.log("\nConfiguration:");
  console.log("  Whitelisted Protocols:", whitelistCount.toString());
  console.log("  Blacklisted Addresses:", blacklistCount.toString());
  console.log("  Volume Limit: type(uint256).max (disabled)");
}

main()
  .then(() => {
    console.log("\n[SUCCESS] Configuration complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n[ERROR]", error);
    process.exit(1);
  });
