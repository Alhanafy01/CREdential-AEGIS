const { ethers } = require("hardhat");

async function main() {
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);

  console.log("=== Checking Agent Verification Status ===\n");

  for (let id = 1; id <= 4; id++) {
    const agent = await registry.agents(id);
    const isVerified = await registry.isAgentVerified(id);

    console.log(`Agent ${id}:`);
    console.log("  Owner:", agent.owner);
    console.log("  Verified (struct):", agent.verified);
    console.log("  isAgentVerified():", isVerified);
    console.log("  Stake:", ethers.formatEther(agent.stake), "LINK");
    console.log("  Reputation:", agent.reputation.toString());
    console.log();
  }
}

main().catch(console.error);
