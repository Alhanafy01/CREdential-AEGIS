const { ethers } = require("hardhat");

async function main() {
  const vault = await ethers.getContractAt("StrategyVaultV2", "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407");

  console.log("=== Job 42 Status ===");
  const job = await vault.getJob(42);
  console.log("Agent IDs:", job.agentIds.map(id => id.toString()).join(", "));
  console.log("Proposer:", job.proposer);
  console.log("Created At:", new Date(Number(job.createdAt) * 1000).toISOString());
  console.log("Completed:", job.completed);
  console.log("Success:", job.success);

  const isCompleted = await vault.isJobCompleted(42);
  console.log("\nisJobCompleted(42):", isCompleted);

  const prompt = await vault.getJobUserPrompt(42);
  console.log("User Prompt:", prompt);
}

main();
