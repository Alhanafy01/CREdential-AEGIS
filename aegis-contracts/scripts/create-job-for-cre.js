const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  
  const vault = await ethers.getContractAt("StrategyVaultV2", VAULT);
  
  console.log("Creating new job for CRE workflow test...");
  
  // Create a multi-agent consensus job with verified agents 1, 2
  // Both agents return identical arbitrage responses (AGREE)
  // This tests the consensus mechanism - both should be rewarded
  const agentIds = [1, 2];
  const userPrompt = "Execute a cross-DEX arbitrage between Uniswap V3 and SushiSwap";
  
  const tx = await vault.requestStrategyJob(agentIds, userPrompt);
  console.log("TX submitted:", tx.hash);
  
  const receipt = await tx.wait();
  console.log("TX confirmed in block:", receipt.blockNumber);
  
  // Find the StrategyJobCreated event
  const jobEvent = receipt.logs.find(log => {
    try {
      const parsed = vault.interface.parseLog(log);
      return parsed && parsed.name === "StrategyJobCreated";
    } catch { return false; }
  });
  
  if (jobEvent) {
    const parsed = vault.interface.parseLog(jobEvent);
    console.log("\n=== JOB CREATED ===");
    console.log("Job ID:", parsed.args.jobId.toString());
    console.log("TX Hash:", tx.hash);
    console.log("\n=== CRE WORKFLOW COMMAND ===");
    console.log(`cd /xdata/chainlinkhackathone/aegis-cre && \\
cre workflow simulate ./council-workflow --target local-simulation \\
  --evm-tx-hash ${tx.hash} \\
  --non-interactive --trigger-index 0 --evm-event-index 0 --broadcast`);
  }
}

main().catch(console.error);
