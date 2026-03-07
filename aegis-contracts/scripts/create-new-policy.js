const { ethers } = require("hardhat");

async function main() {
  console.log("=== Creating New Insurance Policy ===\n");

  const [deployer] = await ethers.getSigners();
  const FLIGHT_INSURANCE = "0x4E84d6394D95bE6d099e78DDD78F538149a02cdA";
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";

  const flightInsurance = await ethers.getContractAt("FlightInsurance", FLIGHT_INSURANCE);
  const usdc = await ethers.getContractAt("IERC20", USDC);
  const vault = await ethers.getContractAt("StrategyVaultV2", VAULT);

  // Fund deployer with USDC
  const provider = ethers.provider;
  const usdcSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [deployer.address, 9])
  );
  await provider.send("tenderly_setStorageAt", [
    USDC,
    usdcSlot,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseUnits("10000", 6)])
  ]);

  // Approve and buy policy
  await (await usdc.approve(FLIGHT_INSURANCE, ethers.parseUnits("1000", 6))).wait();
  
  const buyTx = await flightInsurance.buyPolicy("UA456", ethers.parseUnits("500", 6));
  const receipt = await buyTx.wait();
  
  const policyCount = await flightInsurance.policyCount();
  console.log("New Policy ID:", policyCount.toString());
  
  const policy = await flightInsurance.getPolicy(policyCount);
  console.log("Flight:", policy[1]);
  console.log("Payout:", ethers.formatUnits(policy[2], 6), "USDC");
  console.log("Premium:", ethers.formatUnits(policy[3], 6), "USDC");
  console.log("Active:", policy[5]);

  // Create job for this policy
  console.log("\n=== Creating Insurance Job ===");
  const jobTx = await vault.requestStrategyJob(
    [7, 8, 9],
    `Process insurance claim for Flight UA456 Policy #${policyCount}`
  );
  const jobReceipt = await jobTx.wait();
  
  const event = jobReceipt.logs.find(log => {
    try { return vault.interface.parseLog(log)?.name === "StrategyJobCreated"; }
    catch { return false; }
  });
  
  const jobId = vault.interface.parseLog(event).args.jobId;
  console.log("Job ID:", jobId.toString());
  console.log("TX Hash:", jobReceipt.hash);
  console.log("\nRun CRE with this TX hash!");
}

main();
