/**
 * AEGIS V2.1 - Cross-DEX Arbitrage Test
 *
 * Creates a job with prompt: "Execute a cross-DEX arbitrage between Uniswap V3 and SushiSwap"
 * The CRE workflow will detect this and return a 4-step atomic execution:
 *   1. Approve USDC for Uniswap V3
 *   2. Swap USDC -> WETH on Uniswap V3
 *   3. Approve WETH for SushiSwap V2
 *   4. Swap WETH -> USDC on SushiSwap V2
 *
 * NOTE: For video demo, manipulate Tenderly state to create artificial arbitrage opportunity
 */
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  // Contract addresses
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";

  console.log("=".repeat(70));
  console.log("AEGIS V2.1 - Cross-DEX Arbitrage Test");
  console.log("=".repeat(70));
  console.log("Deployer:", deployer.address);
  console.log("Vault:", VAULT);
  console.log("Registry:", REGISTRY);
  console.log();

  // Get contract instances
  const vault = await ethers.getContractAt("StrategyVaultV2", VAULT);
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);

  // Check current state
  const nextJobId = await vault.nextJobId();
  const totalAssets = await vault.totalAssets();
  console.log("=== Current State ===");
  console.log("Next Job ID:", nextJobId.toString());
  console.log("Total Vault Assets:", ethers.formatUnits(totalAssets, 6), "USDC");
  console.log();

  // Verify agents
  console.log("=== Agent Verification ===");
  for (const agentId of [1, 2]) {
    const agent = await registry.getAgent(agentId);
    console.log(`Agent ${agentId}:`);
    console.log(`  Verified: ${agent.verified}`);
    console.log(`  Reputation: ${agent.reputation}`);
    console.log(`  Stake: ${ethers.formatEther(agent.stake)} LINK`);
  }
  console.log();

  // Create arbitrage job
  console.log("=== Creating Arbitrage Job ===");
  const userPrompt = "Execute a cross-DEX arbitrage between Uniswap V3 and SushiSwap";
  const agentIds = [1, 2];

  console.log("User Prompt:", `"${userPrompt}"`);
  console.log("Agent IDs:", agentIds);

  const tx = await vault.requestStrategyJob(agentIds, userPrompt);
  console.log("TX Hash:", tx.hash);

  const receipt = await tx.wait();
  console.log("TX confirmed in block:", receipt.blockNumber);
  console.log();

  // Parse the StrategyJobCreated event
  const jobCreatedEvent = receipt.logs.find(log => {
    try {
      return vault.interface.parseLog(log)?.name === "StrategyJobCreated";
    } catch {
      return false;
    }
  });

  if (jobCreatedEvent) {
    const parsed = vault.interface.parseLog(jobCreatedEvent);
    const jobId = parsed.args.jobId;
    console.log("=== Job Created Successfully ===");
    console.log("Job ID:", jobId.toString());
    console.log();

    // Get job details
    const job = await vault.getJob(jobId);
    console.log("=== On-Chain Job Data ===");
    console.log("Agent IDs:", job.agentIds.map(id => id.toString()).join(", "));
    console.log("Proposer:", job.proposer);
    console.log("Created At:", new Date(Number(job.createdAt) * 1000).toISOString());
    console.log("Completed:", job.completed);
    console.log("User Prompt:", job.userPrompt);
  }

  console.log();
  console.log("=".repeat(70));
  console.log("CRE WORKFLOW COMMAND");
  console.log("=".repeat(70));
  console.log();
  console.log("Run this command to execute the CRE council workflow:");
  console.log();
  console.log(`cd /xdata/chainlinkhackathone/aegis-cre && \\`);
  console.log(`cre workflow simulate ./council-workflow --target local-simulation \\`);
  console.log(`  --evm-tx-hash ${tx.hash} \\`);
  console.log(`  --non-interactive --trigger-index 0 --evm-event-index 0 --broadcast`);
  console.log();
  console.log("=".repeat(70));
  console.log();
  console.log("EXPECTED 4-STEP EXECUTION:");
  console.log("  Step 1: Approve USDC for Uniswap V3 Router");
  console.log("  Step 2: Swap USDC -> WETH on Uniswap V3 (0.05% pool)");
  console.log("  Step 3: Approve WETH for SushiSwap V2 Router");
  console.log("  Step 4: Swap WETH -> USDC on SushiSwap V2");
  console.log();
  console.log("TARGETS:");
  console.log("  [0] USDC:              0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
  console.log("  [1] Uniswap V3 Router: 0xE592427A0AEce92De3Edee1F18E0157C05861564");
  console.log("  [2] WETH:              0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2");
  console.log("  [3] SushiSwap Router:  0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
  console.log();
  console.log("=".repeat(70));
}

main()
  .then(() => {
    console.log("\n[SUCCESS] Arbitrage job created!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n[ERROR]", error);
    process.exit(1);
  });
