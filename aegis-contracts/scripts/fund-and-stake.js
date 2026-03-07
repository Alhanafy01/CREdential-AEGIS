/**
 * Fund wallet with LINK and stake to all verified agents
 * Uses Tenderly's setStorageAt to directly set LINK balance
 */

const { ethers } = require("hardhat");

async function main() {
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
  const USER_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Default tenderly wallet

  const STAKE_AMOUNT = ethers.parseEther("100"); // 100 LINK per agent

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Get contracts
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const linkToken = await ethers.getContractAt("IERC20", LINK_TOKEN);

  // Check current LINK balance
  let userBalance = await linkToken.balanceOf(USER_WALLET);
  console.log(`\nCurrent LINK balance of ${USER_WALLET}: ${ethers.formatEther(userBalance)} LINK`);

  // Fund wallet with LINK using Tenderly's setStorageAt
  console.log("\n=== Funding Wallet with LINK ===");

  // LINK token uses slot 1 for balances mapping
  // balanceOf[address] is at keccak256(abi.encode(address, 1))
  const balanceSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [USER_WALLET, 1]
    )
  );

  const fundAmount = ethers.parseEther("10000"); // 10,000 LINK

  // Set the balance directly via Tenderly
  await ethers.provider.send("tenderly_setStorageAt", [
    LINK_TOKEN,
    balanceSlot,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [fundAmount])
  ]);

  userBalance = await linkToken.balanceOf(USER_WALLET);
  console.log(`New LINK balance: ${ethers.formatEther(userBalance)} LINK`);

  // Also fund deployer with LINK
  const deployerBalanceSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [deployer.address, 1]
    )
  );

  await ethers.provider.send("tenderly_setStorageAt", [
    LINK_TOKEN,
    deployerBalanceSlot,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [fundAmount])
  ]);

  const deployerBalance = await linkToken.balanceOf(deployer.address);
  console.log(`Deployer LINK balance: ${ethers.formatEther(deployerBalance)} LINK`);

  // Get all verified agents
  console.log("\n=== Finding Verified Agents ===");
  const nextAgentId = await registry.nextAgentId();
  const verifiedAgents = [];

  for (let i = 1; i < Number(nextAgentId); i++) {
    const isVerified = await registry.isAgentVerified(i);
    const agent = await registry.agents(i);
    console.log(`Agent ${i}: verified=${isVerified}, stake=${ethers.formatEther(agent.stake)} LINK, owner=${agent.owner}`);
    if (isVerified) {
      verifiedAgents.push({ id: i, stake: agent.stake, owner: agent.owner });
    }
  }

  console.log(`\nFound ${verifiedAgents.length} verified agents`);

  if (verifiedAgents.length === 0) {
    console.log("No verified agents to stake to!");
    console.log("\nWallet has been funded with LINK. You can now stake from the frontend.");
    return;
  }

  // Stake to each verified agent using deployer
  console.log("\n=== Staking LINK to Verified Agents ===");

  // Approve registry to spend LINK
  const totalStake = STAKE_AMOUNT * BigInt(verifiedAgents.length);
  console.log(`Approving ${ethers.formatEther(totalStake)} LINK for registry...`);

  const approveTx = await linkToken.connect(deployer).approve(REGISTRY, totalStake);
  await approveTx.wait();
  console.log("Approved!");

  // Stake to each agent
  for (const agent of verifiedAgents) {
    console.log(`\nStaking ${ethers.formatEther(STAKE_AMOUNT)} LINK to Agent ${agent.id}...`);
    try {
      const stakeTx = await registry.connect(deployer).stake(agent.id, STAKE_AMOUNT);
      await stakeTx.wait();
      console.log(`  Success! TX: ${stakeTx.hash}`);
    } catch (error) {
      console.log(`  Failed: ${error.message}`);
    }
  }

  // Final status
  console.log("\n=== Final Status ===");
  userBalance = await linkToken.balanceOf(USER_WALLET);
  console.log(`User LINK balance: ${ethers.formatEther(userBalance)} LINK`);

  for (let i = 1; i < Number(nextAgentId); i++) {
    const agent = await registry.agents(i);
    const isVerified = await registry.isAgentVerified(i);
    console.log(`Agent ${i}: verified=${isVerified}, stake=${ethers.formatEther(agent.stake)} LINK, reputation=${agent.reputation}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
