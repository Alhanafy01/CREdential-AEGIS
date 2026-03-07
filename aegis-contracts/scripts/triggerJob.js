const { ethers } = require("hardhat");

async function main() {
  const STRATEGY_VAULT = "0x409f1843e0424583F6f36DA5dA06795e0D443F2F";

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("Triggering job with account:", signer.address);

  // StrategyVault ABI (just the function we need)
  const abi = [
    "function requestStrategyJob(uint256[] calldata agentIds) external returns (uint256 jobId)",
    "event StrategyJobCreated(uint256 indexed jobId, uint256[] agentIds)"
  ];

  // Connect to deployed contract
  const vault = new ethers.Contract(STRATEGY_VAULT, abi, signer);

  // Call requestStrategyJob with agent ID 1
  console.log("Calling requestStrategyJob([1])...");
  const tx = await vault.requestStrategyJob([1]);

  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("Transaction confirmed in block:", receipt.blockNumber);

  // Parse the event
  const event = receipt.logs.find(log => {
    try {
      return vault.interface.parseLog(log)?.name === "StrategyJobCreated";
    } catch {
      return false;
    }
  });

  if (event) {
    const parsed = vault.interface.parseLog(event);
    console.log("\n✅ StrategyJobCreated event emitted!");
    console.log("   Job ID:", parsed.args.jobId.toString());
    console.log("   Agent IDs:", parsed.args.agentIds.map(id => id.toString()));
  }

  console.log("\n📋 Use this transaction hash for CRE simulation:");
  console.log(tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
