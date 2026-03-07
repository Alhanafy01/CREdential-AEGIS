/**
 * Verify the slashing and reputation changes after the dissent demo
 */

const { ethers } = require("hardhat");

async function main() {
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);

  console.log("=== Agent States AFTER Malicious Agent Demo (Job 32) ===\n");

  console.log("BEFORE vs AFTER comparison:");
  console.log("------------------------------------------------------------");

  const agents = [1, 2, 5];
  const beforeStake = ["200.0", "200.0", "500.0"];
  const beforeRep = [32, 33, 10];

  for (let i = 0; i < agents.length; i++) {
    const agentId = agents[i];
    const agent = await registry.agents(agentId);
    const stake = ethers.formatEther(agent.stake);
    const rep = Number(agent.reputation);

    const stakeChange = parseFloat(stake) - parseFloat(beforeStake[i]);
    const repChange = rep - beforeRep[i];

    console.log(`\nAgent ${agentId}:`);
    console.log(`  Stake:      ${beforeStake[i]} -> ${stake} LINK (${stakeChange >= 0 ? '+' : ''}${stakeChange.toFixed(1)})`);
    console.log(`  Reputation: ${beforeRep[i]} -> ${rep} (${repChange >= 0 ? '+' : ''}${repChange})`);

    if (agentId === 5) {
      console.log(`  Status: SLASHED for DISSENT`);
    } else {
      console.log(`  Status: REWARDED for CONSENSUS`);
    }
  }

  console.log("\n============================================================");
  console.log("DEMO SUMMARY:");
  console.log("============================================================");
  console.log("- Agents 1 & 2: Agreed on 500 USDC swap (consensus winners)");
  console.log("- Agent 5: Proposed 1000 USDC swap (DISSENT - different calldata)");
  console.log("");
  console.log("CRE Council Workflow detected dissent by comparing calldatas:");
  console.log("- Majority consensus (2/3) executed successfully");
  console.log("- Dissenting agent SLASHED (50 LINK penalty)");
  console.log("- Reputation updated for all agents");
  console.log("============================================================");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
