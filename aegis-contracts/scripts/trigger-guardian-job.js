const hre = require("hardhat");

/**
 * Create a test position and trigger a guardian job
 * This emits the RWAGuardianJobCreated event that the CRE workflow listens for
 */

const RWA_VAULT_ADDRESS = "0xc2784694c6A6240BE4F7cD04966FEc757A105429";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("=".repeat(70));
  console.log("TRIGGER GUARDIAN JOB FOR CRE WORKFLOW");
  console.log("=".repeat(70));
  console.log("Account:", deployer.address);
  console.log("Vault:", RWA_VAULT_ADDRESS);
  console.log("");

  const vault = await hre.ethers.getContractAt("RWACollateralVault", RWA_VAULT_ADDRESS);

  // Check current position
  const [collateral, debt, hf, price] = await vault.getPosition(deployer.address);
  console.log("CURRENT POSITION:");
  console.log("-".repeat(50));
  console.log("Collateral:", hre.ethers.formatEther(collateral), "ETH");
  console.log("Debt:", hre.ethers.formatEther(debt), "RUSD");
  console.log("Health Factor:", Number(hf) / 100);
  console.log("ETH Price:", Number(price) / 1e8, "USD");
  console.log("");

  // If no position, create one
  if (collateral === 0n) {
    console.log("No position found. Creating test position...");
    console.log("-".repeat(50));

    // Deposit 10 ETH
    console.log("Depositing 10 ETH...");
    const depositTx = await vault.deposit({ value: hre.ethers.parseEther("10") });
    await depositTx.wait();
    console.log("  Deposited 10 ETH");

    // Borrow 10,000 RUSD
    console.log("Borrowing 10,000 RUSD...");
    const borrowTx = await vault.borrow(hre.ethers.parseEther("10000"));
    await borrowTx.wait();
    console.log("  Borrowed 10,000 RUSD");
    console.log("");
  }

  // Set scenario based on command line arg
  const scenario = process.env.SCENARIO || "liquidate";

  if (scenario === "liquidate") {
    // Set price to $1000 to trigger liquidation (HF ~0.77)
    console.log("Setting ETH price to $1000 for LIQUIDATE scenario...");
    const priceTx = await vault.setMockETHPrice(1000n * 10n ** 8n);
    await priceTx.wait();
    console.log("  Price set to $1000 (HF will be ~0.77)");
    console.log("");
  } else if (scenario === "ccip") {
    // Set price to $3500 to trigger CCIP transfer (HF ~2.69)
    console.log("Setting ETH price to $3500 for CCIP_TRANSFER scenario...");
    const priceTx = await vault.setMockETHPrice(3500n * 10n ** 8n);
    await priceTx.wait();
    console.log("  Price set to $3500 (HF will be ~2.69)");
    console.log("");
  } else if (scenario === "hold") {
    // Set price to $2000 for HOLD scenario (HF ~1.54)
    console.log("Setting ETH price to $2000 for HOLD scenario...");
    const priceTx = await vault.setMockETHPrice(2000n * 10n ** 8n);
    await priceTx.wait();
    console.log("  Price set to $2000 (HF will be ~1.54)");
    console.log("");
  }

  // Trigger guardian job
  console.log("TRIGGERING GUARDIAN JOB...");
  console.log("-".repeat(50));

  // Use agent IDs 1 and 2 (simulated agents)
  const agentIds = [1n, 2n];
  console.log("Agent IDs:", agentIds.map(String).join(", "));

  const tx = await vault.requestGuardianJob(agentIds);
  const receipt = await tx.wait();

  console.log("Transaction hash:", tx.hash);
  console.log("Block number:", receipt.blockNumber);

  // Find the event
  const event = receipt.logs.find(log => {
    try {
      const parsed = vault.interface.parseLog({ topics: log.topics, data: log.data });
      return parsed && parsed.name === "RWAGuardianJobCreated";
    } catch { return false; }
  });

  if (event) {
    const parsed = vault.interface.parseLog({ topics: event.topics, data: event.data });
    console.log("");
    console.log("EVENT EMITTED:");
    console.log("-".repeat(50));
    console.log("Event: RWAGuardianJobCreated");
    console.log("Job ID:", parsed.args.jobId.toString());
    console.log("User:", parsed.args.user);
    console.log("Job Data:", parsed.args.jobData);
  }

  // Show final position state
  console.log("");
  console.log("FINAL POSITION:");
  console.log("-".repeat(50));
  const [col2, debt2, hf2, price2] = await vault.getPosition(deployer.address);
  console.log("Collateral:", hre.ethers.formatEther(col2), "ETH");
  console.log("Debt:", hre.ethers.formatEther(debt2), "RUSD");
  console.log("Health Factor:", Number(hf2) / 100);
  console.log("ETH Price:", Number(price2) / 1e8, "USD");

  console.log("");
  console.log("=".repeat(70));
  console.log("DONE! Now run the CRE workflow to process this job.");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
