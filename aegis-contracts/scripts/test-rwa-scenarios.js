const hre = require("hardhat");

/**
 * RWA Guardian Test Scenarios
 *
 * This script sets up test positions and simulates different health factor scenarios
 * for the RWA Guardian workflow to process.
 *
 * Scenarios:
 * 1. HOLD: Normal healthy position (HF between 1.5 and 2.0)
 * 2. PARTIAL_LIQUIDATE: Unhealthy position (HF < 1.5)
 * 3. CCIP_TRANSFER: Over-collateralized position (HF > 2.0)
 */

const RWA_VAULT_ADDRESS = "0xc2784694c6A6240BE4F7cD04966FEc757A105429";
const RUSD_ADDRESS = "0x311828C55A410c984153448C754EE25E330d8037";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("=".repeat(70));
  console.log("RWA GUARDIAN TEST SCENARIOS");
  console.log("=".repeat(70));
  console.log("Account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("");

  // Get contracts
  const vault = await hre.ethers.getContractAt("RWACollateralVault", RWA_VAULT_ADDRESS);
  const rusd = await hre.ethers.getContractAt("RUSD", RUSD_ADDRESS);

  // Check current position
  console.log("CURRENT POSITION:");
  console.log("-".repeat(50));
  const [collateral, debt, hf, price] = await vault.getPosition(deployer.address);
  console.log("Collateral:", hre.ethers.formatEther(collateral), "ETH");
  console.log("Debt:", hre.ethers.formatEther(debt), "RUSD");
  console.log("Health Factor:", Number(hf) / 100);
  console.log("ETH Price:", Number(price) / 1e8, "USD");
  console.log("");

  // Menu
  const args = process.argv.slice(2);
  const scenario = args[0] || "info";

  switch (scenario) {
    case "setup":
      await setupPosition(vault, deployer);
      break;
    case "hold":
      await testHoldScenario(vault);
      break;
    case "liquidate":
      await testLiquidateScenario(vault);
      break;
    case "ccip":
      await testCCIPScenario(vault);
      break;
    case "reset":
      await resetPrice(vault);
      break;
    default:
      printUsage();
  }

  // Show final state
  console.log("\nFINAL STATE:");
  console.log("-".repeat(50));
  const [col2, debt2, hf2, price2] = await vault.getPosition(deployer.address);
  console.log("Collateral:", hre.ethers.formatEther(col2), "ETH");
  console.log("Debt:", hre.ethers.formatEther(debt2), "RUSD");
  console.log("Health Factor:", Number(hf2) / 100);
  console.log("ETH Price:", Number(price2) / 1e8, "USD");
}

function printUsage() {
  console.log("USAGE:");
  console.log("-".repeat(50));
  console.log("npx hardhat run scripts/test-rwa-scenarios.js --network tenderly -- setup");
  console.log("  → Create a test position (deposit 10 ETH, borrow 10000 RUSD)");
  console.log("");
  console.log("npx hardhat run scripts/test-rwa-scenarios.js --network tenderly -- hold");
  console.log("  → Set ETH price to $2000 (HF ~1.54, HOLD scenario)");
  console.log("");
  console.log("npx hardhat run scripts/test-rwa-scenarios.js --network tenderly -- liquidate");
  console.log("  → Set ETH price to $1000 (HF ~0.77, LIQUIDATE scenario)");
  console.log("");
  console.log("npx hardhat run scripts/test-rwa-scenarios.js --network tenderly -- ccip");
  console.log("  → Set ETH price to $3500 (HF ~2.69, CCIP_TRANSFER scenario)");
  console.log("");
  console.log("npx hardhat run scripts/test-rwa-scenarios.js --network tenderly -- reset");
  console.log("  → Reset ETH price to $2000");
}

async function setupPosition(vault, deployer) {
  console.log("SETTING UP TEST POSITION...");
  console.log("-".repeat(50));

  // Deposit 10 ETH
  console.log("Depositing 10 ETH...");
  const depositTx = await vault.deposit({ value: hre.ethers.parseEther("10") });
  await depositTx.wait();
  console.log("✓ Deposited 10 ETH");

  // Borrow 10,000 RUSD
  console.log("Borrowing 10,000 RUSD...");
  const borrowTx = await vault.borrow(hre.ethers.parseEther("10000"));
  await borrowTx.wait();
  console.log("✓ Borrowed 10,000 RUSD");

  console.log("");
  console.log("Position created! Health factor should be ~1.54 at $2000 ETH");
}

async function testHoldScenario(vault) {
  console.log("SETTING UP HOLD SCENARIO (HF 1.5-2.0)...");
  console.log("-".repeat(50));

  // Set ETH price to $2000 (HF ~1.54)
  const price = 2000n * 10n ** 8n;
  console.log("Setting ETH price to $2000...");
  const tx = await vault.setMockETHPrice(price);
  await tx.wait();
  console.log("✓ Price set to $2000");
  console.log("");
  console.log("Expected outcome: Agents should vote HOLD");
}

async function testLiquidateScenario(vault) {
  console.log("SETTING UP LIQUIDATE SCENARIO (HF < 1.5)...");
  console.log("-".repeat(50));

  // Set ETH price to $1000 (HF ~0.77)
  const price = 1000n * 10n ** 8n;
  console.log("Setting ETH price to $1000...");
  const tx = await vault.setMockETHPrice(price);
  await tx.wait();
  console.log("✓ Price set to $1000");
  console.log("");
  console.log("Expected outcome: Agents should vote PARTIAL_LIQUIDATE");
}

async function testCCIPScenario(vault) {
  console.log("SETTING UP CCIP TRANSFER SCENARIO (HF > 2.0)...");
  console.log("-".repeat(50));

  // Set ETH price to $3500 (HF ~2.69)
  const price = 3500n * 10n ** 8n;
  console.log("Setting ETH price to $3500...");
  const tx = await vault.setMockETHPrice(price);
  await tx.wait();
  console.log("✓ Price set to $3500");
  console.log("");
  console.log("Expected outcome: Agents should vote CCIP_TRANSFER");
}

async function resetPrice(vault) {
  console.log("RESETTING ETH PRICE...");
  console.log("-".repeat(50));

  const price = 2000n * 10n ** 8n;
  console.log("Setting ETH price to $2000...");
  const tx = await vault.setMockETHPrice(price);
  await tx.wait();
  console.log("✓ Price reset to $2000");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
