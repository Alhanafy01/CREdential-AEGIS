const { ethers } = require("hardhat");

async function main() {
  // Check TX 1: 0x27f414f424611d91f4ebfc7662d33b7f5f94477b2b288843af1ccbeaeb568a4b
  const tx1 = await ethers.provider.getTransactionReceipt("0x27f414f424611d91f4ebfc7662d33b7f5f94477b2b288843af1ccbeaeb568a4b");
  console.log("TX1 block:", tx1 ? tx1.blockNumber : "NOT FOUND");
  console.log("TX1 logs:", tx1 ? tx1.logs.length : 0);

  // Check TX 2: 0x8ef74758519444a9170730579507fa483f7d7439cb879f3dbaf20aff0da09077
  const tx2 = await ethers.provider.getTransactionReceipt("0x8ef74758519444a9170730579507fa483f7d7439cb879f3dbaf20aff0da09077");
  console.log("TX2 block:", tx2 ? tx2.blockNumber : "NOT FOUND");
  console.log("TX2 logs:", tx2 ? tx2.logs.length : 0);

  // Check the latest TX from console log: 0x3f7f9f3909d3507ca4455b24f1a98ddbd3d055642def0a8c6b7863bf4ef1aaf6
  const tx3 = await ethers.provider.getTransactionReceipt("0x3f7f9f3909d3507ca4455b24f1a98ddbd3d055642def0a8c6b7863bf4ef1aaf6");
  console.log("TX3 block:", tx3 ? tx3.blockNumber : "NOT FOUND");
  console.log("TX3 logs:", tx3 ? tx3.logs.length : 0);

  // Also check the registry for agent count
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const nextAgent = await registry.nextAgentId();
  console.log("Next Agent ID:", nextAgent.toString());

  // Check last few agents
  for (let i = Math.max(1, Number(nextAgent) - 3); i < Number(nextAgent); i++) {
    const agent = await registry.agents(i);
    const isVerified = await registry.isAgentVerified(i);
    console.log(`Agent ${i}: verified=${isVerified}, owner=${agent.owner}`);
  }
}

main().catch(console.error);
