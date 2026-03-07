const hre = require("hardhat");

const REGISTRY = "0x608f4Ea047470a36Df5BC5D6121A99AC50394a8c";

async function main() {
  const reg = await hre.ethers.getContractAt("TrustedAgentRegistry", REGISTRY);
  
  console.log("=".repeat(60));
  console.log("AGENT REPUTATION CHECK");
  console.log("=".repeat(60));
  
  const nextId = await reg.nextAgentId();
  console.log("Total Agents:", Number(nextId) - 1);
  console.log("");
  
  for (let i = 1; i < Number(nextId); i++) {
    const agent = await reg.getAgent(i);
    const rep = Number(agent.reputation);
    const repDisplay = rep >= 0 ? `+${rep}` : `${rep}`;
    const status = agent.verified ? "VERIFIED" : "PENDING";
    const stake = hre.ethers.formatEther(agent.stake);
    
    // Highlight malicious agents (negative reputation)
    const indicator = rep < 0 ? " [SLASHED]" : rep > 0 ? " [GOOD]" : "";
    
    console.log(`Agent ${i}: ${status}`);
    console.log(`  Owner: ${agent.owner}`);
    console.log(`  Reputation: ${repDisplay}${indicator}`);
    console.log(`  Stake: ${stake} AEGIS`);
    console.log("");
  }
}

main().catch(console.error);
