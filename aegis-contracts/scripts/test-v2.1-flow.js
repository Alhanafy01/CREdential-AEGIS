/**
 * AEGIS V2.1 End-to-End Test Script
 *
 * Tests the full flow:
 * 1. Create strategy job with natural language userPrompt
 * 2. Verify the event is emitted correctly
 * 3. Show CRE command to execute
 */
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  // V2.1 Contract Addresses
  const VAULT_ADDRESS = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const REGISTRY_ADDRESS = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";

  console.log("=".repeat(70));
  console.log("AEGIS V2.1 - Protocol-Agnostic End-to-End Test");
  console.log("=".repeat(70));
  console.log("Deployer:", deployer.address);
  console.log("Vault:", VAULT_ADDRESS);
  console.log("Registry:", REGISTRY_ADDRESS);
  console.log("");

  // Connect to contracts
  const vault = await ethers.getContractAt(
    [
      "function requestStrategyJob(uint256[] agentIds, string userPrompt) external returns (uint256)",
      "function getJob(uint256 jobId) external view returns (uint256[] agentIds, address proposer, uint256 createdAt, bool completed, bool success, string userPrompt)",
      "function nextJobId() external view returns (uint256)",
      "function totalAssets() external view returns (uint256)",
      "event StrategyJobCreated(uint256 indexed jobId, address indexed proposer, uint256[] agentIds, string userPrompt)"
    ],
    VAULT_ADDRESS,
    deployer
  );

  const registry = await ethers.getContractAt(
    [
      "function isAgentVerified(uint256 agentId) external view returns (bool)",
      "function getAgent(uint256 agentId) external view returns (tuple(uint256 agentId, address agentAddress, address owner, bytes32 humanIdHash, bool verified, uint256 stake, int256 reputation, string metadataURI))"
    ],
    REGISTRY_ADDRESS,
    deployer
  );

  // Check current state
  console.log("=== Current State ===");
  const nextJobId = await vault.nextJobId();
  const totalAssets = await vault.totalAssets();
  console.log("Next Job ID:", nextJobId.toString());
  console.log("Total Vault Assets:", ethers.formatUnits(totalAssets, 6), "USDC");

  // Verify agents
  console.log("\n=== Agent Verification ===");
  const agent1Verified = await registry.isAgentVerified(1);
  const agent2Verified = await registry.isAgentVerified(2);
  console.log("Agent 1 verified:", agent1Verified);
  console.log("Agent 2 verified:", agent2Verified);

  if (!agent1Verified || !agent2Verified) {
    console.error("\n[ERROR] Agents not verified! Run verify-agents-v2.1.js first");
    return;
  }

  // Natural language prompt - this is what the user types!
  const userPrompt = "Swap 500 USDC for WETH using Uniswap V3";
  const agentIds = [1, 2]; // Verified agents

  console.log("\n=== Creating Strategy Job ===");
  console.log("User Prompt:", `"${userPrompt}"`);
  console.log("Agent IDs:", agentIds);

  // Create the job
  const tx = await vault.requestStrategyJob(agentIds, userPrompt);
  console.log("TX Hash:", tx.hash);

  const receipt = await tx.wait();
  console.log("TX confirmed in block:", receipt.blockNumber);

  // Parse the event
  const eventTopic = ethers.id("StrategyJobCreated(uint256,address,uint256[],string)");
  const eventLog = receipt.logs.find(log => log.topics[0] === eventTopic);

  if (eventLog) {
    const jobId = BigInt(eventLog.topics[1]);
    console.log("\n=== Job Created Successfully ===");
    console.log("Job ID:", jobId.toString());

    // Verify the job on-chain
    const job = await vault.getJob(jobId);
    console.log("\n=== On-Chain Job Data ===");
    console.log("Agent IDs:", job.agentIds.map(id => id.toString()).join(", "));
    console.log("Proposer:", job.proposer);
    console.log("Created At:", new Date(Number(job.createdAt) * 1000).toISOString());
    console.log("Completed:", job.completed);
    console.log("User Prompt:", job.userPrompt);

    // Show CRE command
    console.log("\n" + "=".repeat(70));
    console.log("CRE WORKFLOW COMMAND");
    console.log("=".repeat(70));
    console.log("\nRun this command to execute the CRE council workflow:\n");
    console.log(`cd /xdata/chainlinkhackathone/aegis-cre/council-workflow && \\`);
    console.log(`cre workflow simulate --local main.ts`);
    console.log("\nOr with transaction hash trigger:\n");
    console.log(`cre workflow simulate ./council-workflow --target local-simulation \\`);
    console.log(`  --evm-tx-hash ${tx.hash} \\`);
    console.log(`  --non-interactive --trigger-index 0 --evm-event-index 0 --broadcast`);
    console.log("\n" + "=".repeat(70));

  } else {
    console.error("[ERROR] Event not found in transaction logs");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
