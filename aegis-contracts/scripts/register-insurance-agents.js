/**
 * Register insurance specialist agents (7, 8, 9) in the TrustedAgentRegistry
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("=== Registering Insurance Specialist Agents ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const LINK = "0x514910771AF9Ca656af840dff83E8264EcF986CA";

  const provider = ethers.provider;
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const linkContract = await ethers.getContractAt("IERC20", LINK);

  // Check current next agent ID
  const nextId = await registry.nextAgentId();
  console.log("Current next agent ID:", nextId.toString());

  // Fund deployer with LINK for staking
  const linkSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [deployer.address, 1])
  );
  await provider.send("tenderly_setStorageAt", [
    LINK,
    linkSlot,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther("1000")])
  ]);

  // Approve LINK for registry
  const approveTx = await linkContract.approve(REGISTRY, ethers.parseEther("1000"));
  await approveTx.wait();
  console.log("LINK approved for registry");

  // Agent configurations for insurance
  const insuranceAgents = [
    {
      name: "FlightWatch Alpha",
      metadataUri: "http://localhost:3000/metadata/7"
    },
    {
      name: "ClaimVerifier Beta",
      metadataUri: "http://localhost:3000/metadata/8"
    },
    {
      name: "RiskAssessor Gamma",
      metadataUri: "http://localhost:3000/metadata/9"
    }
  ];

  // WorldID mock payload (empty for testing)
  const worldIdPayload = "0x";

  for (const agent of insuranceAgents) {
    try {
      console.log(`\nRegistering ${agent.name}...`);

      const registerTx = await registry.registerAgent(agent.metadataUri, worldIdPayload);
      const receipt = await registerTx.wait();

      // Find AgentRegistered event
      const event = receipt.logs.find(log => {
        try {
          return registry.interface.parseLog(log)?.name === "AgentRegistered";
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = registry.interface.parseLog(event);
        const agentId = parsed.args.agentId;
        console.log(`  Registered as Agent ${agentId}: ${agent.name}`);

        // Stake LINK
        const stakeTx = await registry.stakeAgent(agentId, ethers.parseEther("100"));
        await stakeTx.wait();
        console.log(`  Staked 100 LINK`);

        // Verify the agent (as admin)
        const verifyTx = await registry.verifyAgent(agentId);
        await verifyTx.wait();
        console.log(`  Verified Agent ${agentId}`);
      }
    } catch (error) {
      console.log(`  Error registering ${agent.name}:`, error.message.slice(0, 100));
    }
  }

  // List all agents
  console.log("\n=== All Registered Agents ===");
  const finalNextId = await registry.nextAgentId();
  for (let i = 1; i < finalNextId; i++) {
    try {
      const agent = await registry.agents(i);
      if (agent.owner !== ethers.ZeroAddress) {
        console.log(`Agent ${i}: verified=${agent.verified}, stake=${ethers.formatEther(agent.stake)} LINK, rep=${agent.reputation}`);
      }
    } catch (e) {}
  }

  console.log("\n=== Setup Complete ===");
  console.log("For insurance claim jobs, use agents: [7, 8, 9]");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
