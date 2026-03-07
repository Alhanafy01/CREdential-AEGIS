const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const link = await ethers.getContractAt("IERC20", LINK_TOKEN);

  console.log("=== Resetting Agent State for Test ===\n");

  const stakeAmount = ethers.parseEther("100"); // 100 LINK per agent

  for (const agentId of [1, 2]) {
    const agent = await registry.getAgent(agentId);
    console.log(`Agent ${agentId} BEFORE:`);
    console.log(`  Stake: ${ethers.formatEther(agent.stake)} LINK`);
    console.log(`  Reputation: ${agent.reputation}`);

    // Add stake if needed
    if (agent.stake < stakeAmount) {
      const needed = stakeAmount - agent.stake;
      console.log(`  Adding ${ethers.formatEther(needed)} LINK stake...`);

      const approveTx = await link.approve(REGISTRY, needed);
      await approveTx.wait();

      const stakeTx = await registry.stake(agentId, needed);
      await stakeTx.wait();
      console.log("  Stake added!");
    }

    // Check final state
    const updated = await registry.getAgent(agentId);
    console.log(`Agent ${agentId} AFTER:`);
    console.log(`  Stake: ${ethers.formatEther(updated.stake)} LINK`);
    console.log(`  Reputation: ${updated.reputation}`);
    console.log();
  }

  console.log("=== Agents Ready for Testing ===");
}

main().catch(console.error);
