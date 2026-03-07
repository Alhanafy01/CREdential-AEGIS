const { ethers } = require("hardhat");

async function main() {
  // Transaction range to analyze
  const START_TX = "0xf1ea51b8923aae21da20b23fdbec607af287091f2130277db52e3c0da79dd4d8";
  const END_TX = "0xd587a1b63a55f27be81f767ce404abab51bad20937ca2dcb1d780bcaf3b2a110";

  const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const FORWARDER = "0x233f49D2c3F25eE0eD497AD0dcCC2c453Bd087E9"; // MockKeyForwarder

  console.log("=".repeat(70));
  console.log("ANALYZING TRANSACTION RANGE");
  console.log("=".repeat(70));
  console.log(`Start TX: ${START_TX}`);
  console.log(`End TX:   ${END_TX}`);
  console.log();

  // Get transaction receipts
  const startReceipt = await ethers.provider.getTransactionReceipt(START_TX);
  const endReceipt = await ethers.provider.getTransactionReceipt(END_TX);

  if (!startReceipt) {
    console.log("Start TX not found!");
    return;
  }
  if (!endReceipt) {
    console.log("End TX not found!");
    return;
  }

  console.log(`Start Block: ${startReceipt.blockNumber}`);
  console.log(`End Block:   ${endReceipt.blockNumber}`);
  console.log();

  // Get contracts
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const vault = await ethers.getContractAt("StrategyVaultV2", VAULT);

  // Query events in this block range
  const fromBlock = startReceipt.blockNumber;
  const toBlock = endReceipt.blockNumber;

  console.log("=".repeat(70));
  console.log("EVENTS IN RANGE");
  console.log("=".repeat(70));

  // Registry events
  const repEvents = await registry.queryFilter(registry.filters.ReputationChanged(), fromBlock, toBlock);
  const slashEvents = await registry.queryFilter(registry.filters.AgentSlashed(), fromBlock, toBlock);
  const rewardEvents = await registry.queryFilter(registry.filters.AgentRewarded(), fromBlock, toBlock);
  const verifyEvents = await registry.queryFilter(registry.filters.AgentVerified(), fromBlock, toBlock);

  // Vault events
  const jobCreatedEvents = await vault.queryFilter(vault.filters.StrategyJobCreated(), fromBlock, toBlock);

  console.log(`\nRegistry Events:`);
  console.log(`  - ReputationChanged: ${repEvents.length}`);
  console.log(`  - AgentSlashed: ${slashEvents.length}`);
  console.log(`  - AgentRewarded: ${rewardEvents.length}`);
  console.log(`  - AgentVerified: ${verifyEvents.length}`);

  console.log(`\nVault Events:`);
  console.log(`  - StrategyJobCreated: ${jobCreatedEvents.length}`);

  // List all transactions
  console.log("\n" + "=".repeat(70));
  console.log("DETAILED TRANSACTION LIST");
  console.log("=".repeat(70));

  const allEvents = [
    ...repEvents.map(e => ({ type: 'REPUTATION', event: e, data: `Agent ${e.args.agentId}: delta=${e.args.delta}` })),
    ...slashEvents.map(e => ({ type: 'SLASH', event: e, data: `Agent ${e.args.agentId}: ${ethers.formatEther(e.args.slashAmount)} LINK` })),
    ...rewardEvents.map(e => ({ type: 'REWARD', event: e, data: `Agent ${e.args.agentId}: ${ethers.formatEther(e.args.aegisAmount)} AEGIS` })),
    ...verifyEvents.map(e => ({ type: 'VERIFY', event: e, data: `Agent ${e.args.agentId}` })),
    ...jobCreatedEvents.map(e => ({ type: 'JOB_CREATED', event: e, data: `Job ${e.args.jobId}: agents=[${e.args.agentIds.join(',')}]` })),
  ];

  // Sort by block number and log index
  allEvents.sort((a, b) => {
    if (a.event.blockNumber !== b.event.blockNumber) {
      return a.event.blockNumber - b.event.blockNumber;
    }
    return a.event.index - b.event.index;
  });

  let txCount = 0;
  let lastTxHash = "";
  for (const item of allEvents) {
    if (item.event.transactionHash !== lastTxHash) {
      txCount++;
      lastTxHash = item.event.transactionHash;
      console.log(`\n[TX ${txCount}] ${item.event.transactionHash}`);
      console.log(`  Block: ${item.event.blockNumber}`);
    }
    console.log(`  -> ${item.type}: ${item.data}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log(`TOTAL: ${txCount} unique transactions with events`);
  console.log("=".repeat(70));
}

main().catch(console.error);
