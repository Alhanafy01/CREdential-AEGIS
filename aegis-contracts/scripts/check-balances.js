const { ethers } = require("hardhat");

async function main() {
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  
  const usdc = await ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)"],
    USDC
  );
  const weth = await ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)"],
    WETH
  );
  
  const usdcBal = await usdc.balanceOf(VAULT);
  const wethBal = await weth.balanceOf(VAULT);
  
  console.log("=== VAULT BALANCES ===");
  console.log("USDC:", ethers.formatUnits(usdcBal, 6));
  console.log("WETH:", ethers.formatUnits(wethBal, 18));
}

main().catch(console.error);
