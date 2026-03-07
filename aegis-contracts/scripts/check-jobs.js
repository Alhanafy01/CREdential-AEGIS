const hre = require("hardhat");
async function main() {
  const vault = await hre.ethers.getContractAt("StrategyVault", "0x2E3A73aDB42e2DE8EAA8056c262C7306a1DBa036");
  const nextJobId = await vault.nextJobId();
  console.log("Total Jobs:", Number(nextJobId) - 1);
  console.log("");
  for (let i = 1; i < Number(nextJobId); i++) {
    const job = await vault.getJob(i);
    console.log(`Job ${i}: completed=${job.completed}, approved=${job.approved}`);
  }
}
main();
