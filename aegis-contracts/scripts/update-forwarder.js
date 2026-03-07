// Update forwarder address in TrustedAgentRegistryV2
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const REGISTRY_V2 = "0xae633E7208e8D6b2930ad6f698D625C95db932AF";
  const CRE_FORWARDER = "0xa3d1ad4ac559a6575a114998affb2fb2ec97a7d9";  // From CRE transaction trace

  console.log("Updating forwarder address on TrustedAgentRegistryV2...");
  console.log("Registry:", REGISTRY_V2);
  console.log("New Forwarder:", CRE_FORWARDER);
  console.log("Deployer (owner):", deployer.address);

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY_V2);

  // Check current forwarder
  const currentForwarder = await registry.getForwarderAddress();
  console.log("\nCurrent Forwarder:", currentForwarder);

  // Check owner
  const owner = await registry.owner();
  console.log("Registry Owner:", owner);

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("ERROR: Deployer is not the owner!");
    return;
  }

  // Update forwarder
  console.log("\nUpdating forwarder to CRE forwarder...");
  const tx = await registry.setForwarderAddress(CRE_FORWARDER);
  console.log("TX Hash:", tx.hash);
  await tx.wait();

  // Verify
  const newForwarder = await registry.getForwarderAddress();
  console.log("\nNew Forwarder Address:", newForwarder);
  console.log("Success:", newForwarder.toLowerCase() === CRE_FORWARDER.toLowerCase());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
