/**
 * Deploy FlightInsurance contract and set up everything for the demo:
 * 1. Deploy FlightInsurance contract
 * 2. Whitelist it in ACE Policy Engine
 * 3. Register new agents (6, 7, 8) for insurance jobs
 * 4. Create a sample policy for testing
 * 5. Fund the contract with USDC for payouts
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("=== Deploying FlightInsurance Protocol ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Existing contract addresses
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const ACE_POLICY = "0xCF2F38772b578A61681DD128EDd5c05cb3872634";
  const LINK = "0x514910771AF9Ca656af840dff83E8264EcF986CA";

  // =========================================================================
  // 1. Deploy FlightInsurance
  // =========================================================================
  console.log("\n1. Deploying FlightInsurance contract...");

  const FlightInsurance = await ethers.getContractFactory("FlightInsurance");
  const flightInsurance = await FlightInsurance.deploy(VAULT, USDC);
  await flightInsurance.waitForDeployment();

  const flightInsuranceAddress = await flightInsurance.getAddress();
  console.log("   FlightInsurance deployed to:", flightInsuranceAddress);

  // =========================================================================
  // 2. Whitelist FlightInsurance in ACE Policy Engine
  // =========================================================================
  console.log("\n2. Whitelisting in ACE Policy Engine...");

  const policyEngine = await ethers.getContractAt("ACEPolicyEngine", ACE_POLICY);

  // Get the whitelist policy address from the engine
  const whitelistPolicyAddress = await policyEngine.whitelistPolicy();
  console.log("   Whitelist Policy:", whitelistPolicyAddress);

  const whitelistPolicy = await ethers.getContractAt("TargetWhitelistPolicy", whitelistPolicyAddress);

  // Add FlightInsurance to whitelist
  const addTx = await whitelistPolicy.addWhitelistedAddress(flightInsuranceAddress);
  await addTx.wait();
  console.log("   FlightInsurance added to whitelist");

  // Verify it's whitelisted
  const isWhitelisted = await whitelistPolicy.isWhitelisted(flightInsuranceAddress);
  console.log("   Verified whitelisted:", isWhitelisted);

  // =========================================================================
  // 3. Register New Agents for Insurance Jobs (6, 7, 8)
  // =========================================================================
  console.log("\n3. Registering Insurance Specialist Agents...");

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const linkContract = await ethers.getContractAt("IERC20", LINK);

  // Fund deployer with LINK for staking
  const provider = ethers.provider;
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
      description: "AI agent specialized in flight delay/cancellation verification using FlightAware and AviationStack APIs",
      stake: ethers.parseEther("100"),
      metadataUri: "http://localhost:3000/metadata/6"
    },
    {
      id: 7,
      name: "ClaimVerifier Beta",
      description: "AI agent for cross-referencing insurance claims with weather data and airline announcements",
      stake: ethers.parseEther("100"),
      metadataUri: "http://localhost:3000/metadata/7"
    },
    {
      id: 8,
      name: "RiskAssessor Gamma",
      description: "AI agent for evaluating claim validity and fraud detection in insurance payouts",
      stake: ethers.parseEther("100"),
      metadataUri: "http://localhost:3000/metadata/8"
    }
  ];

  for (const agent of insuranceAgents) {
    try {
      // Check if agent already exists
      const existingAgent = await registry.agents(agent.id);
      if (existingAgent.owner !== ethers.ZeroAddress) {
        console.log(`   Agent ${agent.id} already exists, skipping...`);
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
  // 4. Fund FlightInsurance with USDC for payouts
  // =========================================================================
  console.log("\n4. Funding FlightInsurance with USDC for payouts...");

  const usdcContract = await ethers.getContractAt("IERC20", USDC);

  // Set USDC balance for FlightInsurance contract (100,000 USDC for payouts)
  const insuranceUsdcSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [flightInsuranceAddress, 9])
  );
  await provider.send("tenderly_setStorageAt", [
    USDC,
    insuranceUsdcSlot,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseUnits("100000", 6)])
  ]);

  const insuranceBalance = await usdcContract.balanceOf(flightInsuranceAddress);
  console.log("   FlightInsurance USDC balance:", ethers.formatUnits(insuranceBalance, 6));

  // =========================================================================
  // 5. Create a sample policy for testing
  // =========================================================================
  console.log("\n5. Creating sample insurance policy...");

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
  const approveUsdcTx = await usdcContract.approve(flightInsuranceAddress, ethers.parseUnits("10000", 6));
  await approveUsdcTx.wait();

  // Buy a policy: Flight AA667, payout 1000 USDC (premium = 100 USDC)
  const policyTx = await flightInsurance.buyPolicy("AA667", ethers.parseUnits("1000", 6));
  const policyReceipt = await policyTx.wait();

  // Get policy details
  const policy = await flightInsurance.getPolicy(1);
  console.log("   Policy #1 created:");
  console.log("     User:", policy.user);
  console.log("     Flight:", policy.flightNumber);
  console.log("     Payout:", ethers.formatUnits(policy.payoutAmount, 6), "USDC");
  console.log("     Premium:", ethers.formatUnits(policy.premium, 6), "USDC");
  console.log("     Active:", policy.isActive);

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("\n=== FlightInsurance Deployment Complete ===");
  console.log("\nContract Addresses:");
  console.log("  FlightInsurance:", flightInsuranceAddress);
  console.log("  StrategyVault (Universal Executor):", VAULT);
  console.log("  ACE Policy Engine:", ACE_POLICY);
  console.log("  Registry:", REGISTRY);
  console.log("\nRegistered Insurance Agents:");
  for (const agent of insuranceAgents) {
    console.log(`  Agent ${agent.id}: ${agent.name}`);
  }
  console.log("\nSample Policy:");
  console.log("  Policy ID: 1");
  console.log("  Flight: AA667");
  console.log("  Payout: 1000 USDC");
  console.log("\n>>> IMPORTANT: Update the mock agent server with this address:");
  console.log(`    FLIGHT_INSURANCE = "${flightInsuranceAddress}"`);
  console.log("\n>>> Then create a job with agents [6, 7, 8] and prompt:");
  console.log('    "Process insurance claim for Flight AA667 Policy #1"');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
