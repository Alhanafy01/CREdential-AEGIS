/**
 * AEGIS - Register Verified Agents
 *
 * This script registers agents with proper metadataURI pointing to the mock agent server
 * and manually verifies them for testing the council workflow.
 *
 * In production, verification would happen via:
 * 1. User registers agent with World ID proof in worldIdPayload
 * 2. CRE onboarding-workflow triggers on AgentRegistered event
 * 3. CRE verifies World ID proof and sends verification report
 * 4. Agent becomes verified
 *
 * For testing, we manually set verified=true via a special test function.
 */
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // Contract addresses (will be updated after deployment)
  const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS || "0xF5Fb29De6c41daC708d3B8ff9939238A6D34E287";
  const MOCK_SERVER_URL = process.env.MOCK_SERVER_URL || "http://localhost:3001";

  console.log("=".repeat(70));
  console.log("AEGIS - Register Verified Agents");
  console.log("=".repeat(70));
  console.log("Registry:", REGISTRY_ADDRESS);
  console.log("Deployer:", deployer.address);
  console.log("Mock Server:", MOCK_SERVER_URL);
  console.log("");

  const registry = await hre.ethers.getContractAt(
    [
      "function registerAgent(string metadataURI, bytes worldIdPayload) external returns (uint256)",
      "function getAgent(uint256 agentId) external view returns (tuple(uint256 agentId, address agentAddress, address owner, bytes32 humanIdHash, bool verified, uint256 stake, int256 reputation, string metadataURI))",
      "function nextAgentId() external view returns (uint256)",
      "function isAgentVerified(uint256 agentId) external view returns (bool)",
      "event AgentRegistered(uint256 indexed agentId, address indexed owner, address agentAddress, string metadataURI, bytes worldIdPayload)"
    ],
    REGISTRY_ADDRESS,
    deployer
  );

  // Check current next agent ID
  const nextId = await registry.nextAgentId();
  console.log("Current nextAgentId:", nextId.toString());

  // Agent configurations with metadataURI pointing to mock server
  const agents = [
    {
      // metadataURI points to mock server's ERC-8004 endpoint
      metadataURI: `${MOCK_SERVER_URL}/metadata/1`,
      worldIdPayload: "0x", // Empty for test (would contain World ID proof in production)
      name: "Yield Optimizer Alpha",
    },
    {
      metadataURI: `${MOCK_SERVER_URL}/metadata/2`,
      worldIdPayload: "0x",
      name: "Risk Manager Beta",
    },
    {
      metadataURI: `${MOCK_SERVER_URL}/metadata/3`,
      worldIdPayload: "0x",
      name: "Arbitrage Hunter (Malicious)",
    },
  ];

  const registeredAgentIds = [];

  for (let i = 0; i < agents.length; i++) {
    console.log(`\nRegistering Agent ${i + 1}: ${agents[i].name}...`);
    console.log(`  MetadataURI: ${agents[i].metadataURI}`);

    const tx = await registry.registerAgent(agents[i].metadataURI, agents[i].worldIdPayload);
    const receipt = await tx.wait();

    // Parse event to get agent ID
    const topic = hre.ethers.id("AgentRegistered(uint256,address,address,string,bytes)");
    const log = receipt.logs.find(l => l.topics[0] === topic);
    const agentId = log ? BigInt(log.topics[1]) : BigInt(nextId) + BigInt(i);

    registeredAgentIds.push(agentId);
    console.log(`  ✓ Agent ${agentId} registered`);
    console.log(`  TX: ${receipt.hash}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("AGENTS REGISTERED");
  console.log("=".repeat(70));

  console.log("\nNOTE: Agents are NOT yet verified. In production, verification happens via:");
  console.log("  1. AgentRegistered event triggers CRE onboarding-workflow");
  console.log("  2. CRE verifies World ID proof with World ID Cloud API");
  console.log("  3. CRE sends verification report via WriteReport");
  console.log("  4. TrustedAgentRegistry._processReport() sets verified=true");

  console.log("\n" + "=".repeat(70));
  console.log("REGISTERED AGENT DETAILS");
  console.log("=".repeat(70));

  for (const agentId of registeredAgentIds) {
    const agent = await registry.getAgent(agentId);
    console.log(`\nAgent ${agentId}:`);
    console.log(`  Address: ${agent.agentAddress}`);
    console.log(`  Owner: ${agent.owner}`);
    console.log(`  Verified: ${agent.verified}`);
    console.log(`  MetadataURI: ${agent.metadataURI}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("NEXT STEPS");
  console.log("=".repeat(70));
  console.log("1. Run the onboarding-workflow to verify agents (with World ID)");
  console.log("   OR use manuallyVerifyAgents.js to verify for testing");
  console.log("2. Then run triggerStrategyJob.js to test the council workflow");
  console.log("=".repeat(70));

  return registeredAgentIds;
}

main()
  .then((agentIds) => {
    console.log(`\nRegistered Agent IDs: [${agentIds.join(", ")}]`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
