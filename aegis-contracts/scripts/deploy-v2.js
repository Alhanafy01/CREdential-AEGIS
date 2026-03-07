// Deploy TrustedAgentRegistryV2 and UnifiedExtractorV2
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying V2 contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // ============ Configuration ============

  // Mainnet LINK token address (Tenderly fork)
  const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";

  // Existing AEGIS token (for rewards)
  const AEGIS_TOKEN = "0x6442D631aa1763138cd8e922da9da2ADEF5509df";

  // CCIP Router (Mainnet)
  const CCIP_ROUTER = "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D";

  // CRE Forwarder (MockKeystoneForwarder)
  const CRE_FORWARDER = "0x0752251691D1E48385199e461C555bE31e9EC14e";

  // Controller and Treasury
  const CONTROLLER = deployer.address;
  const TREASURY = deployer.address;

  // Demo wallet for testing
  const DEMO_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

  console.log("\n============ Deployment Configuration ============");
  console.log("LINK Token:", LINK_TOKEN);
  console.log("AEGIS Token:", AEGIS_TOKEN);
  console.log("CCIP Router:", CCIP_ROUTER);
  console.log("CRE Forwarder:", CRE_FORWARDER);
  console.log("Controller:", CONTROLLER);
  console.log("Treasury:", TREASURY);

  // ============ Deploy TrustedAgentRegistryV2 ============

  console.log("\n============ Deploying TrustedAgentRegistryV2 ============");

  const RegistryV2 = await ethers.getContractFactory("TrustedAgentRegistryV2");
  const registryV2 = await RegistryV2.deploy(
    LINK_TOKEN,
    AEGIS_TOKEN,
    CCIP_ROUTER,
    CRE_FORWARDER,
    CONTROLLER,
    TREASURY
  );
  await registryV2.waitForDeployment();
  const registryV2Address = await registryV2.getAddress();
  console.log("TrustedAgentRegistryV2 deployed to:", registryV2Address);

  // ============ Deploy UnifiedExtractorV2 ============

  console.log("\n============ Deploying UnifiedExtractorV2 ============");

  const ExtractorV2 = await ethers.getContractFactory("UnifiedExtractorV2");
  const extractorV2 = await ExtractorV2.deploy(registryV2Address);
  await extractorV2.waitForDeployment();
  const extractorV2Address = await extractorV2.getAddress();
  console.log("UnifiedExtractorV2 deployed to:", extractorV2Address);

  // ============ Fund Contract with LINK for CCIP Fees ============

  console.log("\n============ Funding CCIP Fee Balance ============");

  // Check if deployer has LINK
  const linkToken = await ethers.getContractAt("IERC20", LINK_TOKEN);
  const deployerLinkBalance = await linkToken.balanceOf(deployer.address);
  console.log("Deployer LINK balance:", ethers.formatEther(deployerLinkBalance), "LINK");

  if (deployerLinkBalance > 0n) {
    // Transfer some LINK to the registry for CCIP fees
    const ccipFundAmount = ethers.parseEther("10"); // 10 LINK for CCIP fees
    if (deployerLinkBalance >= ccipFundAmount) {
      const tx = await linkToken.transfer(registryV2Address, ccipFundAmount);
      await tx.wait();
      console.log("Transferred 10 LINK to registry for CCIP fees");
    } else {
      console.log("Insufficient LINK, transferring available balance");
      const tx = await linkToken.transfer(registryV2Address, deployerLinkBalance);
      await tx.wait();
    }
  } else {
    console.log("WARNING: Deployer has no LINK. CCIP broadcasts will fail until funded.");
    console.log("To fund: Transfer LINK to", registryV2Address);
  }

  // ============ Fund Contract with AEGIS for Rewards ============

  console.log("\n============ Funding Reward Pool ============");

  const aegisToken = await ethers.getContractAt("IERC20", AEGIS_TOKEN);
  const deployerAegisBalance = await aegisToken.balanceOf(deployer.address);
  console.log("Deployer AEGIS balance:", ethers.formatEther(deployerAegisBalance), "AEGIS");

  if (deployerAegisBalance > 0n) {
    const rewardFundAmount = ethers.parseEther("10000"); // 10,000 AEGIS for rewards
    if (deployerAegisBalance >= rewardFundAmount) {
      // Approve and deposit rewards
      const approveTx = await aegisToken.approve(registryV2Address, rewardFundAmount);
      await approveTx.wait();
      const depositTx = await registryV2.depositRewards(rewardFundAmount);
      await depositTx.wait();
      console.log("Deposited 10,000 AEGIS to reward pool");
    } else {
      console.log("Depositing available AEGIS balance as rewards");
      const approveTx = await aegisToken.approve(registryV2Address, deployerAegisBalance);
      await approveTx.wait();
      const depositTx = await registryV2.depositRewards(deployerAegisBalance);
      await depositTx.wait();
    }
  } else {
    console.log("WARNING: Deployer has no AEGIS. Rewards will fail until funded.");
  }

  // ============ Verify Deployment ============

  console.log("\n============ Verifying Deployment ============");

  const rewardPoolBalance = await registryV2.getRewardPoolBalance();
  const ccipFeeBalance = await registryV2.getCCIPFeeBalance();

  console.log("Reward Pool Balance:", ethers.formatEther(rewardPoolBalance), "AEGIS");
  console.log("CCIP Fee Balance:", ethers.formatEther(ccipFeeBalance), "LINK");

  // ============ Summary ============

  console.log("\n============ DEPLOYMENT SUMMARY ============");
  console.log("TrustedAgentRegistryV2:", registryV2Address);
  console.log("UnifiedExtractorV2:", extractorV2Address);
  console.log("");
  console.log("Update these addresses in:");
  console.log("  - aegis-frontend/src/lib/constants.ts");
  console.log("  - aegis-cre/*/config.json files");
  console.log("");
  console.log("Report Types for CRE workflows:");
  console.log("  - VERIFY (1): World ID verification + auto CCIP");
  console.log("  - REPUTATION (2): Reputation delta update");
  console.log("  - SLASH (3): Stake slashing");
  console.log("  - REWARD (4): AEGIS reward distribution");
  console.log("");
  console.log("CCIP Destination Chain: Base Mainnet (15971525489660198786)");

  return {
    registryV2: registryV2Address,
    extractorV2: extractorV2Address
  };
}

main()
  .then((addresses) => {
    console.log("\nDeployment successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
