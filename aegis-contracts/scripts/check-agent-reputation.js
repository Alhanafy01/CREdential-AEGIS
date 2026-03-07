const { ethers } = require("hardhat");

async function main() {
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);

  console.log("=== Agent Reputation Status (After Job #20) ===\n");

  // Check agents 1 and 2
  for (const agentId of [1, 2]) {
    const agent = await registry.getAgent(agentId);
    console.log(`Agent ${agentId}:`);
    console.log(`  Verified: ${agent.verified}`);
    console.log(`  Reputation: ${agent.reputation}`);
    console.log(`  Stake: ${ethers.formatEther(agent.stake)} LINK`);
    console.log();
  }
}

main().catch(console.error);
