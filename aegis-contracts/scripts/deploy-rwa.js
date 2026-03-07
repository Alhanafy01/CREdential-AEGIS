const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  // CRE Simulation Forwarder Address for Ethereum Mainnet
  const SIMULATION_FORWARDER = "0xa3d1ad4ac559a6575a114998affb2fb2ec97a7d9";

  // Chainlink mainnet addresses (we're on Tenderly Virtual Mainnet - forked from Ethereum)
  const ETH_USD_PRICE_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
  const CCIP_ROUTER = "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D";
  const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";

  // Allow override via env var
  const CRE_FORWARDER = process.env.CRE_FORWARDER_ADDRESS
    ? hre.ethers.getAddress(process.env.CRE_FORWARDER_ADDRESS.toLowerCase())
    : SIMULATION_FORWARDER;

  console.log("=".repeat(70));
  console.log("AEGIS RWA GUARDIAN - CONTRACT DEPLOYMENT");
  console.log("=".repeat(70));
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("CRE Forwarder Address:", CRE_FORWARDER);
  console.log("Network:", hre.network.name);
  console.log("");

  // ============================================================
  // STEP 1: Deploy RUSD Stablecoin (with temporary minter)
  // ============================================================
  console.log("STEP 1: Deploying RUSD Stablecoin...");

  // Deploy with deployer as temporary minter, will update after vault deployment
  const RUSD = await hre.ethers.getContractFactory("RUSD");
  const rusd = await RUSD.deploy(deployer.address);
  await rusd.waitForDeployment();
  const rusdAddress = await rusd.getAddress();
  console.log("✅ RUSD deployed to:", rusdAddress);
  console.log("   - Temporary minter:", deployer.address);
  console.log("");

  // ============================================================
  // STEP 2: Deploy RWAExtractor (ACE Policy Routing)
  // ============================================================
  console.log("STEP 2: Deploying RWAExtractor...");
  const RWAExtractor = await hre.ethers.getContractFactory("RWAExtractor");
  const rwaExtractor = await RWAExtractor.deploy();
  await rwaExtractor.waitForDeployment();
  const rwaExtractorAddress = await rwaExtractor.getAddress();
  console.log("✅ RWAExtractor deployed to:", rwaExtractorAddress);
  console.log("");

  // ============================================================
  // STEP 3: Deploy RWACollateralVault
  // ============================================================
  console.log("STEP 3: Deploying RWACollateralVault...");
  console.log("   - RUSD Token:", rusdAddress);
  console.log("   - CRE Forwarder:", CRE_FORWARDER);
  console.log("   - CCIP Router:", CCIP_ROUTER);
  console.log("   - LINK Token:", LINK_TOKEN);
  console.log("   - ETH/USD Feed:", ETH_USD_PRICE_FEED);

  const RWACollateralVault = await hre.ethers.getContractFactory("RWACollateralVault");
  const vault = await RWACollateralVault.deploy(
    rusdAddress,
    CRE_FORWARDER,
    CCIP_ROUTER,
    LINK_TOKEN,
    ETH_USD_PRICE_FEED
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ RWACollateralVault deployed to:", vaultAddress);
  console.log("");

  // ============================================================
  // STEP 4: Update RUSD minter to vault
  // ============================================================
  console.log("STEP 4: Setting vault as RUSD minter...");
  const setMinterTx = await rusd.setMinter(vaultAddress);
  await setMinterTx.wait();
  console.log("✅ RUSD minter updated to vault:", vaultAddress);
  console.log("");

  // ============================================================
  // STEP 5: Set mock ETH price for demo (Tenderly State Sync disabled)
  // ============================================================
  console.log("STEP 5: Setting mock ETH price for demo...");
  const mockPrice = 2000n * 10n ** 8n; // $2000 with 8 decimals
  const setPriceTx = await vault.setMockETHPrice(mockPrice);
  await setPriceTx.wait();
  console.log("✅ Mock ETH price set to: $2000");
  console.log("");

  // ============================================================
  // DEPLOYMENT SUMMARY
  // ============================================================
  console.log("=".repeat(70));
  console.log("RWA GUARDIAN DEPLOYMENT COMPLETE");
  console.log("=".repeat(70));
  console.log("");
  console.log("CONTRACT ADDRESSES:");
  console.log("-------------------");
  console.log(`RUSD Stablecoin:         ${rusdAddress}`);
  console.log(`RWAExtractor:            ${rwaExtractorAddress}`);
  console.log(`RWACollateralVault:      ${vaultAddress}`);
  console.log("");
  console.log("CHAINLINK INTEGRATION:");
  console.log("----------------------");
  console.log(`CRE Forwarder:           ${CRE_FORWARDER}`);
  console.log(`CCIP Router:             ${CCIP_ROUTER}`);
  console.log(`LINK Token:              ${LINK_TOKEN}`);
  console.log(`ETH/USD Price Feed:      ${ETH_USD_PRICE_FEED}`);
  console.log("");
  console.log("VAULT CONFIGURATION:");
  console.log("--------------------");
  console.log("Collateral Ratio:        130%");
  console.log("Liquidation Bonus:       10%");
  console.log("Mock ETH Price:          $2000 (enabled)");
  console.log("");
  console.log("NEXT STEPS:");
  console.log("-----------");
  console.log("1. Create test positions: deposit ETH and borrow RUSD");
  console.log("2. Deploy rwa-guardian-workflow to CRE");
  console.log("3. Test liquidation by lowering mock ETH price");
  console.log("4. Test CCIP transfer for healthy positions");
  console.log("");

  // Return addresses for programmatic use
  const addresses = {
    network: hre.network.name,
    deployer: deployer.address,
    contracts: {
      RUSD: rusdAddress,
      RWAExtractor: rwaExtractorAddress,
      RWACollateralVault: vaultAddress,
    },
    chainlink: {
      CRE_Forwarder: CRE_FORWARDER,
      CCIP_Router: CCIP_ROUTER,
      LINK_Token: LINK_TOKEN,
      ETH_USD_Feed: ETH_USD_PRICE_FEED,
    },
    config: {
      collateralRatio: 130,
      liquidationBonus: 10,
      mockETHPrice: "2000",
      useMockPrice: true,
    }
  };

  console.log("=".repeat(70));
  console.log("ADDRESSES (JSON) - Save for workflow config:");
  console.log("=".repeat(70));
  console.log(JSON.stringify(addresses, null, 2));

  return addresses;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
