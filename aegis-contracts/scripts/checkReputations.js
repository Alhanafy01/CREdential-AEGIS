const hre = require("hardhat");

async function main() {
  const REGISTRY_ADDRESS = "0xF5Fb29De6c41daC708d3B8ff9939238A6D34E287";

  const registry = await hre.ethers.getContractAt(
    ["function getAgent(uint256 agentId) external view returns (tuple(uint256 agentId, address agentAddress, address owner, bytes32 humanIdHash, bool verified, uint256 stake, int256 reputation, string metadataURI))"],
    REGISTRY_ADDRESS
  );

  console.log("=".repeat(50));
  console.log("AGENT REPUTATIONS");
  console.log("=".repeat(50));

  for (let i = 1; i <= 3; i++) {
    const agent = await registry.getAgent(i);
    console.log(`Agent ${i}: reputation = ${agent.reputation.toString()}`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
