/**
 * Setup FlightInsurance contract (already deployed)
 * Complete the remaining setup steps:
 * 1. Whitelist it in ACE Policy Engine
 * 2. Register new agents (6, 7, 8) for insurance jobs
 * 3. Create a sample policy for testing
 * 4. Fund the contract with USDC for payouts
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("=== Setting up FlightInsurance Protocol ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Contract addresses
  const FLIGHT_INSURANCE = "0x4E84d6394D95bE6d099e78DDD78F538149a02cdA";
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const ACE_POLICY = "0xCF2F38772b578A61681DD128EDd5c05cb3872634";
  const LINK = "0x514910771AF9Ca656af840dff83E8264EcF986CA";

  const provider = ethers.provider;
  const flightInsurance = await ethers.getContractAt("FlightInsurance", FLIGHT_INSURANCE);

  console.log("FlightInsurance address:", FLIGHT_INSURANCE);

  // =========================================================================
  // 1. Whitelist FlightInsurance in ACE Policy Engine
  // =========================================================================
  console.log("\n1. Whitelisting in ACE Policy Engine...");

  const policyEngine = await ethers.getContractAt("ACEPolicyEngine", ACE_POLICY);

  // Get the whitelist policy address from the engine
  const whitelistPolicyAddress = await policyEngine.whitelistPolicy();
  console.log("   Whitelist Policy:", whitelistPolicyAddress);

  const whitelistPolicy = await ethers.getContractAt("TargetWhitelistPolicy", whitelistPolicyAddress);

  // Check if already whitelisted
  let isWhitelisted = await whitelistPolicy.isWhitelisted(FLIGHT_INSURANCE);
  if (!isWhitelisted) {
    const addTx = await whitelistPolicy.addWhitelistedAddress(FLIGHT_INSURANCE);
    await addTx.wait();
    console.log("   FlightInsurance added to whitelist");
  } else {
    console.log("   Already whitelisted");
  }

  // Verify
  isWhitelisted = await whitelistPolicy.isWhitelisted(FLIGHT_INSURANCE);
  console.log("   Verified whitelisted:", isWhitelisted);

  // =========================================================================
  // 2. Register New Agents for Insurance Jobs (6, 7, 8)
  // =========================================================================
  console.log("\n2. Registering Insurance Specialist Agents...");

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const linkContract = await ethers.getContractAt("IERC20", LINK);

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

  // Agent configurations for insurance
  const insuranceAgents = [
    {
      id: 6,
      name: "FlightWatch Alpha",
      description: "AI agent specialized in flight delay/cancellation verification",
      stake: ethers.parseEther("100"),
      metadataUri: "http://localhost:3000/metadata/6"
    },
    {
      id: 7,
      name: "ClaimVerifier Beta",
      description: "AI agent for cross-referencing insurance claims with data sources",
      stake: ethers.parseEther("100"),
      metadataUri: "http://localhost:3000/metadata/7"
    },
    {
      id: 8,
      name: "RiskAssessor Gamma",
      description: "AI agent for evaluating claim validity and fraud detection",
      stake: ethers.parseEther("100"),
      metadataUri: "http://localhost:3000/metadata/8"
    }
  ];

  for (const agent of insuranceAgents) {
    try {
      // Check if agent already exists
      const existingAgent = await registry.agents(agent.id);
      if (existingAgent.owner !== ethers.ZeroAddress) {
        console.log(`   Agent ${agent.id} already exists, checking verification...`);
        if (!existingAgent.verified) {
          const verifyTx = await registry.verifyAgent(agent.id);
          await verifyTx.wait();
          console.log(`   Verified Agent ${agent.id}`);
        }
        continue;
      }

      const registerTx = await registry.registerAgent(
        agent.id,
        agent.metadataUri,
        agent.stake
      );
      await registerTx.wait();
      console.log(`   Registered Agent ${agent.id}: ${agent.name}`);

      // Verify the agent
      const verifyTx = await registry.verifyAgent(agent.id);
      await verifyTx.wait();
      console.log(`   Verified Agent ${agent.id}`);
    } catch (error) {
      console.log(`   Error with Agent ${agent.id}:`, error.message.slice(0, 100));
    }
  }

  // =========================================================================
  // 3. Fund FlightInsurance with USDC for payouts
  // =========================================================================
  console.log("\n3. Funding FlightInsurance with USDC for payouts...");

  const usdcContract = await ethers.getContractAt("IERC20", USDC);

  // Set USDC balance for FlightInsurance contract (100,000 USDC for payouts)
  const insuranceUsdcSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [FLIGHT_INSURANCE, 9])
  );
  await provider.send("tenderly_setStorageAt", [
    USDC,
    insuranceUsdcSlot,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseUnits("100000", 6)])
  ]);

  const insuranceBalance = await usdcContract.balanceOf(FLIGHT_INSURANCE);
  console.log("   FlightInsurance USDC balance:", ethers.formatUnits(insuranceBalance, 6));

  // =========================================================================
  // 4. Create a sample policy for testing
  // =========================================================================
  console.log("\n4. Creating sample insurance policy...");

  // Check if policy already exists
  const existingPolicyCount = await flightInsurance.policyCount();
  if (existingPolicyCount > 0) {
    console.log(`   ${existingPolicyCount} policies already exist`);
    const policy = await flightInsurance.getPolicy(1);
    console.log("   Policy #1:");
    console.log("     User:", policy.user);
    console.log("     Flight:", policy.flightNumber);
    console.log("     Payout:", ethers.formatUnits(policy.payoutAmount, 6), "USDC");
    console.log("     Active:", policy.isActive);
  } else {
    // Fund test user (deployer) with USDC
    const deployerUsdcSlot = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [deployer.address, 9])
    );
    await provider.send("tenderly_setStorageAt", [
      USDC,
      deployerUsdcSlot,
      ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseUnits("10000", 6)])
    ]);

    // Approve FlightInsurance to spend USDC
    const approveUsdcTx = await usdcContract.approve(FLIGHT_INSURANCE, ethers.parseUnits("10000", 6));
    await approveUsdcTx.wait();

    // Buy a policy: Flight AA667, payout 1000 USDC (premium = 100 USDC)
    const policyTx = await flightInsurance.buyPolicy("AA667", ethers.parseUnits("1000", 6));
    await policyTx.wait();

    // Get policy details
    const policy = await flightInsurance.getPolicy(1);
    console.log("   Policy #1 created:");
    console.log("     User:", policy.user);
    console.log("     Flight:", policy.flightNumber);
    console.log("     Payout:", ethers.formatUnits(policy.payoutAmount, 6), "USDC");
    console.log("     Premium:", ethers.formatUnits(policy.premium, 6), "USDC");
    console.log("     Active:", policy.isActive);
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("\n=== FlightInsurance Setup Complete ===");
  console.log("\nContract Addresses:");
  console.log("  FlightInsurance:", FLIGHT_INSURANCE);
  console.log("  StrategyVault (Universal Executor):", VAULT);
  console.log("  ACE Policy Engine:", ACE_POLICY);
  console.log("\nInsurance Agents Registered: [6, 7, 8]");
  console.log("\nTo create an insurance claim job:");
  console.log('  Prompt: "Process insurance claim for Flight AA667 Policy #1"');
  console.log("  Agents: [6, 7, 8]");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
