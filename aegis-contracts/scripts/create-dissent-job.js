/**
 * Create a Strategy Job with Agents [1, 2, 5]
 * Agent 5 is the "malicious" agent that will dissent
 *
 * The mock server will return:
 * - Agents 1 & 2: Swap 500 USDC -> WETH (consensus)
 * - Agent 5: Swap 1000 USDC -> WETH (DISSENT - different amount)
 *
 * Expected CRE behavior:
 * - 2/3 agents agree (1 & 2)
 * - Agent 5 dissents
 * - Majority wins: Execute the consensus transaction
 * - SLASH Agent 5 for dissenting (stake penalty + reputation -10)
 * - REWARD Agents 1 & 2 for correct consensus
 */

const { ethers } = require("hardhat");

async function main() {
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407"; // StrategyVaultV2.1
  const AGENTS = [1, 2, 5]; // Agent 5 will dissent!

  const [deployer] = await ethers.getSigners();
  console.log("Creating job from:", deployer.address);

  const vault = await ethers.getContractAt("StrategyVaultV2", VAULT);

  // Check current job count
  const currentJobCount = await vault.nextJobId();
  console.log(`\nNext job ID: ${currentJobCount}`);

  // Create the job
  console.log("\n=== Creating Strategy Job with Agents [1, 2, 5] ===");
  console.log("  Agents 1 & 2 will return consensus (500 USDC swap)");
  console.log("  Agent 5 will DISSENT (1000 USDC swap - different calldata)");
  console.log("");

  const userPrompt = "Execute a cross-DEX arbitrage between Uniswap V3 and SushiSwap";
  const tx = await vault.requestStrategyJob(AGENTS, userPrompt);
  const receipt = await tx.wait();

  // Find StrategyJobCreated event
  const jobCreatedEvent = receipt.logs.find(log => {
    try {
      return vault.interface.parseLog(log)?.name === "StrategyJobCreated";
    } catch {
      return false;
    }
  });

  if (jobCreatedEvent) {
    const parsed = vault.interface.parseLog(jobCreatedEvent);
    console.log(`Job created successfully!`);
    console.log(`  Job ID: ${parsed.args.jobId}`);
    console.log(`  Agents: [${parsed.args.agentIds.join(", ")}]`);
    console.log(`  TX Hash: ${receipt.hash}`);
  } else {
    console.log(`Job created! TX: ${receipt.hash}`);
    const newJobId = await vault.nextJobId();
    console.log(`  New Job ID: ${Number(newJobId) - 1}`);
  }

  // Show agent states before workflow
  console.log("\n=== Agent States BEFORE Workflow ===");
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);

  for (const agentId of AGENTS) {
    const agent = await registry.agents(agentId);
    console.log(`  Agent ${agentId}: stake=${ethers.formatEther(agent.stake)} LINK, rep=${agent.reputation}`);
  }

  console.log("\n=== Ready for CRE Council Workflow ===");
  console.log("Run the following command to simulate the workflow:");
  console.log(`\n  cd /xdata/chainlinkhackathone/aegis-cre && cre workflow simulate ./council-workflow --target local-simulation --evm-tx-hash ${receipt.hash} --non-interactive --trigger-index 0 --evm-event-index 0 --broadcast\n`);

  console.log("\nExpected outcome:");
  console.log("  - Agents 1 & 2: REWARDED (consensus winners)");
  console.log("  - Agent 5: SLASHED (dissenter - stake & reputation penalty)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
