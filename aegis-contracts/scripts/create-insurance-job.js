/**
 * Create an insurance claim job using agents 7, 8, 9
 * This demonstrates the AEGIS Universal Executor managing a third-party FlightInsurance contract
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("=== Creating Insurance Claim Job ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Contract addresses
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const FLIGHT_INSURANCE = "0x4E84d6394D95bE6d099e78DDD78F538149a02cdA";
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

  const vault = await ethers.getContractAt("StrategyVaultV2", VAULT);
  const flightInsurance = await ethers.getContractAt("FlightInsurance", FLIGHT_INSURANCE);
  const usdc = await ethers.getContractAt("IERC20", USDC);

  // Check FlightInsurance state before
  console.log("=== Pre-Execution State ===");
  const policy = await flightInsurance.getPolicy(1);
  console.log("Policy #1:");
  console.log("  User:", policy.user);
  console.log("  Flight:", policy.flightNumber);
  console.log("  Payout:", ethers.formatUnits(policy.payoutAmount, 6), "USDC");
  console.log("  Active:", policy.isActive);
  console.log("  Claimed:", policy.claimed);

  const insuranceBalance = await usdc.balanceOf(FLIGHT_INSURANCE);
  console.log("FlightInsurance USDC balance:", ethers.formatUnits(insuranceBalance, 6));

  const userBalanceBefore = await usdc.balanceOf(policy.user);
  console.log("User USDC balance:", ethers.formatUnits(userBalanceBefore, 6));

  // Create job with insurance agents [7, 8, 9]
  console.log("\n=== Creating Job ===");
  const userPrompt = "Process insurance claim for Flight AA667 Policy #1";
  const agentIds = [7, 8, 9];

  console.log("Prompt:", userPrompt);
  console.log("Agents:", agentIds);

  // requestStrategyJob(uint256[] agentIds, string userPrompt)
  const tx = await vault.requestStrategyJob(agentIds, userPrompt);
  const receipt = await tx.wait();

  // Find StrategyJobCreated event
  const jobCreatedEvent = receipt.logs.find(log => {
    try {
      const parsed = vault.interface.parseLog(log);
      return parsed?.name === "StrategyJobCreated";
    } catch {
      return false;
    }
  });

  if (jobCreatedEvent) {
    const parsed = vault.interface.parseLog(jobCreatedEvent);
    const jobId = parsed.args.jobId;
    console.log(`\nJob created! ID: ${jobId}`);
    console.log(`TX Hash: ${receipt.hash}`);

    // Check job details using getJob
    const job = await vault.getJob(jobId);
    console.log("\nJob Details:");
    console.log("  Status:", job.status);
    console.log("  Agent IDs:", job.agentIds.map(id => id.toString()).join(", "));

    // userPrompt is stored separately
    const prompt = await vault.getJobUserPrompt(jobId);
    console.log("  Prompt:", prompt);
  }

  console.log("\n=== Job Created Successfully ===");
  console.log("\nTo execute this job, run the CRE council-workflow with:");
  console.log(`  TX Hash: ${receipt.hash}`);
  console.log(`  Agents: [7, 8, 9]`);
  console.log(`  Prompt: "${userPrompt}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
