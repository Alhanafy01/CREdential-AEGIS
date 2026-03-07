/**
 * Create Cross-DEX Arbitrage Job with Dissenting Agent
 * Agents 1 & 2: Consensus (4-step arb)
 * Agent 5: Dissent (different amount - gets slashed)
 */
const { ethers } = require("hardhat");

async function main() {
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const AGENTS = [1, 2, 5];

  const [deployer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("StrategyVaultV2", VAULT);

  console.log("=== Creating Cross-DEX Arbitrage Job with Dissenter ===\n");

  const userPrompt = "Execute a cross-DEX arbitrage between Uniswap V3 and SushiSwap";
  const tx = await vault.requestStrategyJob(AGENTS, userPrompt);
  const receipt = await tx.wait();

  const jobId = (await vault.nextJobId()) - 1n;
  console.log(`Job ID: ${jobId}`);
  console.log(`Agents: [1, 2, 5]`);
  console.log(`TX: ${receipt.hash}`);
  console.log(`\nRun CRE:\n`);
  console.log(`cd /xdata/chainlinkhackathone/aegis-cre && cre workflow simulate ./council-workflow --target local-simulation --evm-tx-hash ${receipt.hash} --non-interactive --trigger-index 0 --evm-event-index 0 --broadcast`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
