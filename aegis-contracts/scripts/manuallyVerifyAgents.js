/**
 * AEGIS - Manually Verify Agents (Testing Only)
 *
 * This script manually verifies agents for testing the council workflow.
 * In production, verification happens via CRE onboarding-workflow with World ID.
 */
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS || "0xF5Fb29De6c41daC708d3B8ff9939238A6D34E287";

  console.log("=".repeat(70));
  console.log("AEGIS - Manually Verify Agents (Testing)");
  console.log("=".repeat(70));
  console.log("Registry:", REGISTRY_ADDRESS);
  console.log("Controller:", deployer.address);
  console.log("");

  const registry = await hre.ethers.getContractAt(
    [
      "function manuallyVerifyAgent(uint256 agentId, bytes32 humanIdHash) external",
      "function getAgent(uint256 agentId) external view returns (tuple(uint256 agentId, address agentAddress, address owner, bytes32 humanIdHash, bool verified, uint256 stake, int256 reputation, string metadataURI))",
      "function isAgentVerified(uint256 agentId) external view returns (bool)",
      "function nextAgentId() external view returns (uint256)",
      "event AgentVerified(uint256 indexed agentId, bytes32 humanIdHash)"
    ],
    REGISTRY_ADDRESS,
    deployer
  );

  // Get number of agents
  const nextId = await registry.nextAgentId();
  console.log("Total agents:", (nextId - 1n).toString());
  console.log("");

  // Agent IDs to verify (adjust as needed)
  const agentIdsToVerify = process.env.AGENT_IDS
    ? process.env.AGENT_IDS.split(",").map(id => BigInt(id.trim()))
    : [1n, 2n, 3n];

  console.log(`Verifying agents: [${agentIdsToVerify.join(", ")}]`);
  console.log("-".repeat(50));

  for (const agentId of agentIdsToVerify) {
    const agent = await registry.getAgent(agentId);

    if (agent.owner === "0x0000000000000000000000000000000000000000") {
      console.log(`\nAgent ${agentId}: NOT FOUND (skipping)`);
      continue;
    }

    if (agent.verified) {
      console.log(`\nAgent ${agentId}: Already verified (skipping)`);
      continue;
    }

    console.log(`\nVerifying Agent ${agentId}...`);

    // Generate mock humanIdHash (in production this comes from World ID)
    const mockHumanIdHash = hre.ethers.keccak256(
      hre.ethers.toUtf8Bytes(`aegis-test-human-${agentId}`)
    );

    const tx = await registry.manuallyVerifyAgent(agentId, mockHumanIdHash);
    const receipt = await tx.wait();

    console.log(`  ✓ Agent ${agentId} verified`);
    console.log(`  HumanIdHash: ${mockHumanIdHash}`);
    console.log(`  TX: ${receipt.hash}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("VERIFICATION STATUS");
  console.log("=".repeat(70));

  for (const agentId of agentIdsToVerify) {
    const isVerified = await registry.isAgentVerified(agentId);
    const agent = await registry.getAgent(agentId);
    const status = isVerified ? "✓ VERIFIED" : "✗ NOT VERIFIED";
    console.log(`Agent ${agentId}: ${status}`);
    if (isVerified) {
      console.log(`  MetadataURI: ${agent.metadataURI}`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("NEXT STEP: Run triggerStrategyJob.js to test council workflow");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
