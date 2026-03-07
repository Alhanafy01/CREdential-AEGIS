/**
 * Fund any wallet with ETH, USDC and pre-approve contracts using Tenderly impersonation
 * Usage: WALLET=0x... npx hardhat run scripts/fund-any-wallet.js --network tenderly
 */

const { ethers } = require("hardhat");

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDC_BALANCE_SLOT = 9;
const FLIGHT_INSURANCE = "0x4E84d6394D95bE6d099e78DDD78F538149a02cdA";
const STRATEGY_VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";

async function main() {
  const provider = ethers.provider;

  // Get wallet address from env
  const walletAddress = process.env.WALLET;
  if (!walletAddress) {
    console.error("Please set WALLET environment variable");
    process.exit(1);
  }

  console.log("=== Funding Wallet via Tenderly ===");
  console.log("Wallet:", walletAddress);

  // 1. Fund with ETH
  await provider.send("tenderly_setBalance", [
    walletAddress,
    ethers.toQuantity(ethers.parseEther("100"))
  ]);
  console.log("Funded with 100 ETH");

  // 2. Fund with USDC using storage manipulation
  const amount = ethers.parseUnits("10000", 6); // 10,000 USDC
  const balanceSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [walletAddress, USDC_BALANCE_SLOT]
    )
  );
  const hexValue = "0x" + amount.toString(16).padStart(64, '0');

  await provider.send("tenderly_setStorageAt", [
    USDC,
    balanceSlot,
    hexValue
  ]);

  // Verify USDC balance
  const usdc = await ethers.getContractAt("IERC20", USDC);
  const balance = await usdc.balanceOf(walletAddress);
  console.log("USDC Balance:", ethers.formatUnits(balance, 6));

  // 3. Approve FlightInsurance using eth_sendTransaction (Tenderly impersonation)
  const approveData = usdc.interface.encodeFunctionData("approve", [
    FLIGHT_INSURANCE,
    ethers.MaxUint256
  ]);

  await provider.send("eth_sendTransaction", [{
    from: walletAddress,
    to: USDC,
    data: approveData,
    gas: "0x100000"
  }]);
  console.log("Approved FlightInsurance for unlimited USDC");

  // 4. Approve StrategyVault
  const approveData2 = usdc.interface.encodeFunctionData("approve", [
    STRATEGY_VAULT,
    ethers.MaxUint256
  ]);

  await provider.send("eth_sendTransaction", [{
    from: walletAddress,
    to: USDC,
    data: approveData2,
    gas: "0x100000"
  }]);
  console.log("Approved StrategyVault for unlimited USDC");

  // Verify approvals
  const allowance1 = await usdc.allowance(walletAddress, FLIGHT_INSURANCE);
  const allowance2 = await usdc.allowance(walletAddress, STRATEGY_VAULT);
  console.log("\n=== Verification ===");
  console.log("FlightInsurance allowance:", allowance1 > 0n ? "Unlimited" : "None");
  console.log("StrategyVault allowance:", allowance2 > 0n ? "Unlimited" : "None");

  console.log("\n=== Wallet Ready for Testing ===");
  console.log("ETH: 100");
  console.log("USDC: 10,000");
  console.log("Approvals: FlightInsurance, StrategyVault");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
