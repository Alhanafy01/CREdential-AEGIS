// Disable CCIP simulation mode to use real CCIP
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const REGISTRY_V2 = "0xae633E7208e8D6b2930ad6f698D625C95db932AF";

  console.log("Checking CCIP simulation mode...");

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY_V2);

  const simMode = await registry.ccipSimulationMode();
  console.log("Current CCIP Simulation Mode:", simMode);

  if (simMode) {
    console.log("\nDisabling CCIP simulation mode...");
    const tx = await registry.setCCIPSimulationMode(false);
    console.log("TX Hash:", tx.hash);
    await tx.wait();

    const newSimMode = await registry.ccipSimulationMode();
    console.log("New CCIP Simulation Mode:", newSimMode);
  } else {
    console.log("CCIP simulation mode already disabled.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
