const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // CRE Simulation Forwarder Address for Ethereum Mainnet
  // This is the official Chainlink Simulation Forwarder that CRE uses to write reports on-chain
  const SIMULATION_FORWARDER = "0xa3d1ad4ac559a6575a114998affb2fb2ec97a7d9";

  // Allow override via env var for other networks
  const CRE_FORWARDER = process.env.CRE_FORWARDER_ADDRESS
    ? hre.ethers.getAddress(process.env.CRE_FORWARDER_ADDRESS.toLowerCase())
    : SIMULATION_FORWARDER;

  // Default policy limits (can be adjusted)
  const MAX_TRANSACTION_AMOUNT = hre.ethers.parseEther("10000"); // 10,000 tokens
  const MAX_DAILY_VOLUME = hre.ethers.parseEther("100000"); // 100,000 tokens per day

  console.log("=".repeat(70));
  console.log("AEGIS CONTRACT DEPLOYMENT - PHASE 1.5");
  console.log("=".repeat(70));
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("CRE Forwarder Address:", CRE_FORWARDER);
  console.log("");

  // ============================================================
  // STEP 1: Deploy MockERC20 (Staking Token)
  // ============================================================
  console.log("STEP 1: Deploying MockERC20 (Staking Token)...");
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const stakingToken = await MockERC20.deploy("Aegis Staking Token", "AEGIS", 18);
  await stakingToken.waitForDeployment();
  const stakingTokenAddress = await stakingToken.getAddress();
  console.log("✅ MockERC20 deployed to:", stakingTokenAddress);
  console.log("");

  // ============================================================
  // STEP 2: Deploy UnifiedExtractor (ACE Routing)
  // ============================================================
  console.log("STEP 2: Deploying UnifiedExtractor...");
  const UnifiedExtractor = await hre.ethers.getContractFactory("UnifiedExtractor");
  const unifiedExtractor = await UnifiedExtractor.deploy();
  await unifiedExtractor.waitForDeployment();
  const unifiedExtractorAddress = await unifiedExtractor.getAddress();
  console.log("✅ UnifiedExtractor deployed to:", unifiedExtractorAddress);
  console.log("");

  // ============================================================
  // STEP 3: Deploy SimplePolicyEngine (ACE Rules)
  // ============================================================
  console.log("STEP 3: Deploying SimplePolicyEngine...");
  const SimplePolicyEngine = await hre.ethers.getContractFactory("SimplePolicyEngine");
  const policyEngine = await SimplePolicyEngine.deploy(
    unifiedExtractorAddress,
    MAX_TRANSACTION_AMOUNT,
    MAX_DAILY_VOLUME
  );
  await policyEngine.waitForDeployment();
  const policyEngineAddress = await policyEngine.getAddress();
  console.log("✅ SimplePolicyEngine deployed to:", policyEngineAddress);
  console.log("   - Max Transaction:", hre.ethers.formatEther(MAX_TRANSACTION_AMOUNT), "tokens");
  console.log("   - Max Daily Volume:", hre.ethers.formatEther(MAX_DAILY_VOLUME), "tokens");
  console.log("");

  // ============================================================
  // STEP 4: Deploy TrustedAgentRegistry (with CRE Forwarder)
  // ============================================================
  console.log("STEP 4: Deploying TrustedAgentRegistry...");
  console.log("⚠️  CRITICAL: Using CRE Forwarder:", CRE_FORWARDER);
  const controller = deployer.address; // Or governance contract
  const treasury = deployer.address; // Receives slashed funds

  const TrustedAgentRegistry = await hre.ethers.getContractFactory("TrustedAgentRegistry");
  const registry = await TrustedAgentRegistry.deploy(
    stakingTokenAddress,
    CRE_FORWARDER,  // Chainlink Simulation Forwarder for CRE report reception
    controller,
    treasury
  );
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ TrustedAgentRegistry deployed to:", registryAddress);
  console.log("   - Staking Token:", stakingTokenAddress);
  console.log("   - CRE Forwarder:", CRE_FORWARDER);
  console.log("   - Controller:", controller);
  console.log("   - Treasury:", treasury);
  console.log("");

  // ============================================================
  // STEP 5: Deploy StrategyVault (with CRE Forwarder)
  // ============================================================
  console.log("STEP 5: Deploying StrategyVault...");
  console.log("⚠️  CRITICAL: Using CRE Forwarder:", CRE_FORWARDER);

  const StrategyVault = await hre.ethers.getContractFactory("StrategyVault");
  const vault = await StrategyVault.deploy(CRE_FORWARDER, stakingTokenAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ StrategyVault deployed to:", vaultAddress);
  console.log("");

  // ============================================================
  // DEPLOYMENT SUMMARY
  // ============================================================
  console.log("=".repeat(70));
  console.log("DEPLOYMENT COMPLETE - SAVE THESE ADDRESSES FOR PHASE 2");
  console.log("=".repeat(70));
  console.log("");
  console.log("CONTRACT ADDRESSES:");
  console.log("-------------------");
  console.log(`MockERC20 (Staking):     ${stakingTokenAddress}`);
  console.log(`UnifiedExtractor:        ${unifiedExtractorAddress}`);
  console.log(`SimplePolicyEngine:      ${policyEngineAddress}`);
  console.log(`TrustedAgentRegistry:    ${registryAddress}`);
  console.log(`StrategyVault:           ${vaultAddress}`);
  console.log("");
  console.log("CRE CONFIGURATION:");
  console.log("------------------");
  console.log(`CRE Forwarder:           ${CRE_FORWARDER}`);
  console.log("");
  console.log("NEXT STEPS:");
  console.log("-----------");
  console.log("1. Update CRE config.json with contract addresses");
  console.log("2. Update frontend constants with new addresses");
  console.log("3. Test with: cre workflow simulate --broadcast");
  console.log("");

  // Return addresses as JSON for programmatic use
  const addresses = {
    network: hre.network.name,
    deployer: deployer.address,
    contracts: {
      MockERC20: stakingTokenAddress,
      UnifiedExtractor: unifiedExtractorAddress,
      SimplePolicyEngine: policyEngineAddress,
      TrustedAgentRegistry: registryAddress,
      StrategyVault: vaultAddress,
    },
    config: {
      CRE_Forwarder: CRE_FORWARDER,
      maxTransactionAmount: MAX_TRANSACTION_AMOUNT.toString(),
      maxDailyVolume: MAX_DAILY_VOLUME.toString(),
    }
  };

  console.log("=".repeat(70));
  console.log("ADDRESSES (JSON):");
  console.log("=".repeat(70));
  console.log(JSON.stringify(addresses, null, 2));

  return addresses;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
