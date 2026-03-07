/**
 * Setup USDC Approval for V2.1 Vault
 *
 * The vault needs to approve Uniswap V3 Router to spend USDC.
 * We'll do this by calling the vault's executeStrategy directly (as owner)
 * with just an approve call.
 */
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const VAULT_ADDRESS = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const FORWARDER_ADDRESS = "0x948a7CCb238F00CDfe16CfF33c3045A74aa72fcc";
  const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

  console.log("=".repeat(70));
  console.log("Setup USDC Approval for V2.1 Vault");
  console.log("=".repeat(70));

  // First create a dummy job
  const vault = await ethers.getContractAt(
    [
      "function requestStrategyJob(uint256[] agentIds, string userPrompt) external returns (uint256)",
      "function getJob(uint256 jobId) external view returns (uint256[] agentIds, address proposer, uint256 createdAt, bool completed, bool success, string userPrompt)",
      "function nextJobId() external view returns (uint256)",
    ],
    VAULT_ADDRESS,
    deployer
  );

  // Create job for approval
  console.log("\nCreating approval job...");
  const tx = await vault.requestStrategyJob([1], "Approve USDC for Uniswap V3");
  const receipt = await tx.wait();

  const jobIdHex = receipt.logs.find(l => l.topics[0] === ethers.id("StrategyJobCreated(uint256,address,uint256[],string)")).topics[1];
  const jobId = BigInt(jobIdHex);
  console.log("Job ID:", jobId.toString());

  // Now call forwarder to execute approval
  const forwarder = await ethers.getContractAt(
    [
      "function deliverReportSimple(address receiver, bytes calldata report) external returns (bool)"
    ],
    FORWARDER_ADDRESS,
    deployer
  );

  // Encode approve call
  const approveIface = new ethers.Interface(["function approve(address spender, uint256 amount)"]);
  const approveCalldata = approveIface.encodeFunctionData("approve", [UNISWAP_V3_ROUTER, ethers.MaxUint256]);

  // Encode report: (jobId, targets[], values[], calldatas[])
  const report = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address[]", "uint256[]", "bytes[]"],
    [jobId, [USDC_ADDRESS], [0], [approveCalldata]]
  );

  console.log("\nExecuting approval via forwarder...");
  const tx2 = await forwarder.deliverReportSimple(VAULT_ADDRESS, report);
  console.log("TX:", tx2.hash);
  await tx2.wait();
  console.log("[OK] Approval executed!");

  // Verify
  const usdc = await ethers.getContractAt(
    ["function allowance(address owner, address spender) view returns (uint256)"],
    USDC_ADDRESS,
    deployer
  );
  const allowance = await usdc.allowance(VAULT_ADDRESS, UNISWAP_V3_ROUTER);
  console.log("\nVault allowance for Uniswap V3:", allowance.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
