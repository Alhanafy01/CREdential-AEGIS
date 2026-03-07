const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const STRATEGY_VAULT_ADDRESS = "0x2E3A73aDB42e2DE8EAA8056c262C7306a1DBa036";

  console.log("");
  console.log("Creating Strategy Job (GOOD scenario)...");
  console.log("Strategy: SWAP (type 0)");
  console.log("Amount: 100 ETH");
  console.log("Agents: [1, 2, 3]");
  console.log("");
  console.log("All agents will behave correctly → REWARDS");
  console.log("");

  const strategyVault = await hre.ethers.getContractAt(
    ["function requestStrategyJob(uint256[] calldata agentIds, uint8 strategyType, address targetProtocol, uint256 amount, bytes calldata params) external returns (uint256)",
     "event StrategyJobCreated(uint256 indexed jobId, address indexed proposer, bytes jobData)"],
    STRATEGY_VAULT_ADDRESS,
    deployer
  );

  const tx = await strategyVault["requestStrategyJob(uint256[],uint8,address,uint256,bytes)"](
    [1n, 2n, 3n],
    0,             // SWAP strategy
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",  // Uniswap V2 Router
    hre.ethers.parseEther("100"),
    "0x"
  );

  const receipt = await tx.wait();
  console.log("✅ Job Created Successfully!");
  console.log("TX Hash:", receipt.hash);
  console.log("");
  console.log("Run council workflow with:");
  console.log(`cd /xdata/chainlinkhackathone/aegis-cre && cre workflow simulate ./council-workflow --target local-simulation --evm-tx-hash ${receipt.hash} --non-interactive --trigger-index 0 --evm-event-index 0 --broadcast`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
