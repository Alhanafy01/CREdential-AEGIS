const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // New TrustedAgentRegistry from Phase 3 deployment (Real CRE Capabilities)
  const REGISTRY_ADDRESS = "0xF5Fb29De6c41daC708d3B8ff9939238A6D34E287";

  console.log("=".repeat(70));
  console.log("AEGIS - Register Test Agents for Council Workflow");
  console.log("=".repeat(70));
  console.log("Registry:", REGISTRY_ADDRESS);
  console.log("Deployer:", deployer.address);
  console.log("");

  const registry = await hre.ethers.getContractAt(
    [
      "function registerAgent(string metadataURI, bytes worldIdPayload) external returns (uint256)",
      "function getAgent(uint256 agentId) external view returns (tuple(uint256 agentId, address agentAddress, address owner, bytes32 humanIdHash, bool verified, uint256 stake, int256 reputation, string metadataURI))",
      "function nextAgentId() external view returns (uint256)",
      "event AgentRegistered(uint256 indexed agentId, address indexed owner, address agentAddress, string metadataURI, bytes worldIdPayload)"
    ],
    REGISTRY_ADDRESS,
    deployer
  );

  // Check current next agent ID
  const nextId = await registry.nextAgentId();
  console.log("Current nextAgentId:", nextId.toString());

  // Register 3 test agents
  const agents = [
    {
      metadataURI: "data:application/json;base64," + Buffer.from(JSON.stringify({
        name: "Yield Optimizer Alpha",
        description: "DeFi yield optimization agent",
        category: "Yield Optimization",
        capabilities: ["swap", "stake", "lend"],
        version: "1.0.0",
        author: "AEGIS Team"
      })).toString('base64'),
      worldIdPayload: "0x" // Empty for test
    },
    {
      metadataURI: "data:application/json;base64," + Buffer.from(JSON.stringify({
        name: "Risk Manager Beta",
        description: "Portfolio risk management agent",
        category: "Risk Management",
        capabilities: ["monitor", "alert", "rebalance"],
        version: "1.0.0",
        author: "AEGIS Team"
      })).toString('base64'),
      worldIdPayload: "0x"
    },
    {
      metadataURI: "data:application/json;base64," + Buffer.from(JSON.stringify({
        name: "Arbitrage Hunter (Malicious)",
        description: "Arbitrage bot - configured as malicious for testing",
        category: "Arbitrage",
        capabilities: ["swap", "flashloan"],
        version: "1.0.0",
        author: "Unknown"
      })).toString('base64'),
      worldIdPayload: "0x"
    }
  ];

  for (let i = 0; i < agents.length; i++) {
    console.log(`\nRegistering Agent ${i + 1}...`);
    const tx = await registry.registerAgent(agents[i].metadataURI, agents[i].worldIdPayload);
    const receipt = await tx.wait();

    // Parse event to get agent ID
    const topic = hre.ethers.id("AgentRegistered(uint256,address,address,string,bytes)");
    const log = receipt.logs.find(l => l.topics[0] === topic);
    const agentId = log ? BigInt(log.topics[1]) : BigInt(i + 1);

    console.log(`  Agent ${agentId} registered!`);
    console.log(`  TX: ${receipt.hash}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("TEST AGENTS REGISTERED SUCCESSFULLY");
  console.log("=".repeat(70));
  console.log("\nAgent 1: Yield Optimizer Alpha (Good)");
  console.log("Agent 2: Risk Manager Beta (Good)");
  console.log("Agent 3: Arbitrage Hunter (Malicious - for testing ACE rejection)");
  console.log("\nNext step: Run triggerStrategyJob.js to create a strategy job");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
