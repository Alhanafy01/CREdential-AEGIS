const { ethers } = require("hardhat");

async function main() {
  const ACE = "0xCF2F38772b578A61681DD128EDd5c05cb3872634";

  const ace = await ethers.getContractAt("ACEPolicyEngine", ACE);

  const status = await ace.getPolicyStatus();
  console.log("=== ACE Policy Status ===");
  console.log("Whitelist Policy:", status.whitelist);
  console.log("Whitelist Enabled:", status.whitelistOn);
  console.log("Blacklist Policy:", status.blacklist);
  console.log("Blacklist Enabled:", status.blacklistOn);
  console.log("Volume Policy:", status.volume);
  console.log("Volume Enabled:", status.volumeOn);
  console.log("Is Paused:", status.isPaused);

  // Test a known blacklisted address (Tornado Cash)
  const TORNADO_CASH = "0x8589427373D6D84E98730D7795D8f6f8731FDA16";
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const UNISWAP = "0xE592427A0AEce92De3Edee1F18E0157C05861564";

  // Test with valid targets
  console.log("\n=== Testing validateExecution ===");

  try {
    const validResult = await ace.validateExecution([USDC, UNISWAP], [0, 0]);
    console.log("Valid targets (USDC + Uniswap):", validResult);
  } catch (e) {
    console.log("Valid targets failed:", e.message);
  }

  // Test with blacklisted target (if blacklist is enabled)
  if (status.blacklistOn) {
    try {
      const blacklistResult = await ace.validateExecution([TORNADO_CASH], [0]);
      console.log("Blacklisted target (Tornado Cash):", blacklistResult);
    } catch (e) {
      console.log("Blacklist blocked Tornado Cash:", e.message);
    }
  }

  // Use checkExecution for non-reverting check
  console.log("\n=== Detailed Check (non-reverting) ===");
  const checkResult = await ace.checkExecution([USDC, UNISWAP], [0, 0]);
  console.log("All valid:", checkResult.allValid);
  console.log("Whitelist result:", checkResult.whitelistResult);
  console.log("Blacklist result:", checkResult.blacklistResult);
  console.log("Volume result:", checkResult.volumeResult);
}

main().catch(console.error);
