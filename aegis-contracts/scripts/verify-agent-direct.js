/**
 * Direct Agent Verification Script
 *
 * This script directly calls the MockKeyForwarder to verify agents
 * by simulating what the CRE onboarding workflow would do.
 */

const { ethers } = require("hardhat");

// MockKeyForwarder ABI (minimal)
const FORWARDER_ABI = [
  "function report(address receiver, bytes32 workflowExecutionId, bytes calldata reportData) external"
];

async function main() {
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const FORWARDER = "0x948a7CCb238F00CDfe16CfF33c3045A74aa72fcc";

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // Get contracts
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const forwarder = new ethers.Contract(FORWARDER, FORWARDER_ABI, signer);

  // Check which agents need verification
  const nextAgentId = await registry.nextAgentId();
  console.log("\nTotal agents:", Number(nextAgentId) - 1);

  const agentsToVerify = [];
  for (let i = 1; i < Number(nextAgentId); i++) {
    const isVerified = await registry.isAgentVerified(i);
    const agent = await registry.agents(i);
    console.log(`Agent ${i}: verified=${isVerified}, owner=${agent.owner}`);
    if (!isVerified) {
      agentsToVerify.push(i);
    }
  }

  if (agentsToVerify.length === 0) {
    console.log("\nAll agents are already verified!");
    return;
  }

  console.log("\nAgents to verify:", agentsToVerify);

  // Verify each unverified agent
  for (const agentId of agentsToVerify) {
    console.log(`\n--- Verifying Agent ${agentId} ---`);

    // Generate a unique humanIdHash for each agent
    const humanIdHash = ethers.keccak256(ethers.toUtf8Bytes(`demo-human-id-${agentId}-${Date.now()}`));

    // Encode the V2 report: (uint8 reportType, uint256 agentId, bytes32 humanIdHash)
    // ReportType.VERIFY = 1
    const REPORT_TYPE_VERIFY = 1;
    const reportData = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint8", "uint256", "bytes32"],
      [REPORT_TYPE_VERIFY, agentId, humanIdHash]
    );

    console.log(`  Report Data: ${reportData.slice(0, 66)}...`);
    console.log(`  Human ID Hash: ${humanIdHash}`);

    try {
      // Send via forwarder's report function
      const tx = await forwarder.report(
        REGISTRY,
        ethers.ZeroHash, // workflowExecutionId
        reportData
      );

      console.log(`  TX Hash: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`  TX confirmed in block ${receipt.blockNumber}`);

      // Verify it worked
      const isNowVerified = await registry.isAgentVerified(agentId);
      console.log(`  Agent ${agentId} verified: ${isNowVerified}`);

    } catch (error) {
      console.error(`  Error verifying agent ${agentId}:`, error.message);
    }
  }

  // Final status
  console.log("\n=== Final Status ===");
  for (let i = 1; i < Number(nextAgentId); i++) {
    const isVerified = await registry.isAgentVerified(i);
    const agent = await registry.agents(i);
    console.log(`Agent ${i}: verified=${isVerified}, reputation=${agent.reputation}, stake=${ethers.formatEther(agent.stake)} LINK`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
