/**
 * Manually execute the insurance claim to test the integration
 * This simulates what CRE would do via writeReport
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("=== Executing Insurance Claim (Direct Test) ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Contract addresses
  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const FLIGHT_INSURANCE = "0x4E84d6394D95bE6d099e78DDD78F538149a02cdA";
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

  const vault = await ethers.getContractAt("StrategyVaultV2", VAULT);
  const flightInsurance = await ethers.getContractAt("FlightInsurance", FLIGHT_INSURANCE);
  const usdc = await ethers.getContractAt("IERC20", USDC);

  // Get policy holder address
  const policy = await flightInsurance.getPolicy(1);
  const policyHolder = policy[0];
  const payoutAmount = policy[2];

  console.log("Policy #1:");
  console.log("  Holder:", policyHolder);
  console.log("  Flight:", policy[1]);
  console.log("  Payout:", ethers.formatUnits(payoutAmount, 6), "USDC");
  console.log("  Active:", policy[5]);

  // Check balances before
  const holderBalanceBefore = await usdc.balanceOf(policyHolder);
  const insuranceBalanceBefore = await usdc.balanceOf(FLIGHT_INSURANCE);
  console.log("\n=== Before Execution ===");
  console.log("Policy Holder USDC:", ethers.formatUnits(holderBalanceBefore, 6));
  console.log("FlightInsurance USDC:", ethers.formatUnits(insuranceBalanceBefore, 6));

  // Create a new job for this claim
  const jobId = 43; // Use job 43 to avoid conflicts

  // The processPayout(1) calldata
  const processPayoutCalldata = flightInsurance.interface.encodeFunctionData("processPayout", [1]);
  console.log("\nCalldata:", processPayoutCalldata);

  // First, create a job so we can execute
  console.log("\n=== Creating Job 43 ===");
  const createTx = await vault.requestStrategyJob([7, 8, 9], "Execute insurance claim for Policy #1");
  const createReceipt = await createTx.wait();

  const event = createReceipt.logs.find(log => {
    try {
      return vault.interface.parseLog(log)?.name === "StrategyJobCreated";
    } catch { return false; }
  });
  const actualJobId = vault.interface.parseLog(event).args.jobId;
  console.log("Created Job ID:", actualJobId.toString());

  // Now we need to impersonate the Chainlink Forwarder to call _processReport
  // For testing, let's check if there's an admin function or we need to set up the forwarder

  // Check if vault has an admin execute function
  console.log("\n=== Checking Vault Functions ===");

  // Let's try to call processReport directly by impersonating the forwarder
  const provider = ethers.provider;

  // Get the forwarder address from the vault
  // The vault inherits ReceiverTemplate which has forwarderAddress
  try {
    // Try reading storage slot 0 or check if there's a forwarder getter
    const code = await provider.getCode(VAULT);
    console.log("Vault has bytecode:", code.length > 2);

    // For Tenderly we can impersonate any address
    // The report format is: (jobId, targets[], values[], calldatas[])
    const report = ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address[]", "uint256[]", "bytes[]"],
      [actualJobId, [FLIGHT_INSURANCE], [0], [processPayoutCalldata]]
    );

    // Get forwarder - typically it's set during construction
    // Let's try slot 0 (inherited from OwnableUpgradeable) or find it

    // For now, let's try calling performUpkeep directly if possible
    // OR we can use tenderly_setStorageAt to set ourselves as forwarder temporarily

    // Actually, the cleanest way is to use Tenderly's impersonation
    // First, let's find the forwarder address
    const slot0 = await provider.getStorage(VAULT, 0);
    console.log("Storage slot 0:", slot0);

    // Try finding the forwarder slot - in ReceiverTemplate it's usually _forwarder
    // Let's check different slots
    for (let i = 100; i < 110; i++) {
      const slotVal = await provider.getStorage(VAULT, i);
      if (slotVal !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log(`Slot ${i}:`, slotVal);
      }
    }

    // For a quick test, let's impersonate the known Chainlink forwarder
    // On mainnet, the CRE forwarder might be at a specific address
    // For Tenderly, we can set any address as forwarder

    // Alternative: Call executeStrategy directly if the vault has such a function
    // Let's check the ABI for admin functions

  } catch (error) {
    console.log("Error checking vault:", error.message);
  }

  // For now, let's test the FlightInsurance directly by impersonating the vault
  console.log("\n=== Testing FlightInsurance directly (impersonating Vault) ===");

  // Use Tenderly's impersonation - fund the vault first
  await provider.send("tenderly_setBalance", [
    VAULT,
    ethers.toQuantity(ethers.parseEther("10"))
  ]);

  // Use eth_sendTransaction with from field - Tenderly allows this
  const calldata = flightInsurance.interface.encodeFunctionData("processPayout", [1]);

  try {
    console.log("Calling processPayout(1) as Vault...");
    const txHash = await provider.send("eth_sendTransaction", [{
      from: VAULT,
      to: FLIGHT_INSURANCE,
      data: calldata,
      gas: "0x100000"
    }]);
    console.log("TX Hash:", txHash);

    // Wait for receipt
    const payoutReceipt = await provider.getTransactionReceipt(txHash);
    console.log("Status:", payoutReceipt.status === 1 ? "SUCCESS" : "FAILED");

    // Check balances after
    const holderBalanceAfter = await usdc.balanceOf(policyHolder);
    const insuranceBalanceAfter = await usdc.balanceOf(FLIGHT_INSURANCE);
    console.log("\n=== After Execution ===");
    console.log("Policy Holder USDC:", ethers.formatUnits(holderBalanceAfter, 6));
    console.log("FlightInsurance USDC:", ethers.formatUnits(insuranceBalanceAfter, 6));
    console.log("\nPayout received:", ethers.formatUnits(holderBalanceAfter - holderBalanceBefore, 6), "USDC");

    // Check policy is now inactive
    const policyAfter = await flightInsurance.getPolicy(1);
    console.log("\nPolicy #1 Active:", policyAfter[5]);

  } catch (error) {
    console.log("ERROR:", error.message);
    if (error.data) {
      // Try to decode the error
      try {
        const iface = flightInsurance.interface;
        const decoded = iface.parseError(error.data);
        console.log("Decoded error:", decoded);
      } catch (e) {
        console.log("Raw error data:", error.data);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
