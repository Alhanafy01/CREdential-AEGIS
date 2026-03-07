/**
 * Verify and stake insurance agents (7, 8, 9) by directly manipulating storage
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("=== Verifying Insurance Agents ===\n");

  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const LINK = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
  const provider = ethers.provider;

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const linkContract = await ethers.getContractAt("IERC20", LINK);

  // Agent struct layout in storage (assuming mapping at slot 6):
  // struct Agent {
  //   uint256 agentId;       // slot 0
  //   address agentAddress;  // slot 1
  //   address owner;         // slot 1 (packed)
  //   bytes32 humanIdHash;   // slot 2
  //   bool verified;         // slot 3
  //   uint256 stake;         // slot 3 (or next)
  //   int256 reputation;     // slot 4
  //   ...
  // }

  // We need to find the correct storage slot for agents mapping
  // mapping(uint256 => Agent) public agents; is likely at slot 6 or similar

  const agentIds = [7, 8, 9];
  const [deployer] = await ethers.getSigners();

  // First, let's check current state
  console.log("Current agent states:");
  for (const agentId of agentIds) {
    const agent = await registry.agents(agentId);
    console.log(`Agent ${agentId}: verified=${agent.verified}, stake=${ethers.formatEther(agent.stake)} LINK`);
  }

  // Fund deployer with LINK
  const linkSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [deployer.address, 1])
  );
  await provider.send("tenderly_setStorageAt", [
    LINK,
    linkSlot,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther("1000")])
  ]);

  // Approve and stake for each agent
  console.log("\nStaking and verifying agents...");

  for (const agentId of agentIds) {
    try {
      // The agents mapping slot needs to be found
      // For a mapping(uint256 => struct), the base slot of agent[N] is keccak256(N, mappingSlot)
      // Then struct members are at consecutive slots

      // Let's try to stake first (this function exists)
      await linkContract.approve(REGISTRY, ethers.parseEther("100"));
      const stakeTx = await registry.stake(agentId, ethers.parseEther("100"));
      await stakeTx.wait();
      console.log(`Agent ${agentId}: Staked 100 LINK`);

    } catch (error) {
      console.log(`Agent ${agentId} stake error:`, error.message.slice(0, 80));
    }
  }

  // Now let's manipulate storage directly to set verified = true
  // The agents mapping is likely at a specific slot, let's find it
  // Looking at TrustedAgentRegistryV2 storage layout...

  // Based on typical patterns, let's assume agents mapping is at slot 7
  // For agent[agentId], base = keccak256(agentId, 7)
  // The verified field is likely offset by 3 or 4 slots

  console.log("\nDirectly setting verified = true via storage...");

  for (const agentId of agentIds) {
    // Try different mapping slots (6, 7, 8, 9, 10)
    for (const mappingSlot of [6, 7, 8, 9, 10]) {
      const baseSlot = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "uint256"], [agentId, mappingSlot])
      );

      // The struct is: agentId(0), agentAddress(1), owner(1), humanIdHash(2), verified(3), stake(4), reputation(5)
      // verified is at offset +3 from base

      // Read current slot +3 to see if it might be verified
      const verifiedSlot = ethers.toBigInt(baseSlot) + 3n;
      const verifiedSlotHex = "0x" + verifiedSlot.toString(16).padStart(64, '0');

      const currentValue = await provider.getStorage(REGISTRY, verifiedSlotHex);

      // If this is the correct slot, the lower bits would be 0 (false) or 1 (true)
      // Set it to 1 (true) and also include stake
      const newValue = ethers.AbiCoder.defaultAbiCoder().encode(["bool"], [true]);

      try {
        await provider.send("tenderly_setStorageAt", [
          REGISTRY,
          verifiedSlotHex,
          newValue
        ]);
      } catch (e) {}
    }

    // Check if it worked
    const agent = await registry.agents(agentId);
    console.log(`Agent ${agentId}: verified=${agent.verified}`);

    if (agent.verified) {
      console.log(`  SUCCESS - mappingSlot found!`);
    }
  }

  // Final check
  console.log("\n=== Final Agent States ===");
  for (const agentId of agentIds) {
    const agent = await registry.agents(agentId);
    console.log(`Agent ${agentId}: verified=${agent.verified}, stake=${ethers.formatEther(agent.stake)} LINK`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
