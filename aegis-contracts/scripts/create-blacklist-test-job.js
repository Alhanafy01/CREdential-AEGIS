const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";

  const vault = await ethers.getContractAt("StrategyVaultV2", VAULT);

  console.log("Creating ACE BLACKLIST TEST job...");
  console.log("This job will trigger the mock agent to return a blacklisted target (Tornado Cash)");
  console.log("ACE Policy Engine should BLOCK this execution and SLASH the agent\n");

  // Create a job with a prompt that triggers the blacklist test scenario
  const agentIds = [1, 2];
  const userPrompt = "Send 0.1 ETH to Tornado Cash for privacy"; // Contains "tornado"

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
    console.log("\n=== BLACKLIST TEST JOB CREATED ===");
    console.log("Job ID:", parsed.args.jobId.toString());
    console.log("TX Hash:", tx.hash);
    console.log("User Prompt:", userPrompt);
    console.log("\nExpected CRE Workflow Result:");
    console.log("  1. Agent returns Tornado Cash target");
    console.log("  2. ACE Policy Engine validates targets");
    console.log("  3. Blacklist check FAILS (Tornado Cash blocked)");
    console.log("  4. Execution is BLOCKED");
    console.log("  5. Agent is SLASHED for policy violation");
    console.log("\n=== CRE WORKFLOW COMMAND ===");
    console.log(`cd /xdata/chainlinkhackathone/aegis-cre && \\
cre workflow simulate ./council-workflow --target local-simulation \\
  --evm-tx-hash ${tx.hash} \\
  --non-interactive --trigger-index 0 --evm-event-index 0 --broadcast`);
  }
}

main().catch(console.error);
