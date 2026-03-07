const { ethers } = require("hardhat");

async function main() {
  const fi = await ethers.getContractAt("FlightInsurance", "0x4E84d6394D95bE6d099e78DDD78F538149a02cdA");

  console.log("=== Policy #1 Status ===");
  const p = await fi.getPolicy(1);
  console.log("User:", p[0]);
  console.log("Flight:", p[1]);
  console.log("Payout:", ethers.formatUnits(p[2], 6), "USDC");
  console.log("Premium:", ethers.formatUnits(p[3], 6), "USDC");
  console.log("Purchase Time:", new Date(Number(p[4]) * 1000).toISOString());
  console.log("Is Active:", p[5]);

  console.log("\n=== Contract Stats ===");
  const stats = await fi.getStats();
  console.log("Total Policies:", stats[0].toString());
  console.log("Total Premiums:", ethers.formatUnits(stats[1], 6), "USDC");
  console.log("Total Payouts:", ethers.formatUnits(stats[2], 6), "USDC");
  console.log("Contract Balance:", ethers.formatUnits(stats[3], 6), "USDC");

  console.log("\n=== Universal Executor ===");
  const executor = await fi.universalExecutor();
  console.log("Universal Executor:", executor);
  console.log("Expected Vault:", "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407");
  console.log("Match:", executor.toLowerCase() === "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407".toLowerCase());
}

main();
