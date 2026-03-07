const { ethers } = require("hardhat");

async function main() {
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";

  // Check blocks 24480370 to 24480386
  const logs = await ethers.provider.getLogs({
    address: VAULT,
    fromBlock: 24480370,
    toBlock: 24480386,
  });

  console.log("Vault events in block range 24480370-24480386:", logs.length);
  for (const log of logs) {
    console.log(`  Block ${log.blockNumber}: TX ${log.transactionHash}`);
  }
}

main().catch(console.error);
