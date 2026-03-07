/**
 * Create a Cross-DEX Arbitrage Strategy Job
 *
 * Uses agents 1 & 2 (both verified, good agents) to execute:
 * 1. Buy WETH cheap on Uniswap V3 (~$2000)
 * 2. Sell WETH expensive on SushiSwap (~$2200)
 * 3. Pocket the ~10% profit
 */

const { ethers } = require("hardhat");

async function main() {
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const AGENTS = [1, 2]; // Good agents only (no dissenter)

  const [deployer] = await ethers.getSigners();
  console.log("Creating arbitrage job from:", deployer.address);

  const vault = await ethers.getContractAt("StrategyVaultV2", VAULT);
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const usdcContract = await ethers.getContractAt("IERC20", USDC);

  // Check vault balance
  const vaultBalance = await usdcContract.balanceOf(VAULT);
  console.log(`\nVault USDC Balance: ${ethers.formatUnits(vaultBalance, 6)} USDC`);

  // Check agent states
  console.log("\n=== Agent States ===");
  for (const agentId of AGENTS) {
    const agent = await registry.agents(agentId);
    console.log(`  Agent ${agentId}: verified=${agent.verified}, stake=${ethers.formatEther(agent.stake)} LINK, rep=${agent.reputation}`);
  }

  // Create the arbitrage job
  console.log("\n=== Creating Cross-DEX Arbitrage Job ===");
  const userPrompt = "Execute a cross-DEX arbitrage between Uniswap V3 and SushiSwap";

  const tx = await vault.requestStrategyJob(AGENTS, userPrompt);
  const receipt = await tx.wait();

  // Find StrategyJobCreated event
  const jobCreatedEvent = receipt.logs.find(log => {
    try {
      return vault.interface.parseLog(log)?.name === "StrategyJobCreated";
    } catch {
      return false;
    }
  });

  let jobId;
  if (jobCreatedEvent) {
    const parsed = vault.interface.parseLog(jobCreatedEvent);
    jobId = parsed.args.jobId;
    console.log(`\nJob created successfully!`);
    console.log(`  Job ID: ${jobId}`);
    console.log(`  Agents: [${parsed.args.agentIds.join(", ")}]`);
    console.log(`  Prompt: "${userPrompt}"`);
    console.log(`  TX Hash: ${receipt.hash}`);
  } else {
    jobId = await vault.nextJobId() - 1n;
    console.log(`Job created! TX: ${receipt.hash}`);
    console.log(`  Job ID: ${jobId}`);
  }

  console.log("\n=== Arbitrage Strategy ===");
  console.log("The AI agents will execute a 4-step atomic arbitrage:");
  console.log("  Step 1: Approve USDC for Uniswap V3 Router");
  console.log("  Step 2: Swap USDC -> WETH on Uniswap V3 (buy at ~$2000)");
  console.log("  Step 3: Approve WETH for SushiSwap Router");
  console.log("  Step 4: Swap WETH -> USDC on SushiSwap (sell at ~$2200)");
  console.log("\nExpected profit: ~10% (~$200 per ETH traded)");

  console.log("\n=== Ready for CRE Council Workflow ===");
  console.log("Run the following command:\n");
  console.log(`  cd /xdata/chainlinkhackathone/aegis-cre && cre workflow simulate ./council-workflow --target local-simulation --evm-tx-hash ${receipt.hash} --non-interactive --trigger-index 0 --evm-event-index 0 --broadcast\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
