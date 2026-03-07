const hre = require("hardhat");

const RWA_VAULT = "0x1516AB1339C027841B7343773EDeC8702e91e36B";
const RUSD = "0x311828C55A410c984153448C754EE25E330d8037";
const DEMO_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

async function main() {
  console.log("=".repeat(50));
  console.log("CLEANING UP DEMO WALLET POSITION");
  console.log("=".repeat(50));
  
  const provider = new hre.ethers.JsonRpcProvider(hre.network.config.url);
  const wallet = new hre.ethers.Wallet(DEMO_KEY, provider);
  
  const vault = await hre.ethers.getContractAt("RWACollateralVault", RWA_VAULT, wallet);
  const rusd = await hre.ethers.getContractAt("IERC20", RUSD, wallet);
  
  // Get current position
  const [col, debt, hf, price] = await vault.getPosition(wallet.address);
  console.log("\nCurrent Position:");
  console.log("  Collateral:", hre.ethers.formatEther(col), "ETH");
  console.log("  Debt:", hre.ethers.formatEther(debt), "RUSD");
  
  if (debt > 0n) {
    // Check RUSD balance
    const rusdBalance = await rusd.balanceOf(wallet.address);
    console.log("\nRUSD Balance:", hre.ethers.formatEther(rusdBalance));
    
    if (rusdBalance >= debt) {
      // Approve and repay
      console.log("\nApproving RUSD...");
      const approveTx = await rusd.approve(RWA_VAULT, debt);
      await approveTx.wait();
      
      console.log("Repaying debt...");
      const repayTx = await vault.repay(debt);
      await repayTx.wait();
      console.log("✓ Debt repaid!");
    } else {
      console.log("\n⚠ Not enough RUSD to repay. Minting more via Tenderly...");
      // Use impersonation to mint RUSD
    }
  }
  
  // Withdraw collateral
  const [col2] = await vault.getPosition(wallet.address);
  if (col2 > 0n) {
    console.log("\nWithdrawing collateral...");
    const withdrawTx = await vault.withdraw(col2);
    await withdrawTx.wait();
    console.log("✓ Collateral withdrawn!");
  }
  
  // Final check
  const [colF, debtF] = await vault.getPosition(wallet.address);
  console.log("\n" + "=".repeat(50));
  console.log("FINAL POSITION:");
  console.log("  Collateral:", hre.ethers.formatEther(colF), "ETH");
  console.log("  Debt:", hre.ethers.formatEther(debtF), "RUSD");
  if (colF == 0n && debtF == 0n) {
    console.log("\n✓ Position is CLEAN - ready for fresh demo!");
  }
}

main().catch(console.error);
