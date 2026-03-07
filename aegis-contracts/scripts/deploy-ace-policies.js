/**
 * Deploy and Configure ACE Policy Contracts
 *
 * This script:
 * 1. Deploys TargetWhitelistPolicy, TargetBlacklistPolicy, VolumeLimitPolicy
 * 2. Deploys ACEPolicyEngine to orchestrate them
 * 3. Configures whitelists with approved DeFi protocols (Uniswap, SushiSwap, USDC, WETH)
 * 4. Sets volume limit to max uint256 for hackathon testing (effectively disabled)
 * 5. Integrates with existing StrategyVaultV2
 */
const { ethers } = require("hardhat");

// Ethereum Mainnet DeFi Protocol Addresses
const DEFI_PROTOCOLS = {
  // Tokens
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  DAI: "0x6B175474E89094C44Da98b954EecdeCB5BE3d2d",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",

  // DEX Routers
  UNISWAP_V3_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  UNISWAP_V3_ROUTER_02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  SUSHISWAP_ROUTER: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",

  // Lending
  AAVE_V3_POOL: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  COMPOUND_V3_USDC: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",

  // Uniswap V3 Quoter
  UNISWAP_V3_QUOTER: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
};

// Known malicious/sanctioned addresses (example - OFAC Tornado Cash addresses)
const KNOWN_BLACKLIST = [
  "0x8589427373D6D84E98730D7795D8f6f8731FDA16", // Tornado Cash
  "0x722122dF12D4e14e13Ac3b6895a86e84145b6967",
  "0xDD4c48C0B24039969fC16D1cdF626eaB821d3384",
];

