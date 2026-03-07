const hre = require("hardhat");

const RWA_VAULT = "0x1516AB1339C027841B7343773EDeC8702e91e36B";
const DEMO_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer (current owner):", deployer.address);
  console.log("Demo Wallet (should be owner):", DEMO_WALLET);
  
  const vault = await hre.ethers.getContractAt("RWACollateralVault", RWA_VAULT, deployer);
  
  const currentOwner = await vault.owner();
  console.log("\nCurrent Owner:", currentOwner);
  
  if (currentOwner.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("\nTransferring ownership to demo wallet...");
    const tx = await vault.transferOwnership(DEMO_WALLET);
    await tx.wait();
    console.log("Ownership transferred!");
    
    const newOwner = await vault.owner();
    console.log("New Owner:", newOwner);
  } else if (currentOwner.toLowerCase() === DEMO_WALLET.toLowerCase()) {
    console.log("\nDemo wallet is already the owner!");
  } else {
    console.log("\nUnexpected owner - cannot transfer");
  }
}

main().catch(console.error);
