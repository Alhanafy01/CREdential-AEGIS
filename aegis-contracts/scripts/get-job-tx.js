const { ethers } = require("hardhat");

async function main() {
  const vault = await ethers.getContractAt("StrategyVaultV2", "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407");
  
  // Get recent JobCreated events
  const filter = vault.filters.JobCreated();
  const events = await vault.queryFilter(filter, -1000);
  
  console.log("Recent JobCreated events:");
  for (const event of events.slice(-5)) {
    console.log(`  Job ${event.args.jobId}: tx=${event.transactionHash}`);
  }
  
  // Get job 14 details
  const job14 = await vault.getJob(14);
  console.log("\nJob 14 details:");
  console.log("  Proposer:", job14.proposer);
  console.log("  User Prompt:", job14.userPrompt);
  console.log("  Completed:", job14.completed);
}

main().catch(console.error);
