/**
 * AEGIS Protocol Demo Script - Multi-Agent Consensus Testing
 *
 * This script demonstrates the complete flow of the AEGIS protocol:
 * 1. Creates a strategy job with multiple agents
 * 2. Shows the expected consensus behavior
 * 3. Outputs the CRE workflow command to execute
 *
 * Run: TENDERLY_RPC="https://virtual.mainnet.eu.rpc.tenderly.co/f277af26-9cfb-4ba8-943c-92c32507741e" npx hardhat run scripts/demo-multi-agent-consensus.js --network tenderly
 */

const { ethers } = require("hardhat");

// Console colors for beautiful output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgBlue: "\x1b[44m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgMagenta: "\x1b[45m",
};

function printHeader(text) {
  const line = "═".repeat(70);
  console.log(`\n${colors.cyan}${line}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  ${text}${colors.reset}`);
  console.log(`${colors.cyan}${line}${colors.reset}\n`);
}

function printSubHeader(text) {
  console.log(`\n${colors.yellow}  ▶ ${text}${colors.reset}`);
  console.log(`${colors.dim}  ${"─".repeat(60)}${colors.reset}`);
}

function printStep(num, text) {
  console.log(`\n${colors.bgBlue}${colors.white} STEP ${num} ${colors.reset} ${colors.bright}${text}${colors.reset}`);
}

function printSuccess(text) {
  console.log(`  ${colors.green}✓${colors.reset} ${text}`);
}

function printInfo(label, value) {
  console.log(`  ${colors.dim}${label}:${colors.reset} ${colors.white}${value}${colors.reset}`);
}

function printWarning(text) {
  console.log(`  ${colors.yellow}⚠${colors.reset} ${text}`);
}

function printError(text) {
  console.log(`  ${colors.red}✗${colors.reset} ${text}`);
}

