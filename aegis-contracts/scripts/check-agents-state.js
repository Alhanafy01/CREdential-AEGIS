const { ethers } = require("hardhat");

async function main() {
  const REGISTRY = "0xae633E7208e8D6b2930ad6f698D625C95db932AF";

  const abi = [
    "function nextAgentId() view returns (uint256)",
    "function agents(uint256) view returns (uint256 agentId, address agentAddress, address owner, bytes32 humanIdHash, bool verified, uint256 stake, int256 reputation, string metadataURI)"
  ];

  const registry = new ethers.Contract(REGISTRY, abi, ethers.provider);

  const nextId = await registry.nextAgentId();
  console.log("Next Agent ID:", nextId.toString());
  console.log("Total Registered Agents:", (Number(nextId) - 1).toString());
  console.log("");

  let verifiedCount = 0;
  for (let i = 1; i < Number(nextId); i++) {
    try {
      const agent = await registry.agents(i);
      const status = agent.verified ? "VERIFIED" : "NOT VERIFIED";
      if (agent.verified) verifiedCount++;
      console.log("Agent " + i + ": " + status + " | owner: " + agent.owner.substring(0,10) + "... | rep: " + agent.reputation.toString());
    } catch (e) {
      console.log("Agent " + i + ": ERROR - " + e.message.substring(0, 50));
    }
  }
  console.log("");
  console.log("Total Verified: " + verifiedCount);
}

main().catch(console.error);