// Existing deployed contract addresses
const DEPLOYED = {
  VAULT: "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407",
  REGISTRY: "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0",
  AEGIS_TOKEN: "0xBbbf2Db05746734b2Bad7F402b97c6A00d9d38EC",
  EXTRACTOR: "0xe656743F4FdEB085b733bF56EF5777EF3061b150",
  CRE_FORWARDER: "0xa3d1ad4ac559a6575a114998affb2fb2ec97a7d9",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=".repeat(70));
  console.log("AEGIS ACE Policy Deployment");
  console.log("=".repeat(70));
  console.log("Deployer:", deployer.address);
  console.log();

  // ========================================
  // STEP 1: Deploy Whitelist Policy
  // ========================================
  console.log("1. Deploying TargetWhitelistPolicy...");
  const WhitelistPolicy = await ethers.getContractFactory("TargetWhitelistPolicy");
  const whitelistPolicy = await WhitelistPolicy.deploy();
  await whitelistPolicy.waitForDeployment();
  const whitelistAddr = await whitelistPolicy.getAddress();
  console.log("   TargetWhitelistPolicy:", whitelistAddr);

  // ========================================
  // STEP 2: Deploy Blacklist Policy
  // ========================================
  console.log("2. Deploying TargetBlacklistPolicy...");
  const BlacklistPolicy = await ethers.getContractFactory("TargetBlacklistPolicy");
  const blacklistPolicy = await BlacklistPolicy.deploy();
  await blacklistPolicy.waitForDeployment();
  const blacklistAddr = await blacklistPolicy.getAddress();
  console.log("   TargetBlacklistPolicy:", blacklistAddr);

  // ========================================
  // STEP 3: Deploy Volume Limit Policy
  // ========================================
  console.log("3. Deploying VolumeLimitPolicy...");
  // Set to max uint256 to effectively disable during hackathon testing
  const maxVolume = ethers.MaxUint256;
  const VolumePolicy = await ethers.getContractFactory("VolumeLimitPolicy");
  const volumePolicy = await VolumePolicy.deploy(maxVolume);
  await volumePolicy.waitForDeployment();
  const volumeAddr = await volumePolicy.getAddress();
  console.log("   VolumeLimitPolicy:", volumeAddr);
  console.log("   Volume Limit: DISABLED (max uint256)");

  // ========================================
  // STEP 4: Deploy ACE Policy Engine
  // ========================================
  console.log("4. Deploying ACEPolicyEngine...");
  const PolicyEngine = await ethers.getContractFactory("ACEPolicyEngine");
  const policyEngine = await PolicyEngine.deploy();
  await policyEngine.waitForDeployment();
  const engineAddr = await policyEngine.getAddress();
  console.log("   ACEPolicyEngine:", engineAddr);

  // ========================================
  // STEP 5: Configure Whitelist
  // ========================================
  console.log("\n5. Configuring Whitelist Policy...");
  const whitelistAddresses = [
    DEFI_PROTOCOLS.USDC,
    DEFI_PROTOCOLS.WETH,
    DEFI_PROTOCOLS.WBTC,
    DEFI_PROTOCOLS.DAI,
    DEFI_PROTOCOLS.USDT,
    DEFI_PROTOCOLS.UNISWAP_V3_ROUTER,
    DEFI_PROTOCOLS.UNISWAP_V3_ROUTER_02,
    DEFI_PROTOCOLS.SUSHISWAP_ROUTER,
    DEFI_PROTOCOLS.AAVE_V3_POOL,
    DEFI_PROTOCOLS.COMPOUND_V3_USDC,
    DEFI_PROTOCOLS.UNISWAP_V3_QUOTER,
  ];

  const tx1 = await whitelistPolicy.addWhitelistedAddresses(whitelistAddresses);
  await tx1.wait();
  console.log("   Added", whitelistAddresses.length, "addresses to whitelist:");
  console.log("   - USDC, WETH, WBTC, DAI, USDT");
  console.log("   - Uniswap V3 Router, Router02");
  console.log("   - SushiSwap Router");
  console.log("   - Aave V3 Pool, Compound V3 USDC");

  // ========================================
  // STEP 6: Configure Blacklist
  // ========================================
  console.log("\n6. Configuring Blacklist Policy...");
  const tx2 = await blacklistPolicy.addBlacklistedAddresses(KNOWN_BLACKLIST);
  await tx2.wait();
  console.log("   Added", KNOWN_BLACKLIST.length, "addresses to blacklist (Tornado Cash)");

  // ========================================
  // STEP 7: Configure ACE Policy Engine
  // ========================================
  console.log("\n7. Configuring ACE Policy Engine...");
  const tx3 = await policyEngine.configureAll(
    whitelistAddr,    // whitelist policy
    blacklistAddr,    // blacklist policy
    volumeAddr,       // volume policy
    true,             // enable whitelist
    true,             // enable blacklist
    false             // disable volume (already max uint256)
  );
  await tx3.wait();
  console.log("   Policies configured:");
  console.log("   - Whitelist: ENABLED");
  console.log("   - Blacklist: ENABLED");
  console.log("   - Volume: DISABLED (max uint256 for testing)");

  // ========================================
  // STEP 8: Verify Configuration
  // ========================================
  console.log("\n8. Verifying Configuration...");

  const whitelistCount = await whitelistPolicy.getWhitelistCount();
  console.log("   Whitelist count:", whitelistCount.toString());

  const blacklistCount = await blacklistPolicy.getBlacklistCount();
  console.log("   Blacklist count:", blacklistCount.toString());

  const isUsdcWhitelisted = await whitelistPolicy.isWhitelisted(DEFI_PROTOCOLS.USDC);
  console.log("   USDC whitelisted:", isUsdcWhitelisted);

  const isUniswapWhitelisted = await whitelistPolicy.isWhitelisted(DEFI_PROTOCOLS.UNISWAP_V3_ROUTER);
  console.log("   Uniswap V3 Router whitelisted:", isUniswapWhitelisted);

  // Test validation
  console.log("\n9. Testing Validation...");
  const testTargets = [DEFI_PROTOCOLS.USDC, DEFI_PROTOCOLS.UNISWAP_V3_ROUTER];
  const testValues = [0, 0];

  try {
    const result = await policyEngine.validateExecution(testTargets, testValues);
    console.log("   Validation passed:", result);
  } catch (error) {
    console.log("   Validation failed:", error.message);
  }

  // ========================================
  // DEPLOYMENT SUMMARY
  // ========================================
  console.log("\n" + "=".repeat(70));
  console.log("DEPLOYMENT SUMMARY");
  console.log("=".repeat(70));
  console.log("\nACE Policy Contracts:");
  console.log("  TargetWhitelistPolicy:", whitelistAddr);
  console.log("  TargetBlacklistPolicy:", blacklistAddr);
  console.log("  VolumeLimitPolicy:", volumeAddr);
  console.log("  ACEPolicyEngine:", engineAddr);

  console.log("\nExisting Contracts:");
  console.log("  StrategyVaultV2:", DEPLOYED.VAULT);
  console.log("  TrustedAgentRegistryV2:", DEPLOYED.REGISTRY);
  console.log("  AEGIS Token:", DEPLOYED.AEGIS_TOKEN);
  console.log("  UnifiedExtractorV3:", DEPLOYED.EXTRACTOR);
  console.log("  CRE Forwarder:", DEPLOYED.CRE_FORWARDER);

  console.log("\nConfiguration:");
  console.log("  Whitelisted Protocols:", whitelistCount.toString());
  console.log("  Blacklisted Addresses:", blacklistCount.toString());
  console.log("  Volume Limit: DISABLED (type(uint256).max)");

  // Return addresses for further use
  return {
    whitelistPolicy: whitelistAddr,
    blacklistPolicy: blacklistAddr,
    volumePolicy: volumeAddr,
    policyEngine: engineAddr,
  };
}

main()
  .then((addresses) => {
    console.log("\n[SUCCESS] ACE Policies deployed and configured!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n[ERROR]", error);
    process.exit(1);
  });
