const { ethers } = require("hardhat");

async function main() {
  const REGISTRY_V2 = "0x9C481a0A23183B5848832e3cDd6fFC3D909E1cDD";

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY_V2);

  const nextAgentId = await registry.nextAgentId();
  console.log("Next Agent ID:", nextAgentId.toString());

  // Check agents 1-5
  for (let i = 1; i <= 5; i++) {
    try {
      const agent = await registry.getAgent(i);
      if (agent.owner !== "0x0000000000000000000000000000000000000000") {
        console.log(`Agent ${i}:`, {
          owner: agent.owner,
          verified: agent.verified,
          stake: ethers.formatEther(agent.stake),
          reputation: agent.reputation.toString()
        });
      } else {
        console.log(`Agent ${i}: Empty/Not registered`);
      }
    } catch (e) {
      console.log(`Agent ${i}: Error - ${e.message}`);
    }
  }

  // Check CCIP and reward balances
  const ccipBalance = await registry.getCCIPFeeBalance();
  const rewardPool = await registry.getRewardPoolBalance();
  console.log("\nContract Balances:");
  console.log("LINK (CCIP fees):", ethers.formatEther(ccipBalance));
  console.log("AEGIS (rewards):", ethers.formatEther(rewardPool));
}

main().catch(console.error);