async function main() {
  // Configuration
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";

  // Demo configuration - All verified agents participate
  // More agents = more reports (1 exec + N reward + N reputation = 1 + 2N reports)
  // To get 14+ reports, use 7 agents (1 + 14 = 15 reports)
  // For demo: start with agents 1 & 2, can expand to more
  let DEMO_AGENTS = [1, 2];
  const DEMO_PROMPT = "Execute a cross-DEX arbitrage between Uniswap V3 and SushiSwap";

  // Check if we should use more agents for more impressive demo
  const USE_MAX_AGENTS = process.env.MAX_AGENTS === "true";

  printHeader("🎬 AEGIS PROTOCOL - Multi-Agent Consensus Demo");

  console.log(`  ${colors.magenta}Protocol:${colors.reset} Universal AI DeFi Executor with CRE`);
  console.log(`  ${colors.magenta}Feature:${colors.reset} TRUE Multi-Agent Consensus`);
  console.log(`  ${colors.magenta}Privacy:${colors.reset} confidential_http (MEV Protection)`);
  console.log(`  ${colors.magenta}Hackathon:${colors.reset} Chainlink Block Magic 2025`);

  // =========================================================================
  // STEP 1: Connect and show environment
  // =========================================================================
  printStep(1, "Connecting to Tenderly Virtual Testnet");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  printSuccess("Connected to network");
  printInfo("Deployer", deployer.address);
  printInfo("Chain ID", network.chainId.toString());
  printInfo("Vault", VAULT);
  printInfo("Registry", REGISTRY);

  // =========================================================================
  // STEP 2: Check agent states
  // =========================================================================
  printStep(2, "Checking Agent Verification Status");

  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const vault = await ethers.getContractAt("StrategyVaultV2", VAULT);

  console.log();
  for (const agentId of DEMO_AGENTS) {
    const agent = await registry.agents(agentId);
    const isVerified = await registry.isAgentVerified(agentId);

    if (isVerified) {
      printSuccess(`Agent ${agentId}: VERIFIED ✓`);
    } else {
      printError(`Agent ${agentId}: NOT VERIFIED`);
    }
    printInfo(`  Reputation`, agent.reputation.toString());
    printInfo(`  Stake`, `${ethers.formatEther(agent.stake)} LINK`);
  }

  // Check if all agents are verified
  const allVerified = await Promise.all(
    DEMO_AGENTS.map(id => registry.isAgentVerified(id))
  );

  if (!allVerified.every(v => v)) {
    printError("\nSome agents are not verified. Demo may fail.");
    printWarning("Please verify all agents before running the demo.");
  }

  // =========================================================================
  // STEP 3: Show demo configuration
  // =========================================================================
  printStep(3, "Demo Configuration");

  printSubHeader("Strategy Request");
  printInfo("User Prompt", `"${DEMO_PROMPT}"`);
  printInfo("Selected Agents", `[${DEMO_AGENTS.join(", ")}]`);

  printSubHeader("Expected Consensus Behavior");
  console.log(`  ${colors.green}●${colors.reset} Agent 1: Returns 4-target cross-DEX arbitrage (99% confidence)`);
  console.log(`  ${colors.green}●${colors.reset} Agent 2: Returns ${colors.bright}IDENTICAL${colors.reset} 4-target arbitrage (99% confidence)`);
  console.log(`  ${colors.green}●${colors.reset} Consensus: ${colors.green}${colors.bright}2/2 agents AGREE${colors.reset}`);
  console.log(`  ${colors.green}●${colors.reset} Result: Both agents ${colors.green}REWARDED${colors.reset} + reputation +10`);

  printSubHeader("Arbitrage Route (4 Steps)");
  console.log(`  ${colors.cyan}1.${colors.reset} Approve USDC for Uniswap V3 Router`);
  console.log(`  ${colors.cyan}2.${colors.reset} Swap USDC → WETH on Uniswap V3 (0.05% fee)`);
  console.log(`  ${colors.cyan}3.${colors.reset} Approve WETH for SushiSwap Router`);
  console.log(`  ${colors.cyan}4.${colors.reset} Swap WETH → USDC on SushiSwap V2`);

  // =========================================================================
  // STEP 4: Create the strategy job
  // =========================================================================
  printStep(4, "Creating Strategy Job On-Chain");

  const nextJobId = await vault.nextJobId();
  printInfo("Next Job ID", nextJobId.toString());

  console.log(`\n  ${colors.dim}Submitting transaction...${colors.reset}`);

  try {
    const tx = await vault.requestStrategyJob(DEMO_AGENTS, DEMO_PROMPT);
    console.log(`  ${colors.dim}TX Hash: ${tx.hash}${colors.reset}`);

    const receipt = await tx.wait();

    printSuccess(`Job created successfully!`);
    printInfo("Job ID", nextJobId.toString());
    printInfo("TX Hash", tx.hash);
    printInfo("Block", receipt.blockNumber.toString());
    printInfo("Gas Used", receipt.gasUsed.toString());

    // =========================================================================
    // STEP 5: Show CRE Workflow Command
    // =========================================================================
    printStep(5, "CRE Workflow Command");

    const creCommand = `cd /xdata/chainlinkhackathone/aegis-cre && cre workflow simulate ./council-workflow --target local-simulation --evm-tx-hash ${tx.hash} --non-interactive --trigger-index 0 --evm-event-index 0 --broadcast`;

    console.log(`\n  ${colors.bgGreen}${colors.white} COPY THIS COMMAND ${colors.reset}\n`);
    console.log(`  ${colors.green}${creCommand}${colors.reset}`);
    console.log();

    // =========================================================================
    // STEP 6: What to expect
    // =========================================================================
    printStep(6, "What to Expect from CRE Execution");

    printSubHeader("Workflow Steps");
    console.log(`  ${colors.cyan}1.${colors.reset} CRE triggers on StrategyJobCreated event`);
    console.log(`  ${colors.cyan}2.${colors.reset} Reads agent verification from Registry (FINALIZED block)`);
    console.log(`  ${colors.cyan}3.${colors.reset} Queries each agent via ${colors.yellow}confidential_http${colors.reset} (MEV protected)`);
    console.log(`  ${colors.cyan}4.${colors.reset} Compares responses → Builds consensus`);
    console.log(`  ${colors.cyan}5.${colors.reset} Validates targets via ACE Policy Engine`);
    console.log(`  ${colors.cyan}6.${colors.reset} Executes 4-step arbitrage atomically`);
    console.log(`  ${colors.cyan}7.${colors.reset} Rewards agreeing agents (+10 reputation, 100 AEGIS)`);

    printSubHeader("Expected Output");
    console.log(`  ${colors.green}✓${colors.reset} Agent 1: 4 targets, 99% confidence`);
    console.log(`  ${colors.green}✓${colors.reset} Agent 2: 4 targets, 99% confidence`);
    console.log(`  ${colors.green}✓${colors.reset} Consensus: 2/2 agents agreed`);
    console.log(`  ${colors.green}✓${colors.reset} ACE Validation: PASSED`);
    console.log(`  ${colors.green}✓${colors.reset} Execution: SUCCESS`);
    console.log(`  ${colors.green}✓${colors.reset} Rewards: Agent 1 & 2 each get +10 rep, 100 AEGIS`);

    // =========================================================================
    // Summary
    // =========================================================================
    printHeader("🎬 Demo Ready!");

    console.log(`  ${colors.bright}Job ${nextJobId} has been created on-chain.${colors.reset}`);
    console.log(`  ${colors.dim}Run the CRE command above to execute the multi-agent consensus workflow.${colors.reset}`);
    console.log();
    console.log(`  ${colors.magenta}Features Demonstrated:${colors.reset}`);
    console.log(`    • TRUE Multi-Agent Consensus (per-agent HTTP calls)`);
    console.log(`    • confidential_http (MEV protection via secure enclave)`);
    console.log(`    • ACE Policy Engine validation (whitelist/blacklist)`);
    console.log(`    • Multi-agent reward/slash feedback loop`);
    console.log(`    • Protocol-agnostic execution (natural language → DeFi)`);
    console.log();

  } catch (error) {
    printError(`Failed to create job: ${error.message}`);

    if (error.message.includes("not verified")) {
      printWarning("One or more agents are not verified.");
      printInfo("Solution", "Verify agents using World ID + CRE onboarding workflow");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
