const { ethers } = require("hardhat");

async function main() {
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0");
  console.log("=== Insurance Agent States ===");
  for (const agentId of [7, 8, 9]) {
    const agent = await registry.agents(agentId);
    console.log(`Agent ${agentId}: verified=${agent.verified}, stake=${ethers.formatEther(agent.stake)} LINK`);
  }
}
main();
