/**
 * Update Vault Forwarder to CRE Simulation Forwarder
 */
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const CRE_FORWARDER = "0xa3d1ad4ac559a6575a114998affb2fb2ec97a7d9";
  const VAULT_ADDRESS = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";

  console.log("Updating vault forwarder address...");
  console.log("Vault:", VAULT_ADDRESS);
  console.log("New Forwarder:", CRE_FORWARDER);

  const vault = await ethers.getContractAt(
    ["function setForwarderAddress(address) external", "function getForwarderAddress() external view returns (address)"],
    VAULT_ADDRESS,
    deployer
  );

  // Get current forwarder
  const currentForwarder = await vault.getForwarderAddress();
  console.log("Current Forwarder:", currentForwarder);

  // Update forwarder
  const tx = await vault.setForwarderAddress(CRE_FORWARDER);
  console.log("TX:", tx.hash);
  await tx.wait();
  console.log("[OK] Forwarder updated");

  // Verify
  const newForwarder = await vault.getForwarderAddress();
  console.log("New Forwarder Address:", newForwarder);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
