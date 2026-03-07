const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
  const STAKE_AMOUNT = ethers.parseEther("50"); // 50 LINK

  console.log("Deployer:", deployer.address);

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const link = await ethers.getContractAt("IERC20", LINK_TOKEN);

  // Check current agent 3 state
  const agent3Before = await registry.agents(3);
  console.log("\n=== Agent 3 Before ===");
  console.log("Owner:", agent3Before.owner);
  console.log("Verified:", agent3Before.verified);
  console.log("Stake:", ethers.formatEther(agent3Before.stake), "LINK");

  // Check next agent ID
  const nextId = await registry.nextAgentId();
  console.log("\nNext Agent ID:", nextId.toString());

  // Check deployer's LINK balance
  const linkBalance = await link.balanceOf(deployer.address);
  console.log("Deployer LINK balance:", ethers.formatEther(linkBalance));

  // 1. Approve LINK for registry (enough for stake)
  console.log("\n1. Approving LINK for registry...");
  const approveTx = await link.approve(REGISTRY, STAKE_AMOUNT);
  await approveTx.wait();
  console.log("Approved!");

  // 2. Register agent (no agentAddress param - uses msg.sender)
  console.log("\n2. Registering agent 3...");

  // Encode empty World ID payload for now (will be verified via CRE)
  const worldIdPayload = "0x";
  const metadataURI = "ipfs://agent3-malicious-test";

  const registerTx = await registry.registerAgent(metadataURI, worldIdPayload);
  const receipt = await registerTx.wait();
  console.log("Register TX:", registerTx.hash);

  // Find the AgentRegistered event
  let newAgentId;
  const registerEvent = receipt.logs.find(log => {
    try {
      const parsed = registry.interface.parseLog(log);
      return parsed && parsed.name === "AgentRegistered";
    } catch { return false; }
  });

  if (registerEvent) {
    const parsed = registry.interface.parseLog(registerEvent);
    newAgentId = parsed.args.agentId;
    console.log("Agent registered with ID:", newAgentId.toString());
  }

  // 3. Stake LINK for the new agent
  if (newAgentId) {
    console.log("\n3. Staking LINK for agent", newAgentId.toString());
    const stakeTx = await registry.stake(newAgentId, STAKE_AMOUNT);
    await stakeTx.wait();
    console.log("Staked", ethers.formatEther(STAKE_AMOUNT), "LINK!");
  }

  // Check current state
  const agentAfter = await registry.agents(newAgentId || 3n);
  console.log("\n=== Agent After Registration ===");
  console.log("Agent ID:", agentAfter.agentId.toString());
  console.log("Owner:", agentAfter.owner);
  console.log("Address:", agentAfter.agentAddress);
  console.log("Verified:", agentAfter.verified);
  console.log("Stake:", ethers.formatEther(agentAfter.stake), "LINK");
}

main().catch(console.error);
