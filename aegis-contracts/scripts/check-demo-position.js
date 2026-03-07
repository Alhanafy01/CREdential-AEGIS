const hre = require("hardhat");
async function main() {
  const vault = await hre.ethers.getContractAt("RWACollateralVault", "0x1516AB1339C027841B7343773EDeC8702e91e36B");
  const [col, debt, hf, price] = await vault.getPosition("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  console.log("Demo Wallet Position:");
  console.log("  Collateral:", hre.ethers.formatEther(col), "ETH");
  console.log("  Debt:", hre.ethers.formatEther(debt), "RUSD");
  console.log("  Health Factor:", Number(hf)/100);
  console.log("  ETH Price: $" + Number(price)/1e8);
  if (col == 0n && debt == 0n) console.log("\n✓ CLEAN - Ready for fresh demo!");
  else if (debt > 0n) console.log("\n⚠ Has debt - needs cleanup");
}
main();
