/**
 * Fund a specific user wallet with USDC for testing insurance
 * Usage: WALLET=0x... npx hardhat run scripts/fund-user-wallet.js --network tenderly
 */

const { ethers } = require("hardhat");

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDC_BALANCE_SLOT = 9;

async function main() {
  const provider = ethers.provider;

  // Get wallet address from env or use deployer
  const [deployer] = await ethers.getSigners();
  const walletAddress = process.env.WALLET || deployer.address;

  console.log("=== Funding User Wallet ===");
  console.log("Wallet:", walletAddress);

  // Fund with ETH first
  await provider.send("tenderly_setBalance", [
    walletAddress,
    ethers.toQuantity(ethers.parseEther("100"))
  ]);
  console.log("Funded with 100 ETH");

  // Fund with USDC
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

  // Verify
  const usdc = await ethers.getContractAt("IERC20", USDC);
  const balance = await usdc.balanceOf(walletAddress);
  console.log("USDC Balance:", ethers.formatUnits(balance, 6));

  // Also pre-approve USDC for FlightInsurance
  const FLIGHT_INSURANCE = "0x4E84d6394D95bE6d099e78DDD78F538149a02cdA";
  const STRATEGY_VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";

  // Approve via impersonation
  const approveData = usdc.interface.encodeFunctionData("approve", [FLIGHT_INSURANCE, ethers.MaxUint256]);
  await provider.send("eth_sendTransaction", [{
    from: walletAddress,
    to: USDC,
    data: approveData,
    gas: "0x100000"
  }]);
  console.log("Approved FlightInsurance for unlimited USDC");

  // Also approve StrategyVault
  const approveData2 = usdc.interface.encodeFunctionData("approve", [STRATEGY_VAULT, ethers.MaxUint256]);
  await provider.send("eth_sendTransaction", [{
    from: walletAddress,
    to: USDC,
    data: approveData2,
    gas: "0x100000"
  }]);
  console.log("Approved StrategyVault for unlimited USDC");

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
