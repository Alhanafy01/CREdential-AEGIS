/**
 * Add large stake to Agent 5 for malicious demo
 * Uses direct storage manipulation since impersonation doesn't work with Tenderly
 */

const { ethers } = require("hardhat");

async function main() {
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
  const MALICIOUS_AGENT_ID = 5;
  const NEW_STAKE = ethers.parseEther("500"); // 500 LINK total stake

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);

  // Check current status
  console.log("=== Current Agent 5 Status ===");
  let agent5 = await registry.agents(MALICIOUS_AGENT_ID);
  console.log(`  Verified: ${agent5.verified}`);
  console.log(`  Stake: ${ethers.formatEther(agent5.stake)} LINK`);
  console.log(`  Reputation: ${agent5.reputation}`);
  console.log(`  Owner: ${agent5.owner}`);

  // Direct storage manipulation for Agent 5 stake
  // Agent struct in mapping(uint256 => Agent) agents at slot X
  // Need to find the correct slot for agents[5].stake

  // In TrustedAgentRegistryV2, the storage layout is:
  // Slot 0: ReceiverTemplate state (owner, etc)
  // For inherited contracts, we need to check the actual slot

  // agents mapping is likely at slot 7 or so after ReceiverTemplate state
  // Let's calculate: agents[agentId] base slot = keccak256(abi.encode(agentId, mappingSlot))
  // Then add offset for stake field within Agent struct

  // Agent struct layout:
  // 0: agentId (uint256)
  // 1: agentAddress (address - 20 bytes, packed with next)
  // 2: owner (address)
  // 3: humanIdHash (bytes32)
  // 4: verified (bool, packed) + stake (uint256) might be in same or next slot
  // 5: stake (uint256)
  // 6: reputation (int256)
  // 7: metadataURI (string - dynamic)

  console.log("\n=== Setting Agent 5 stake via storage manipulation ===");

  // Try different mapping slots to find agents mapping
  for (let mappingSlot = 0; mappingSlot <= 10; mappingSlot++) {
    const baseSlot = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["uint256", "uint256"],
        [MALICIOUS_AGENT_ID, mappingSlot]
      )
    );

    // Check slot 0 (agentId) to verify this is the right mapping
    const slot0Value = await ethers.provider.getStorage(REGISTRY, baseSlot);
    const agentIdValue = BigInt(slot0Value);

    if (agentIdValue === BigInt(MALICIOUS_AGENT_ID)) {
      console.log(`Found agents mapping at slot ${mappingSlot}!`);
      console.log(`Base slot for Agent 5: ${baseSlot}`);

      // stake is at offset 5 in the struct
      const stakeSlot = BigInt(baseSlot) + 5n;
      const stakeSlotHex = "0x" + stakeSlot.toString(16).padStart(64, '0');

      console.log(`Stake slot: ${stakeSlotHex}`);

      // Read current stake
      const currentStake = await ethers.provider.getStorage(REGISTRY, stakeSlotHex);
      console.log(`Current stake storage: ${currentStake}`);
      console.log(`Current stake: ${ethers.formatEther(BigInt(currentStake))} LINK`);

      // Set new stake
      await ethers.provider.send("tenderly_setStorageAt", [
        REGISTRY,
        stakeSlotHex,
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [NEW_STAKE])
      ]);

      console.log(`Set stake to: ${ethers.formatEther(NEW_STAKE)} LINK`);
      break;
    }
  }

  // Also fund registry with LINK to cover the stake (so slashing can transfer tokens)
  console.log("\n=== Ensuring Registry has LINK for slashing ===");
  const registryLinkSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [REGISTRY, 1]
    )
  );

  await ethers.provider.send("tenderly_setStorageAt", [
    LINK_TOKEN,
    registryLinkSlot,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther("10000")])
  ]);

  const linkToken = await ethers.getContractAt("IERC20", LINK_TOKEN);
  const registryBalance = await linkToken.balanceOf(REGISTRY);
  console.log(`Registry LINK balance: ${ethers.formatEther(registryBalance)} LINK`);

  // Final status
  console.log("\n=== Final Status ===");
  agent5 = await registry.agents(MALICIOUS_AGENT_ID);
  console.log(`  Agent 5: verified=${agent5.verified}, stake=${ethers.formatEther(agent5.stake)} LINK, rep=${agent5.reputation}`);

  // Show all agents
  console.log("\n=== All Agents ===");
  const nextAgentId = await registry.nextAgentId();
  for (let i = 1; i < Number(nextAgentId); i++) {
    const agent = await registry.agents(i);
    const status = agent.verified ? "VERIFIED" : "PENDING";
    console.log(`  Agent ${i}: [${status}] stake=${ethers.formatEther(agent.stake)} LINK, rep=${agent.reputation}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
