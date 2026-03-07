const hre = require("hardhat");
async function main() {
  const REGISTRY = "0x608f4Ea047470a36Df5BC5D6121A99AC50394a8c";
  const STAKING_TOKEN = "0x6442D631aa1763138cd8e922da9da2ADEF5509df";
  const WALLET = "0x29a3F93aFC9b52d9122358DbD65970aEc5c1697a";
  
  const token = await hre.ethers.getContractAt("IERC20", STAKING_TOKEN);
  const reg = await hre.ethers.getContractAt("TrustedAgentRegistry", REGISTRY);
  
  const balance = await token.balanceOf(WALLET);
  const allowance = await token.allowance(WALLET, REGISTRY);
  const stakingToken = await reg.stakingToken();
  
  console.log("Staking Token in Registry:", stakingToken);
  console.log("Token Balance:", hre.ethers.formatEther(balance), "AEGIS");
  console.log("Allowance to Registry:", hre.ethers.formatEther(allowance), "AEGIS");
  console.log("Trying to stake: 100 AEGIS");
  console.log("");
  
  if (balance < hre.ethers.parseEther("100")) {
    console.log("ERROR: Insufficient balance!");
  }
  if (allowance < hre.ethers.parseEther("100")) {
    console.log("ERROR: Insufficient allowance!");
  }
}
main();
