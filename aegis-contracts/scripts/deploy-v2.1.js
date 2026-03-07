/**
 * AEGIS Protocol V2.1 Deployment Script
 *
 * Deploys the Protocol-Agnostic Universal AI Executor:
 * - TrustedAgentRegistryV2 (agent registration + World ID + reputation)
 * - StrategyVaultV2 (universal executor with userPrompt)
 * - UnifiedExtractorV3 (ACE extractor with job data helpers)
 * - MockKeystoneForwarder (CRE simulation forwarder)
 *
 * Key change: requestStrategyJob now accepts userPrompt (natural language)
 */
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("=".repeat(70));
  console.log("AEGIS Protocol V2.1 Deployment");
  console.log("Protocol-Agnostic Universal AI Executor");
  console.log("=".repeat(70));
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("");

  // ============ Configuration ============

  // Mainnet addresses (Tenderly fork)
  const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
  const USDC_TOKEN = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const CCIP_ROUTER = "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D";

  // Controller and Treasury
  const CONTROLLER = deployer.address;
  const TREASURY = deployer.address;

  console.log("Configuration:");
  console.log("  LINK Token:", LINK_TOKEN);
  console.log("  USDC Token:", USDC_TOKEN);
  console.log("  CCIP Router:", CCIP_ROUTER);
  console.log("");

  // ============ Step 1: Deploy MockKeystoneForwarder ============

  console.log("Step 1: Deploying MockKeystoneForwarder...");
  const MockForwarder = await ethers.getContractFactory("MockKeystoneForwarder");
  const mockForwarder = await MockForwarder.deploy();
  await mockForwarder.waitForDeployment();
  const forwarderAddress = await mockForwarder.getAddress();
  console.log("  MockKeystoneForwarder:", forwarderAddress);
  console.log("");

  // ============ Step 2: Deploy AEGIS Token (MockERC20) ============

  console.log("Step 2: Deploying AEGIS Token...");
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const aegisToken = await MockERC20.deploy("AEGIS Token", "AEGIS", 18);
  await aegisToken.waitForDeployment();
  const aegisTokenAddress = await aegisToken.getAddress();
  console.log("  AEGIS Token:", aegisTokenAddress);

  // Mint AEGIS to deployer
  const mintTx = await aegisToken.mint(deployer.address, ethers.parseEther("1000000"));
  await mintTx.wait();
  console.log("  [OK] Minted 1,000,000 AEGIS to deployer");
  console.log("");

  // ============ Step 3: Deploy TrustedAgentRegistryV2 ============

  console.log("Step 3: Deploying TrustedAgentRegistryV2...");
  const RegistryV2 = await ethers.getContractFactory("TrustedAgentRegistryV2");
  const registryV2 = await RegistryV2.deploy(
    LINK_TOKEN,
    aegisTokenAddress,
    CCIP_ROUTER,
    forwarderAddress,
    CONTROLLER,
    TREASURY
  );
  await registryV2.waitForDeployment();
  const registryAddress = await registryV2.getAddress();
  console.log("  TrustedAgentRegistryV2:", registryAddress);
  console.log("");

  // ============ Step 4: Deploy StrategyVaultV2 ============

  console.log("Step 4: Deploying StrategyVaultV2 (Universal Executor)...");
  const StrategyVault = await ethers.getContractFactory("StrategyVaultV2");
  const strategyVault = await StrategyVault.deploy(
    forwarderAddress,  // CRE Forwarder
    USDC_TOKEN         // Base asset
  );
  await strategyVault.waitForDeployment();
  const vaultAddress = await strategyVault.getAddress();
  console.log("  StrategyVaultV2:", vaultAddress);
  console.log("");

  // ============ Step 5: Deploy UnifiedExtractorV3 ============

  console.log("Step 5: Deploying UnifiedExtractorV3 (ACE Extractor)...");
  const ExtractorV3 = await ethers.getContractFactory("UnifiedExtractorV3");
  const extractorV3 = await ExtractorV3.deploy(registryAddress);
  await extractorV3.waitForDeployment();
  const extractorAddress = await extractorV3.getAddress();
  console.log("  UnifiedExtractorV3:", extractorAddress);
  console.log("");

  // ============ Step 6: Configure Contracts ============

  console.log("Step 6: Configuring contracts...");

  // Set registry on vault
  console.log("  Setting registry on vault...");
  const setRegistryTx = await strategyVault.setRegistry(registryAddress);
  await setRegistryTx.wait();
  console.log("  [OK] Vault registry set");

  // Set strategy vault on extractor
  console.log("  Setting vault on extractor...");
  const setVaultTx = await extractorV3.setStrategyVault(vaultAddress);
  await setVaultTx.wait();
  console.log("  [OK] Extractor vault set");
  console.log("");

  // ============ Step 7: Fund Registry with AEGIS for Rewards ============

  console.log("Step 7: Funding reward pool...");
  const rewardAmount = ethers.parseEther("100000"); // 100,000 AEGIS

  const approveTx = await aegisToken.approve(registryAddress, rewardAmount);
  await approveTx.wait();
  console.log("  Approved AEGIS transfer");

  const depositTx = await registryV2.depositRewards(rewardAmount);
  await depositTx.wait();
  console.log("  [OK] Deposited 100,000 AEGIS to reward pool");
  console.log("");

  // ============ Step 8: Register Demo Agents ============

  console.log("Step 8: Registering demo AI agents...");

  // Create data URIs for agent metadata
  const agent1Metadata = {
    name: "OpenClaw-Alpha",
    description: "Protocol-agnostic DeFi strategy AI",
    category: "defi-executor",
    capabilities: ["swap", "liquidity", "yield", "lending"],
    apiEndpoint: "http://localhost:3000",
    version: "2.1.0",
    author: "AEGIS Protocol"
  };

  const agent2Metadata = {
    name: "OpenClaw-Beta",
    description: "Risk-aware DeFi optimizer",
    category: "defi-executor",
    capabilities: ["swap", "liquidity", "risk-analysis"],
    apiEndpoint: "http://localhost:3000",
    version: "2.1.0",
    author: "AEGIS Protocol"
  };

  const agent1URI = `data:application/json,${encodeURIComponent(JSON.stringify(agent1Metadata))}`;
  const agent2URI = `data:application/json,${encodeURIComponent(JSON.stringify(agent2Metadata))}`;

  // Register agents (mock World ID payload)
  const mockWorldIdPayload = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "uint256", "uint256", "uint256[8]"],
    [
      "0x1234567890abcdef",  // merkle_root
      "0xabcdef1234567890",  // nullifier_hash
      "0x9876543210fedcba",  // signal
      [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]  // proof
    ]
  );

  console.log("  Registering Agent 1 (OpenClaw-Alpha)...");
  const reg1Tx = await registryV2.registerAgent(agent1URI, mockWorldIdPayload);
  await reg1Tx.wait();
  console.log("  [OK] Agent 1 registered");

  console.log("  Registering Agent 2 (OpenClaw-Beta)...");
  const reg2Tx = await registryV2.registerAgent(agent2URI, mockWorldIdPayload);
  await reg2Tx.wait();
  console.log("  [OK] Agent 2 registered");

  // Note: Agent verification happens via CRE workflow (World ID)
  // For testing, we'll verify them manually using setAgentVerified
  console.log("  Verifying agents manually (testing mode)...");

  // Check if registry has setAgentVerified function (for testing)
  try {
    const verify1Tx = await registryV2.setAgentVerified(1, true);
    await verify1Tx.wait();
    console.log("  [OK] Agent 1 verified");

    const verify2Tx = await registryV2.setAgentVerified(2, true);
    await verify2Tx.wait();
    console.log("  [OK] Agent 2 verified");
  } catch (e) {
    console.log("  [!] Manual verification not available - agents will need CRE verification");
    console.log("      Use manuallyVerifyAgents.js script after deployment");
  }
  console.log("");

  // ============ Step 9: Fund Vault with USDC ============

  console.log("Step 9: Funding vault with USDC...");

  const usdc = await ethers.getContractAt("IERC20", USDC_TOKEN);
  const usdcBalance = await usdc.balanceOf(deployer.address);
  console.log("  Deployer USDC balance:", ethers.formatUnits(usdcBalance, 6), "USDC");

  if (usdcBalance > 0n) {
    const depositAmount = ethers.parseUnits("100000", 6); // 100,000 USDC
    const actualDeposit = usdcBalance < depositAmount ? usdcBalance : depositAmount;

    const approveUsdcTx = await usdc.approve(vaultAddress, actualDeposit);
    await approveUsdcTx.wait();

    const depositUsdcTx = await strategyVault.deposit(actualDeposit);
    await depositUsdcTx.wait();
    console.log("  [OK] Deposited", ethers.formatUnits(actualDeposit, 6), "USDC to vault");
  } else {
    console.log("  [!] No USDC available - vault will be empty");
  }
  console.log("");

  // ============ Deployment Summary ============

  console.log("=".repeat(70));
  console.log("DEPLOYMENT COMPLETE - AEGIS Protocol V2.1");
  console.log("=".repeat(70));
  console.log("");
  console.log("Contract Addresses:");
  console.log("  MockKeystoneForwarder:", forwarderAddress);
  console.log("  AEGIS Token:", aegisTokenAddress);
  console.log("  TrustedAgentRegistryV2:", registryAddress);
  console.log("  StrategyVaultV2:", vaultAddress);
  console.log("  UnifiedExtractorV3:", extractorAddress);
  console.log("  Base Asset (USDC):", USDC_TOKEN);
  console.log("");
  console.log("Verified Agents:");
  console.log("  Agent 1: OpenClaw-Alpha (ID: 1)");
  console.log("  Agent 2: OpenClaw-Beta (ID: 2)");
  console.log("");
  console.log("New Feature: userPrompt (Natural Language)");
  console.log("  requestStrategyJob(uint256[] agentIds, string userPrompt)");
  console.log("  Example: 'Swap 500 USDC for WETH using Uniswap V3'");
  console.log("");
  console.log("Update config files:");
  console.log("  - aegis-cre/council-workflow/config.json");
  console.log("  - aegis-frontend/src/lib/constants.ts");
  console.log("=".repeat(70));

  return {
    forwarder: forwarderAddress,
    aegisToken: aegisTokenAddress,
    registry: registryAddress,
    vault: vaultAddress,
    extractor: extractorAddress,
    usdc: USDC_TOKEN,
  };
}

main()
  .then((addresses) => {
    console.log("\nExport for config:");
    console.log(JSON.stringify(addresses, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
