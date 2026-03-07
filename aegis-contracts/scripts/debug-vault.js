const { ethers } = require("hardhat");

async function main() {
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";

  const vault = await ethers.getContractAt("StrategyVaultV2", VAULT);
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);

  console.log("=== Vault State ===");
  console.log("Vault address:", VAULT);

  // Check pause state
  try {
    const paused = await vault.paused();
    console.log("Vault paused:", paused);
  } catch(e) {
    console.log("No paused() function or error:", e.message);
  }

  // Check registry
  const vaultRegistry = await vault.registry();
  console.log("Vault registry:", vaultRegistry);

  // Check agents are valid for vault
  const agentIds = [1, 2, 3];
  for (const id of agentIds) {
    const agent = await registry.agents(id);
    console.log(`\nAgent ${id}:`);
    console.log("  Owner:", agent.owner);
    console.log("  Status:", agent.status);
    console.log("  Stake:", ethers.formatEther(agent.stake), "ETH");
    console.log("  Reputation:", agent.reputation.toString());
  }

  // Try to call with static to get revert reason
  console.log("\n=== Attempting staticCall for job creation ===");
  const agentIdsArray = [1, 2, 3];
  const userPrompt = "Execute a cross-DEX arbitrage between Uniswap V3 and SushiSwap";

  try {
    const result = await vault.requestStrategyJob.staticCall(agentIdsArray, userPrompt);
    console.log("Static call result:", result);
  } catch (e) {
    console.log("Static call failed!");
    console.log("Error:", e.message);
    if (e.reason) console.log("Reason:", e.reason);
    if (e.errorName) console.log("Error name:", e.errorName);
    if (e.errorArgs) console.log("Error args:", e.errorArgs);
  }
}

main().catch(console.error);
