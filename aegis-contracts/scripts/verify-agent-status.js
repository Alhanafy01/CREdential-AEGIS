const { ethers } = require("hardhat");

async function main() {
  const REGISTRY_V2 = "0xae633E7208e8D6b2930ad6f698D625C95db932AF";

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY_V2);

  console.log("=== Agent Verification Status ===\n");

  const nextId = await registry.nextAgentId();
  console.log("Total agents registered:", nextId.toString());

  for (let i = 1; i < nextId; i++) {
    try {
      const agent = await registry.getAgent(i);
      console.log(`\nAgent ${i}:`);
      console.log("  Address:", agent.agentAddress);
      console.log("  Owner:", agent.owner);
      console.log("  Verified:", agent.verified);
      console.log("  HumanIdHash:", agent.humanIdHash);
      console.log("  Stake:", ethers.formatEther(agent.stake), "LINK");
      console.log("  Reputation:", agent.reputation.toString());
    } catch (e) {
      console.log(`Agent ${i}: Error - ${e.message}`);
    }
  }

  // Check CCIP simulation mode
  const ccipSimMode = await registry.ccipSimulationMode();
  console.log("\n=== Contract Config ===");
  console.log("CCIP Simulation Mode:", ccipSimMode);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
