const hre = require("hardhat");
async function main() {
  const STAKING_TOKEN = "0x6442D631aa1763138cd8e922da9da2ADEF5509df";
  const WALLET = "0x29a3F93aFC9b52d9122358DbD65970aEc5c1697a";
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Minting AEGIS tokens to:", WALLET);
  
  const token = await hre.ethers.getContractAt("MockERC20", STAKING_TOKEN, deployer);
  
  // Mint 10000 AEGIS tokens
  const amount = hre.ethers.parseEther("10000");
  const tx = await token.mint(WALLET, amount);
  await tx.wait();
  
  const balance = await token.balanceOf(WALLET);
  console.log("New Balance:", hre.ethers.formatEther(balance), "AEGIS");
  console.log("Done! You can now stake tokens.");
}
main();
