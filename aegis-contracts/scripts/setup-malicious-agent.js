/**
 * Setup Malicious Agent Demo
 * 1. Verify Agent 3 directly (skip World ID for testing)
 * 2. Stake large amount (500 LINK) to Agent 3
 */

const { ethers } = require("hardhat");

async function main() {
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
  const MALICIOUS_AGENT_ID = 3;
  const STAKE_AMOUNT = ethers.parseEther("500"); // 500 LINK

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const linkToken = await ethers.getContractAt("IERC20", LINK_TOKEN);

  // Check current status
  console.log("\n=== Current Agent 3 Status ===");
  let agent3 = await registry.agents(MALICIOUS_AGENT_ID);
  console.log(`  Verified: ${agent3.verified}`);
  console.log(`  Stake: ${ethers.formatEther(agent3.stake)} LINK`);
  console.log(`  Reputation: ${agent3.reputation}`);
  console.log(`  Owner: ${agent3.owner}`);

  // Step 1: Verify Agent 3 directly (owner can verify for testing)
  if (!agent3.verified) {
    console.log("\n=== Verifying Agent 3 (Bypassing World ID for Demo) ===");

    // Check if we're the owner
    if (agent3.owner.toLowerCase() === deployer.address.toLowerCase()) {
      // Use verifyAgentDirect which allows owner to verify
      try {
        const verifyTx = await registry.verifyAgentDirect(MALICIOUS_AGENT_ID);
        await verifyTx.wait();
        console.log("Agent 3 verified directly!");
      } catch (e) {
        console.log("verifyAgentDirect failed, trying alternative...");

        // Alternative: Call setVerified via Tenderly impersonation
        const ownerAddress = await registry.owner();
        console.log("Registry owner:", ownerAddress);

        // Impersonate owner
        await ethers.provider.send("tenderly_setBalance", [
          ownerAddress,
          ethers.toQuantity(ethers.parseEther("100"))
        ]);

        const ownerSigner = await ethers.getImpersonatedSigner(ownerAddress);
        const registryAsOwner = registry.connect(ownerSigner);

        try {
          // Try direct state manipulation via verifyAgent
          const tx = await registryAsOwner.verifyAgent(MALICIOUS_AGENT_ID, "0x" + "00".repeat(32));
          await tx.wait();
          console.log("Agent 3 verified via owner!");
        } catch (e2) {
          console.log("Owner verification also failed, using storage manipulation...");

          // Direct storage manipulation for verified flag
          // agents mapping is at slot 2 (after owner and nextAgentId)
          // agents[3].verified is part of the Agent struct
          // Slot = keccak256(abi.encode(agentId, 2)) + offset for verified field

          const agentSlot = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
              ["uint256", "uint256"],
              [MALICIOUS_AGENT_ID, 2]
            )
          );

          // The verified field is at offset 3 in the struct (packed with other fields)
          // Agent struct: agentId, agentAddress, owner, humanIdHash, verified, stake, reputation, metadataURI
          // We need to find the exact slot for verified field

          // For Tenderly, we can use tenderly_setStorageAt to modify verified directly
          // First, let's read the current slot to understand the layout
          const slot3 = BigInt(agentSlot) + 3n; // verified field offset
          const currentValue = await ethers.provider.getStorage(REGISTRY, slot3);
          console.log("Current storage at verified slot:", currentValue);

          // Set verified to true (1)
          // The verified bool is likely packed with other data, let's set just that bit
          await ethers.provider.send("tenderly_setStorageAt", [
            REGISTRY,
            "0x" + slot3.toString(16).padStart(64, '0'),
            "0x0000000000000000000000000000000000000000000000000000000000000001"
          ]);

          console.log("Verified flag set via storage manipulation!");
        }
      }
    } else {
      console.log("Cannot verify - deployer is not the owner of Agent 3");
    }
  }

  // Refresh agent data
  agent3 = await registry.agents(MALICIOUS_AGENT_ID);
  console.log(`\n=== Agent 3 After Verification ===`);
  console.log(`  Verified: ${agent3.verified}`);

  // Step 2: Stake large amount to Agent 3
  console.log(`\n=== Staking ${ethers.formatEther(STAKE_AMOUNT)} LINK to Agent 3 ===`);

  // Fund deployer with LINK if needed
  const deployerBalance = await linkToken.balanceOf(deployer.address);
  console.log(`Deployer LINK balance: ${ethers.formatEther(deployerBalance)} LINK`);

  if (deployerBalance < STAKE_AMOUNT) {
    console.log("Funding deployer with LINK...");
    const balanceSlot = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256"],
        [deployer.address, 1]
      )
    );

    await ethers.provider.send("tenderly_setStorageAt", [
      LINK_TOKEN,
      balanceSlot,
      ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther("10000")])
    ]);

    const newBalance = await linkToken.balanceOf(deployer.address);
    console.log(`New deployer LINK balance: ${ethers.formatEther(newBalance)} LINK`);
  }

  // Approve and stake
  console.log("Approving LINK for registry...");
  const approveTx = await linkToken.approve(REGISTRY, STAKE_AMOUNT);
  await approveTx.wait();

  console.log(`Staking ${ethers.formatEther(STAKE_AMOUNT)} LINK...`);
  try {
    const stakeTx = await registry.stake(MALICIOUS_AGENT_ID, STAKE_AMOUNT);
    await stakeTx.wait();
    console.log("Stake successful!");
  } catch (e) {
    console.log("Stake failed:", e.message);

    // If not verified, try to verify first
    if (e.message.includes("not verified")) {
      console.log("Agent not verified - attempting direct verification...");
    }
  }

  // Final status
  console.log("\n=== Final Agent 3 Status ===");
  agent3 = await registry.agents(MALICIOUS_AGENT_ID);
  console.log(`  Verified: ${agent3.verified}`);
  console.log(`  Stake: ${ethers.formatEther(agent3.stake)} LINK`);
  console.log(`  Reputation: ${agent3.reputation}`);
  console.log(`  Owner: ${agent3.owner}`);

  // Also show all agents for comparison
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
