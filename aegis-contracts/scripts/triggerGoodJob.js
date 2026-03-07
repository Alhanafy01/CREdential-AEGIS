const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const STRATEGY_VAULT_ADDRESS = "0x985fAe5d75F21CEA0F4cf8DcC4E2020D3aE29DFA";

  console.log("Creating strategy job with 2 GOOD agents (no malicious Agent 3)...");

  const strategyVault = await hre.ethers.getContractAt(
    ["function requestStrategyJob(uint256[] calldata agentIds, uint8 strategyType, address targetProtocol, uint256 amount, bytes calldata params) external returns (uint256)"],
    STRATEGY_VAULT_ADDRESS,
    deployer
  );

  // Only agents 1 and 2 (no malicious agent 3)
  const tx = await strategyVault["requestStrategyJob(uint256[],uint8,address,uint256,bytes)"](
    [1n, 2n],  // Only good agents
    0,          // SWAP
    "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    hre.ethers.parseEther("100"),  // 100 tokens
    "0x"
  );

  const receipt = await tx.wait();
  console.log("SUCCESS! TX Hash:", receipt.hash);
  console.log("\nRun council workflow with:");
  console.log(`cre workflow simulate council-workflow --evm-tx-hash ${receipt.hash} --evm-event-index 0 --trigger-index 0 --broadcast -T local-simulation --non-interactive`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
