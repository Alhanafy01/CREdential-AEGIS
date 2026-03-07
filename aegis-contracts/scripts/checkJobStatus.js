const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const STRATEGY_VAULT_ADDRESS = "0xDb102FB66A06255fa7EF5A620bF9a993eF9c3CBD";
  const REGISTRY_ADDRESS = "0x0752251691D1E48385199e461C555bE31e9EC14e";

  console.log("=".repeat(70));
  console.log("AEGIS - Check Job & Agent Status");
  console.log("=".repeat(70));

  // Check StrategyVault job status
  const vault = await hre.ethers.getContractAt(
    [
      "function getJob(uint256 jobId) external view returns (uint256[] memory agentIds, uint8 strategyType, address targetProtocol, uint256 amount, address proposer, bool completed, bool approved, int256 pnlDelta)",
      "function nextJobId() external view returns (uint256)",
    ],
    STRATEGY_VAULT_ADDRESS,
    deployer
  );

  const nextJobId = await vault.nextJobId();
  console.log("\nStrategyVault Jobs:");
  console.log("-".repeat(50));

  for (let i = 1n; i < nextJobId; i++) {
    const job = await vault.getJob(i);
    console.log(`Job ${i}:`);
    console.log(`  Agents: [${job.agentIds.join(", ")}]`);
    console.log(`  Strategy Type: ${job.strategyType}`);
    console.log(`  Target Protocol: ${job.targetProtocol}`);
    console.log(`  Amount: ${hre.ethers.formatEther(job.amount)}`);
    console.log(`  Proposer: ${job.proposer}`);
    console.log(`  Completed: ${job.completed}`);
    console.log(`  Approved: ${job.approved}`);
    console.log(`  PnL Delta: ${job.pnlDelta}`);
    console.log("");
  }

  // Check Agent reputations
  const registry = await hre.ethers.getContractAt(
    [
      "function getAgent(uint256 agentId) external view returns (tuple(uint256 agentId, address agentAddress, address owner, bytes32 humanIdHash, bool verified, uint256 stake, int256 reputation, string metadataURI))",
      "function nextAgentId() external view returns (uint256)",
    ],
    REGISTRY_ADDRESS,
    deployer
  );

  const nextAgentId = await registry.nextAgentId();
  console.log("\nAgent Reputations (TrustedAgentRegistry):");
  console.log("-".repeat(50));

  for (let i = 1n; i < nextAgentId; i++) {
    const agent = await registry.getAgent(i);
    console.log(`Agent ${i}:`);
    console.log(`  Verified: ${agent.verified}`);
    console.log(`  Reputation: ${agent.reputation}`);
    console.log(`  MetadataURI: ${agent.metadataURI}`);
    console.log("");
  }

  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
