/**
 * AEGIS - Verify Agents via MockKeystoneForwarder
 * This script verifies agents by sending reports through the forwarder
 */
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  // New V2.1 deployment addresses
  const FORWARDER = "0x948a7CCb238F00CDfe16CfF33c3045A74aa72fcc";
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";

  console.log("=".repeat(70));
  console.log("AEGIS - Verify Agents via MockKeystoneForwarder");
  console.log("=".repeat(70));
  console.log("Forwarder:", FORWARDER);
  console.log("Registry:", REGISTRY);
  console.log("");

  const forwarder = await ethers.getContractAt(
    ["function deliverReportSimple(address receiver, bytes calldata report) external returns (bool)"],
    FORWARDER,
    deployer
  );

  const registry = await ethers.getContractAt(
    ["function isAgentVerified(uint256 agentId) external view returns (bool)"],
    REGISTRY,
    deployer
  );

  // Verify Agent 1 using legacy 64-byte format: (uint256 agentId, bytes32 humanIdHash)
  console.log("Verifying Agent 1...");
  const humanIdHash1 = ethers.keccak256(ethers.toUtf8Bytes("aegis-openclaw-alpha-v2.1"));
  const verifyPayload1 = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes32"],
    [1, humanIdHash1]
  );
  console.log("  Payload:", verifyPayload1);
  console.log("  Length:", verifyPayload1.length, "chars (should be 130 for 64 bytes)");

  try {
    const tx1 = await forwarder.deliverReportSimple(REGISTRY, verifyPayload1);
    await tx1.wait();
    console.log("  [OK] Agent 1 verified");
  } catch (e) {
    console.log("  [X] Agent 1 verification failed:", e.message);
  }

  // Verify Agent 2
  console.log("\nVerifying Agent 2...");
  const humanIdHash2 = ethers.keccak256(ethers.toUtf8Bytes("aegis-openclaw-beta-v2.1"));
  const verifyPayload2 = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes32"],
    [2, humanIdHash2]
  );

  try {
    const tx2 = await forwarder.deliverReportSimple(REGISTRY, verifyPayload2);
    await tx2.wait();
    console.log("  [OK] Agent 2 verified");
  } catch (e) {
    console.log("  [X] Agent 2 verification failed:", e.message);
  }

  // Check verification status
  console.log("\n" + "=".repeat(70));
  console.log("VERIFICATION STATUS");
  console.log("=".repeat(70));

  const agent1Verified = await registry.isAgentVerified(1);
  const agent2Verified = await registry.isAgentVerified(2);

  console.log(`Agent 1: ${agent1Verified ? "✓ VERIFIED" : "✗ NOT VERIFIED"}`);
  console.log(`Agent 2: ${agent2Verified ? "✓ VERIFIED" : "✗ NOT VERIFIED"}`);

  if (agent1Verified && agent2Verified) {
    console.log("\n✓ All agents verified! Ready for council workflow.");
  } else {
    console.log("\n✗ Some agents not verified. Check errors above.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
