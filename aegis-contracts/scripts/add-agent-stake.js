const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const link = await ethers.getContractAt("IERC20", LINK_TOKEN);

  console.log("=== Adding LINK Stake to Agents ===\n");
  console.log("Deployer:", deployer.address);

  // Check deployer LINK balance
  const balance = await link.balanceOf(deployer.address);
  console.log("Deployer LINK balance:", ethers.formatEther(balance), "LINK\n");

  const stakeAmount = ethers.parseEther("100"); // 100 LINK per agent

  for (const agentId of [1, 2]) {
    const agent = await registry.getAgent(agentId);
    console.log(`Agent ${agentId}:`);
    console.log(`  Current Stake: ${ethers.formatEther(agent.stake)} LINK`);
    console.log(`  Current Reputation: ${agent.reputation}`);

    if (agent.stake < stakeAmount) {
      console.log(`  Adding ${ethers.formatEther(stakeAmount)} LINK stake...`);

      // Approve LINK transfer
      const approveTx = await link.approve(REGISTRY, stakeAmount);
      await approveTx.wait();
      console.log("  Approved LINK transfer");

      // Add stake
      const stakeTx = await registry.stake(agentId, stakeAmount);
      await stakeTx.wait();
      console.log("  Stake added!");

      // Verify
      const updated = await registry.getAgent(agentId);
      console.log(`  New Stake: ${ethers.formatEther(updated.stake)} LINK`);
    } else {
      console.log("  Already has sufficient stake");
    }
    console.log();
  }

  console.log("=== Stake Addition Complete ===");
}

main().catch(console.error);
