const { ethers } = require("hardhat");

async function main() {
  const vault = await ethers.getContractAt("StrategyVaultV2", "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407");

  // Check next job ID
  const nextId = await vault.nextJobId();
  console.log("Next Job ID:", nextId.toString());

  // Check all jobs
  for (let jobId = 1; jobId <= Number(nextId); jobId++) {
    try {
      const job = await vault.getJob(jobId);
      const proposer = job.proposer.toString().slice(0,10);
      console.log(`Job ${jobId}: proposer=${proposer}... completed=${job.completed}`);
    } catch (e) {
      console.log(`Job ${jobId}: Does not exist`);
    }
  }
}

main().catch(console.error);
