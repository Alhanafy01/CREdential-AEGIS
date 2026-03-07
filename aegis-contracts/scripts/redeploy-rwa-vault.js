const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // Existing deployed addresses
  const RUSD_ADDRESS = "0x311828C55A410c984153448C754EE25E330d8037";

  // CRE Simulation Forwarder Address for Ethereum Mainnet
  const SIMULATION_FORWARDER = "0xa3d1ad4ac559a6575a114998affb2fb2ec97a7d9";

  // Chainlink mainnet addresses
  const ETH_USD_PRICE_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
  const CCIP_ROUTER = "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D";
  const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";

  const CRE_FORWARDER = process.env.CRE_FORWARDER_ADDRESS
    ? hre.ethers.getAddress(process.env.CRE_FORWARDER_ADDRESS.toLowerCase())
    : SIMULATION_FORWARDER;

  console.log("=".repeat(70));
  console.log("AEGIS RWA VAULT - REDEPLOYMENT");
  console.log("=".repeat(70));
  console.log("Deploying with account:", deployer.address);
  console.log("Using existing RUSD:", RUSD_ADDRESS);
  console.log("");

  // Deploy new RWACollateralVault
  console.log("Deploying RWACollateralVault...");
  const RWACollateralVault = await hre.ethers.getContractFactory("RWACollateralVault");
  const vault = await RWACollateralVault.deploy(
    RUSD_ADDRESS,
    CRE_FORWARDER,
    CCIP_ROUTER,
    LINK_TOKEN,
    ETH_USD_PRICE_FEED
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("RWACollateralVault deployed to:", vaultAddress);

  // Set mock ETH price for demo
  console.log("\nSetting mock ETH price...");
  const mockPrice = 2000n * 10n ** 8n; // $2000
  const setPriceTx = await vault.setMockETHPrice(mockPrice);
  await setPriceTx.wait();
  console.log("Mock ETH price set to: $2000");

  // Update RUSD minter to new vault
  console.log("\nUpdating RUSD minter to new vault...");
  const rusd = await hre.ethers.getContractAt("RUSD", RUSD_ADDRESS);
  const setMinterTx = await rusd.setMinter(vaultAddress);
  await setMinterTx.wait();
  console.log("RUSD minter updated to:", vaultAddress);

  console.log("\n" + "=".repeat(70));
  console.log("REDEPLOYMENT COMPLETE");
  console.log("=".repeat(70));
  console.log("New RWACollateralVault:", vaultAddress);
  console.log("");
  console.log("UPDATE THESE FILES:");
  console.log("1. Frontend: /aegis-frontend/src/lib/constants.ts");
  console.log("2. CRE Workflow: /aegis-cre/rwa-guardian-workflow/main.ts");
  console.log("3. PROJECT_STATUS.md");
}

main().catch(console.error);
