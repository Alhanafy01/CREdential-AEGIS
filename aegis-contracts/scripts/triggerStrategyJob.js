const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // StrategyVault address from Phase 4 deployment (Dynamic Endpoints)
  const STRATEGY_VAULT_ADDRESS = "0xDb102FB66A06255fa7EF5A620bF9a993eF9c3CBD";

  console.log("=".repeat(70));
  console.log("AEGIS - Trigger Strategy Job for Council Workflow Testing");
  console.log("=".repeat(70));
  console.log("Proposer:", deployer.address);
  console.log("StrategyVault:", STRATEGY_VAULT_ADDRESS);
  console.log("");

  // Connect to StrategyVault
  const strategyVault = await hre.ethers.getContractAt(
    [
      "function requestStrategyJob(uint256[] calldata agentIds) external returns (uint256)",
      "function requestStrategyJob(uint256[] calldata agentIds, uint8 strategyType, address targetProtocol, uint256 amount, bytes calldata params) external returns (uint256)",
      "function nextJobId() external view returns (uint256)",
      "function getJob(uint256 jobId) external view returns (uint256[] memory agentIds, uint8 strategyType, address targetProtocol, uint256 amount, address proposer, bool completed, bool approved, int256 pnlDelta)",
      "event StrategyJobCreated(uint256 indexed jobId, address indexed proposer, bytes jobData)",
    ],
    STRATEGY_VAULT_ADDRESS,
    deployer
  );

  // Get current job ID
  const currentJobId = await strategyVault.nextJobId();
  console.log("Current Next Job ID:", currentJobId.toString());

  // Define council agents (agent IDs 1, 2, 3 for testing)
  // Agent 3 is configured as "malicious" in the CRE workflow
  const councilAgentIds = [1n, 2n, 3n];

  // Strategy parameters
  const strategyType = 0; // SWAP
  const targetProtocol = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // Uniswap V2 Router (example)
  const amount = hre.ethers.parseEther("1000"); // 1000 tokens
  const params = "0x"; // Empty params for demo

  console.log("\nStrategy Job Parameters:");
  console.log("-".repeat(50));
  console.log("Council Agents:", councilAgentIds.map(id => id.toString()).join(", "));
  console.log("Strategy Type: SWAP (0)");
  console.log("Target Protocol:", targetProtocol);
  console.log("Amount:", hre.ethers.formatEther(amount), "tokens");
  console.log("");

  // Submit strategy job (full version)
  console.log("Submitting strategy job...");
  const tx = await strategyVault["requestStrategyJob(uint256[],uint8,address,uint256,bytes)"](
    councilAgentIds,
    strategyType,
    targetProtocol,
    amount,
    params
  );

  console.log("Transaction Hash:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();

  console.log("\n" + "=".repeat(70));
  console.log("STRATEGY JOB CREATED SUCCESSFULLY!");
  console.log("=".repeat(70));
  console.log("Transaction Hash:", receipt.hash);
  console.log("Block Number:", receipt.blockNumber);
  console.log("Gas Used:", receipt.gasUsed.toString());

  // Parse the event
  const strategyJobCreatedTopic = hre.ethers.id("StrategyJobCreated(uint256,address,bytes)");
  const eventLog = receipt.logs.find(log => log.topics[0] === strategyJobCreatedTopic);

  if (eventLog) {
    const jobId = BigInt(eventLog.topics[1]);
    console.log("\nJob ID:", jobId.toString());
  }

  console.log("\n" + "=".repeat(70));
  console.log("NEXT STEPS:");
  console.log("=".repeat(70));
  console.log(`1. Copy this transaction hash: ${receipt.hash}`);
  console.log("2. Run the CRE council workflow:");
  console.log(`   cd /xdata/chainlinkhackathone/aegis-cre/council-workflow`);
  console.log(`   cre workflow simulate --tx ${receipt.hash} --broadcast`);
  console.log("=".repeat(70));

  return receipt.hash;
}

main()
  .then((txHash) => {
    console.log("\nDone! TX Hash:", txHash);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
