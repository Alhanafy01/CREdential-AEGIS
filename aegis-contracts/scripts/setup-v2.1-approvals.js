/**
 * Setup Approvals for StrategyVaultV2.1
 *
 * Sets unlimited USDC approval for:
 * - Uniswap V3 Router
 * - Aave V3 Pool
 * - SushiSwap Router
 */
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  // V2.1 Contract Address
  const VAULT_ADDRESS = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";

  // Mainnet addresses
  const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const UNISWAP_V3_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const AAVE_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
  const SUSHI_ROUTER = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";

  console.log("=".repeat(70));
  console.log("AEGIS V2.1 - Setting Up Approvals");
  console.log("=".repeat(70));
  console.log("Vault:", VAULT_ADDRESS);
  console.log("Deployer:", deployer.address);
  console.log("");

  // Connect to vault
  const vault = await ethers.getContractAt(
    [
      "function approveSpender(address token, address spender, uint256 amount) external",
      "function owner() external view returns (address)",
    ],
    VAULT_ADDRESS,
    deployer
  );

  // Verify ownership
  const owner = await vault.owner();
  console.log("Vault Owner:", owner);

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("[!] Warning: Deployer is not owner. Using governance function...");
  }

  const MAX_UINT256 = ethers.MaxUint256;

  console.log("\n=== Setting Approvals ===");

  // Approve Uniswap V3 Router
  console.log("\n1. Approving Uniswap V3 Router...");
  try {
    const tx1 = await vault.approveSpender(USDC_ADDRESS, UNISWAP_V3_ROUTER, MAX_UINT256);
    console.log("   TX:", tx1.hash);
    await tx1.wait();
    console.log("   [OK] Uniswap V3 Router approved");
  } catch (e) {
    console.log("   [X] Failed:", e.message);
  }

  // Approve Aave V3 Pool
  console.log("\n2. Approving Aave V3 Pool...");
  try {
    const tx2 = await vault.approveSpender(USDC_ADDRESS, AAVE_POOL, MAX_UINT256);
    console.log("   TX:", tx2.hash);
    await tx2.wait();
    console.log("   [OK] Aave V3 Pool approved");
  } catch (e) {
    console.log("   [X] Failed:", e.message);
  }

  // Approve SushiSwap Router
  console.log("\n3. Approving SushiSwap Router...");
  try {
    const tx3 = await vault.approveSpender(USDC_ADDRESS, SUSHI_ROUTER, MAX_UINT256);
    console.log("   TX:", tx3.hash);
    await tx3.wait();
    console.log("   [OK] SushiSwap Router approved");
  } catch (e) {
    console.log("   [X] Failed:", e.message);
  }

  console.log("\n" + "=".repeat(70));
  console.log("APPROVALS COMPLETE");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
