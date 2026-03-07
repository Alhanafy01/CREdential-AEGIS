const { ethers } = require("hardhat");

async function main() {
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const vault = await ethers.getContractAt("StrategyVaultV2", VAULT);

  const latestBlock = await ethers.provider.getBlockNumber();
  console.log("Latest block:", latestBlock);
  console.log("\n=== REGISTRY EVENTS (last 100 blocks) ===");

  // Get Registry events
  const fromBlock = latestBlock - 100;

  // ReputationChanged events
  const repEvents = await registry.queryFilter(registry.filters.ReputationChanged(), fromBlock, latestBlock);
  console.log("\nReputationChanged events:", repEvents.length);
  for (const e of repEvents) {
    const args = e.args;
    console.log(`  Agent ${args.agentId}: reputation=${args.newReputation}, delta=${args.delta}, tx=${e.transactionHash.slice(0,18)}...`);
  }

  // AgentSlashed events
  const slashEvents = await registry.queryFilter(registry.filters.AgentSlashed(), fromBlock, latestBlock);
  console.log("\nAgentSlashed events:", slashEvents.length);
  for (const e of slashEvents) {
    const args = e.args;
    console.log(`  Agent ${args.agentId}: slashAmount=${ethers.formatEther(args.slashAmount)} LINK, repPenalty=${args.reputationPenalty}, tx=${e.transactionHash.slice(0,18)}...`);
  }

  // AgentRewarded events
  const rewardEvents = await registry.queryFilter(registry.filters.AgentRewarded(), fromBlock, latestBlock);
  console.log("\nAgentRewarded events:", rewardEvents.length);
  for (const e of rewardEvents) {
    const args = e.args;
    console.log(`  Agent ${args.agentId}: aegisAmount=${ethers.formatEther(args.aegisAmount)} AEGIS, tx=${e.transactionHash.slice(0,18)}...`);
  }

  console.log("\n=== VAULT EVENTS (last 100 blocks) ===");

  // StrategyJobCreated events
  const jobEvents = await vault.queryFilter(vault.filters.StrategyJobCreated(), fromBlock, latestBlock);
  console.log("\nStrategyJobCreated events:", jobEvents.length);
  for (const e of jobEvents) {
    const args = e.args;
    console.log(`  Job ${args.jobId}: proposer=${args.proposer.slice(0,10)}..., agents=[${args.agentIds.join(',')}], tx=${e.transactionHash.slice(0,18)}...`);
  }

  // StrategyExecuted events
  const execEvents = await vault.queryFilter(vault.filters.StrategyExecuted(), fromBlock, latestBlock);
  console.log("\nStrategyExecuted events:", execEvents.length);
  for (const e of execEvents) {
    const args = e.args;
    console.log(`  Job ${args.jobId}: success=${args.success}, tx=${e.transactionHash.slice(0,18)}...`);
  }

  console.log("\n=== SUMMARY ===");
  console.log("Total report-related transactions:");
  console.log("  - Reputation changes:", repEvents.length);
  console.log("  - Slashes:", slashEvents.length);
  console.log("  - Rewards:", rewardEvents.length);
  console.log("  - Strategy executions:", execEvents.length);
  console.log("  - Job creations:", jobEvents.length);
}

main().catch(console.error);
