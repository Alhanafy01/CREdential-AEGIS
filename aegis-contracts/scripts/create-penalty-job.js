const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const STRATEGY_VAULT_ADDRESS = "0x2E3A73aDB42e2DE8EAA8056c262C7306a1DBa036";

  console.log("");
  console.log("Creating Job #2 for PENALTY scenario...");
  console.log("Strategy: LEND (type 5)");
  console.log("Amount: 500 ETH");
  console.log("Agents: [1, 2, 3]");
  console.log("");
  console.log("⚠️  Agent 3 will propose EXCESSIVE amount → will be PENALIZED");
  console.log("");

  const strategyVault = await hre.ethers.getContractAt(
    ["function requestStrategyJob(uint256[] calldata agentIds, uint8 strategyType, address targetProtocol, uint256 amount, bytes calldata params) external returns (uint256)",
     "event StrategyJobCreated(uint256 indexed jobId, address indexed proposer, bytes jobData)"],
    STRATEGY_VAULT_ADDRESS,
    deployer
  );

  // All 3 agents - Agent 3 will be malicious
  const tx = await strategyVault["requestStrategyJob(uint256[],uint8,address,uint256,bytes)"](
    [1n, 2n, 3n],  // All agents including malicious Agent 3
    5,             // LEND strategy
    "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",  // Aave V3 Pool
    hre.ethers.parseEther("500"),  // 500 ETH
    "0x"
  );

  const receipt = await tx.wait();
  console.log("✅ Job Created Successfully!");
  console.log("TX Hash:", receipt.hash);
  console.log("");
  console.log("Run council workflow with:");
  console.log(`cre workflow simulate ./council-workflow --target local-simulation --evm-tx-hash ${receipt.hash} --non-interactive --trigger-index 0 --evm-event-index 0 --broadcast`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
