const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const UNISWAP = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const FORWARDER = "0xa3d1ad4ac559a6575a114998affb2fb2ec97a7d9";

  // Check USDC balance of vault
  const usdc = await ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"],
    USDC
  );
  const balance = await usdc.balanceOf(VAULT);
  console.log("Vault USDC balance:", ethers.formatUnits(balance, 6));

  // Check existing allowance
  const allowance = await usdc.allowance(VAULT, UNISWAP);
  console.log("Vault->Uniswap allowance:", ethers.formatUnits(allowance, 6));

  // Encode a simple approve call
  const ERC20_ABI = ["function approve(address spender, uint256 amount) returns (bool)"];
  const iface = new ethers.Interface(ERC20_ABI);
  const approveCalldata = iface.encodeFunctionData("approve", [UNISWAP, ethers.parseUnits("100", 6)]);

  console.log("\nApprove calldata:", approveCalldata);

  // Test calling USDC approve directly (simulating what vault does)
  console.log("\nTesting direct USDC.approve call from vault context...");
  console.log("(This simulates the low-level call the vault makes)");

  // Try to decode the error by calling the vault's _processReport manually
  // We can't do that directly, but we can test via forwarder

  const forwarder = await ethers.getContractAt(
    ["function deliverReportSimple(address receiver, bytes calldata report) external returns (bool)"],
    FORWARDER
  );

  // Create job 12 report with just the approve
  const report = ethers.AbiCoder.defaultAbiCoder().encode(
    ["uint256", "address[]", "uint256[]", "bytes[]"],
    [12, [USDC], [0], [approveCalldata]]
  );

  console.log("\nReport encoded, length:", report.length);

  // Try with high gas limit
  try {
    const tx = await forwarder.deliverReportSimple(VAULT, report, {
      gasLimit: 5000000
    });
    console.log("TX submitted:", tx.hash);
    const receipt = await tx.wait();
    console.log("TX succeeded! Gas used:", receipt.gasUsed.toString());
  } catch (error) {
    console.log("\nExecution failed!");
    console.log("Error:", error.message);

    // Try to get more info from the error
    if (error.error && error.error.data) {
      console.log("Error data:", error.error.data);
    }
  }
}

main().catch(console.error);
