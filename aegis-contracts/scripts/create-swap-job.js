const { ethers } = require("hardhat");
async function main() {
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const vault = await ethers.getContractAt("StrategyVaultV2", VAULT);
  
  // Simple swap prompt - this triggers the 2-step flow that works
  const userPrompt = "Swap USDC to WETH on Uniswap V3";
  const tx = await vault.requestStrategyJob([1, 2, 5], userPrompt);
  const receipt = await tx.wait();
  const jobId = (await vault.nextJobId()) - 1n;
  
  console.log(`Job ID: ${jobId}`);
  console.log(`TX: ${receipt.hash}`);
  console.log(`\nRun CRE:\ncre workflow simulate ./council-workflow --target local-simulation --evm-tx-hash ${receipt.hash} --non-interactive --trigger-index 0 --evm-event-index 0 --broadcast`);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
