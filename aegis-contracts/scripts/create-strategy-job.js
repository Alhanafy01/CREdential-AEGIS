// Deploy StrategyVaultV2 and TrustedAgentRegistryV2, then create a StrategyJobCreated event
// For CRE workflow simulation
// Run on Tenderly Virtual Mainnet fork

const { ethers } = require("hardhat");

// Mainnet constants
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
const CCIP_ROUTER = "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D";

async function main() {
  console.log("=".repeat(70));
  console.log("AEGIS - Create StrategyJobCreated Event for CRE Simulation");
  console.log("=".repeat(70));

  const signers = await ethers.getSigners();
  const deployer = signers[0];

  console.log("\n📍 Deployer:", deployer.address);

  // ============================================================================
  // Deploy Contracts
  // ============================================================================

  console.log("\n🚀 Deploying contracts...");

  // Deploy MockKeystoneForwarder
  const MockForwarder = await ethers.getContractFactory("MockKeystoneForwarder");
  const forwarder = await MockForwarder.deploy();
  await forwarder.waitForDeployment();
  const forwarderAddress = await forwarder.getAddress();
  console.log("  MockKeystoneForwarder:", forwarderAddress);

  // Deploy StrategyVaultV2 with USDC as base asset
  const StrategyVaultV2 = await ethers.getContractFactory("StrategyVaultV2");
  const vault = await StrategyVaultV2.deploy(forwarderAddress, USDC_ADDRESS);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("  StrategyVaultV2:", vaultAddress);

  // Deploy mock AEGIS token for registry
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const aegisToken = await MockERC20.deploy("AEGIS Token", "AEGIS", 18);
  await aegisToken.waitForDeployment();
  const aegisTokenAddress = await aegisToken.getAddress();
  console.log("  AEGIS Token:", aegisTokenAddress);

  // Deploy TrustedAgentRegistryV2
  const RegistryV2 = await ethers.getContractFactory("TrustedAgentRegistryV2");
  const registry = await RegistryV2.deploy(
    LINK_TOKEN,
    aegisTokenAddress,
    CCIP_ROUTER,
    forwarderAddress,
    deployer.address,
    deployer.address
  );
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("  TrustedAgentRegistryV2:", registryAddress);

  // Set registry on vault
  await vault.setRegistry(registryAddress);
  console.log("  Registry linked to vault");

  // ============================================================================
  // Register and Verify Agents
  // ============================================================================

  console.log("\n🤖 Setting up AI Agents...");

  // Create agent wallet
  const agentWallet = ethers.Wallet.createRandom().connect(ethers.provider);
  await deployer.sendTransaction({ to: agentWallet.address, value: ethers.parseEther("1") });

  // Register Agent 1
  await registry.connect(agentWallet).registerAgent("ipfs://agent-1-metadata", "0x");
  console.log("  Agent 1 registered");

  // Register Agent 2
  await registry.connect(agentWallet).registerAgent("ipfs://agent-2-metadata", "0x");
  console.log("  Agent 2 registered");

  // Verify Agent 1 via forwarder
  const verifyReport1 = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes32"],
    [1, ethers.id("world-id-nullifier-agent-1")]
  );
  await forwarder.deliverReportSimple(registryAddress, verifyReport1);
  console.log("  Agent 1 verified");

  // Verify Agent 2 via forwarder
  const verifyReport2 = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "bytes32"],
    [2, ethers.id("world-id-nullifier-agent-2")]
  );
  await forwarder.deliverReportSimple(registryAddress, verifyReport2);
  console.log("  Agent 2 verified");

  // Check verification status
  const agent1Verified = await registry.isAgentVerified(1);
  const agent2Verified = await registry.isAgentVerified(2);
  console.log(`  Agent 1 verified: ${agent1Verified}`);
  console.log(`  Agent 2 verified: ${agent2Verified}`);

  // ============================================================================
  // Fund Vault with USDC
  // ============================================================================

  console.log("\n💰 Funding vault with USDC...");

  // Use storage manipulation to set USDC balance
  const usdcAmount = ethers.parseUnits("100000", 6); // 100,000 USDC

  const balanceSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [vaultAddress, 9] // USDC balance slot
    )
  );

  await ethers.provider.send("tenderly_setStorageAt", [
    USDC_ADDRESS,
    balanceSlot,
    ethers.zeroPadValue(ethers.toBeHex(usdcAmount), 32)
  ]);

  const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, ethers.provider);
  const vaultBalance = await usdc.balanceOf(vaultAddress);
  console.log("  Vault USDC balance:", ethers.formatUnits(vaultBalance, 6));

  // ============================================================================
  // Create Strategy Job
  // ============================================================================

  console.log("\n📋 Creating strategy job...");

  // Request strategy job with both verified agents
  const agentIds = [1, 2];
  const tx = await vault.connect(deployer).requestStrategyJob(agentIds);
  const receipt = await tx.wait();

  console.log("  Job TX Hash:", tx.hash);
  console.log("  Block Number:", receipt.blockNumber);

  // Find the event
  let eventLogIndex = 0;
  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    // StrategyJobCreated event topic
    const eventTopic = ethers.id("StrategyJobCreated(uint256,address,uint256[])");
    if (log.topics[0] === eventTopic) {
      eventLogIndex = i;
      console.log("  Event Log Index:", eventLogIndex);
      console.log("  Event Topics:", log.topics);
      break;
    }
  }

  // ============================================================================
  // Output for CRE Simulation
  // ============================================================================

  console.log("\n" + "=".repeat(70));
  console.log("CONTRACT ADDRESSES FOR CONFIG.JSON:");
  console.log("=".repeat(70));
  console.log(`  registryAddress: "${registryAddress}"`);
  console.log(`  strategyVaultAddress: "${vaultAddress}"`);
  console.log(`  forwarderAddress: "${forwarderAddress}"`);

  console.log("\n" + "=".repeat(70));
  console.log("CRE SIMULATION PARAMETERS:");
  console.log("=".repeat(70));
  console.log(`\n  Transaction Hash: ${tx.hash}`);
  console.log(`  Event Log Index: ${eventLogIndex}`);

  console.log("\n  Run CRE simulation with:");
  console.log(`  cre workflow simulate ./council-workflow --target local-simulation --evm-tx-hash ${tx.hash} --evm-event-index ${eventLogIndex} --non-interactive`);

  console.log("\n" + "=".repeat(70));
  console.log("✅ SETUP COMPLETE");
  console.log("=".repeat(70));

  // Return for scripting
  return {
    vaultAddress,
    registryAddress,
    forwarderAddress,
    txHash: tx.hash,
    eventLogIndex,
  };
}

main()
  .then((result) => {
    console.log("\nResult:", JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
