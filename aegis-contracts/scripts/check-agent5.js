const { ethers } = require("hardhat");

const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
const LINK = "0x514910771AF9Ca656af840dff83E8264EcF986CA";

async function main() {
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const link = await ethers.getContractAt("IERC20", LINK);
  
  console.log("=== Agent 5 Status ===");
  
  try {
    const agent = await registry.agents(5);
    console.log("Owner:", agent.owner);
    console.log("Agent Address:", agent.agentAddress);
    console.log("Stake:", ethers.formatEther(agent.stake), "LINK");
    console.log("Reputation:", agent.reputation.toString());
    console.log("Verified:", agent.verified);
    console.log("Active:", agent.active);
    
    // Also check registry LINK balance
    const registryBalance = await link.balanceOf(REGISTRY);
    console.log("\nRegistry LINK Balance:", ethers.formatEther(registryBalance), "LINK");
  } catch (e) {
    console.error("Error:", e.message);
  }
}

main().catch(console.error);
