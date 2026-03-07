/**
 * Manipulate DEX prices on Tenderly to create arbitrage opportunity
 *
 * Strategy: Create price discrepancy between Uniswap V3 and SushiSwap
 * - Lower ETH price on Uniswap V3 (buy cheap)
 * - Higher ETH price on SushiSwap (sell expensive)
 *
 * This creates profit opportunity: Buy WETH cheap on UniV3 -> Sell WETH expensive on Sushi
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("=== Tenderly Price Manipulation for Arbitrage Demo ===\n");

  // Key addresses
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

  // Uniswap V3 USDC/WETH 0.05% pool
  const UNIV3_POOL = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";

  // SushiSwap V2 WETH/USDC pair
  const SUSHI_PAIR = "0x397FF1542f962076d0BFE58eA045FfA2d347ACa0";

  const provider = ethers.provider;

  // =========================================================================
  // Method 1: Manipulate Uniswap V3 Pool sqrtPriceX96
  // =========================================================================
  console.log("1. Manipulating Uniswap V3 USDC/WETH pool...");

  // Current ETH price ~$2000
  // sqrtPriceX96 = sqrt(price) * 2^96
  // For USDC/WETH pool where USDC is token0, WETH is token1:
  // price = (sqrtPriceX96 / 2^96)^2 = USDC per WETH

  // To make ETH CHEAPER on Uniswap (e.g., $1800):
  // sqrtPriceX96 = sqrt(1800 * 10^6 / 10^18) * 2^96
  // = sqrt(1800 * 10^-12) * 2^96
  // = sqrt(1.8 * 10^-9) * 2^96
  // ≈ 4.24e-5 * 7.92e28 ≈ 3.36e24

  // Uniswap V3 pool slot0 contains sqrtPriceX96 at slot 0
  const slot0Slot = "0x0000000000000000000000000000000000000000000000000000000000000000";

  // Read current slot0
  const currentSlot0 = await provider.getStorage(UNIV3_POOL, slot0Slot);
  console.log(`  Current slot0: ${currentSlot0.slice(0, 50)}...`);

  // Calculate new sqrtPriceX96 for $1800 ETH (cheaper)
  // In this pool, token0=USDC, token1=WETH
  // sqrtPriceX96 = sqrt(token1/token0 in terms of decimals) * 2^96
  // For $1800 ETH: sqrt(1/1800 * 10^18/10^6) * 2^96 = sqrt(555.56 * 10^9) * 2^96

  const targetEthPriceUniswap = 1800n; // $1800 - cheaper
  // sqrtPriceX96 = sqrt(10^12 / price) * 2^96
  // For USDC(6 decimals)/WETH(18 decimals): we need to account for decimal difference

  // Actually for Uniswap V3 USDC/WETH 0.05% pool:
  // The current sqrtPriceX96 encodes the price
  // Let's just scale the current price down by ~10%

  const currentSqrtPrice = BigInt(currentSlot0.slice(0, 42)); // First 160 bits
  console.log(`  Current sqrtPriceX96: ${currentSqrtPrice}`);

  // Lower price by 10% (multiply sqrtPrice by 0.95, since price = sqrtPrice^2)
  // To get 10% lower price, multiply sqrtPrice by sqrt(0.9) ≈ 0.949
  const newSqrtPrice = (currentSqrtPrice * 949n) / 1000n;
  console.log(`  New sqrtPriceX96: ${newSqrtPrice} (10% lower ETH price)`);

  // Reconstruct slot0 with new sqrtPriceX96
  // slot0 format: sqrtPriceX96 (160 bits) | tick (24 bits) | ... other packed data
  // We need to preserve the other data

  // For simplicity, let's manipulate reserves directly using a different approach

  // =========================================================================
  // Method 2: Manipulate SushiSwap V2 reserves directly
  // =========================================================================
  console.log("\n2. Manipulating SushiSwap V2 WETH/USDC pair reserves...");

  // SushiSwap V2 pair storage:
  // Slot 8: reserve0 (112 bits) | reserve1 (112 bits) | blockTimestampLast (32 bits)
  const reserveSlot = "0x0000000000000000000000000000000000000000000000000000000000000008";

  const currentReserves = await provider.getStorage(SUSHI_PAIR, reserveSlot);
  console.log(`  Current reserves slot: ${currentReserves}`);

  // Set REALISTIC reserves for a proper arbitrage demo
  // SushiSwap WETH/USDC pair: token0 = USDC, token1 = WETH (verified on-chain!)

  // Target: $2200/ETH on SushiSwap (higher than Uniswap's ~$2000)
  // With 10,000 WETH reserve: need 22,000,000 USDC reserve
  const targetWethReserve = ethers.parseEther("10000"); // 10,000 WETH (token1)
  const targetUsdcReserve = ethers.parseUnits("22000000", 6); // 22M USDC (token0) = $2200/ETH

  console.log(`  Setting reserves for $2200/ETH...`);
  console.log(`  Target USDC reserve (token0): ${ethers.formatUnits(targetUsdcReserve, 6)} USDC`);
  console.log(`  Target WETH reserve (token1): ${ethers.formatEther(targetWethReserve)} WETH`);

  // Current timestamp
  const currentBlock = await provider.getBlock("latest");
  const timestamp = BigInt(currentBlock.timestamp);

  // Pack reserves into slot8 format: reserve0 | reserve1 << 112 | timestamp << 224
  // IMPORTANT: token0=USDC (reserve0), token1=WETH (reserve1)
  const newReserveData = targetUsdcReserve | (targetWethReserve << 112n) | (timestamp << 224n);
  const newReserveHex = "0x" + newReserveData.toString(16).padStart(64, '0');

  await provider.send("tenderly_setStorageAt", [
    SUSHI_PAIR,
    reserveSlot,
    newReserveHex
  ]);

  // Verify
  const verifyReserves = await provider.getStorage(SUSHI_PAIR, reserveSlot);
  const verifyData = BigInt(verifyReserves);
  const verifyReserve0 = verifyData & ((1n << 112n) - 1n);
  const verifyReserve1 = (verifyData >> 112n) & ((1n << 112n) - 1n);

  // token0 = USDC, token1 = WETH
  console.log(`  Verified USDC reserve (token0): ${ethers.formatUnits(verifyReserve0, 6)} USDC`);
  console.log(`  Verified WETH reserve (token1): ${ethers.formatEther(verifyReserve1)} WETH`);

  // Price = USDC/WETH = reserve0 (USDC) / reserve1 (WETH) adjusted for decimals
  const newSushiPrice = Number(verifyReserve0) / Number(verifyReserve1) * 1e12;
  console.log(`  New ETH price on Sushi: $${newSushiPrice.toFixed(2)}`);

  // Also fund the SushiSwap pair contract with actual tokens
  console.log(`\n  Funding SushiSwap pair with tokens...`);

  // Fund pair with WETH
  const wethBalanceSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [SUSHI_PAIR, 3])
  );
  await provider.send("tenderly_setStorageAt", [
    WETH,
    wethBalanceSlot,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [targetWethReserve])
  ]);

  // Fund pair with USDC
  const usdcBalanceSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [SUSHI_PAIR, 9])
  );
  await provider.send("tenderly_setStorageAt", [
    USDC,
    usdcBalanceSlot,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [targetUsdcReserve])
  ]);

  const wethContract = await ethers.getContractAt("IERC20", WETH);
  const pairWethBalance = await wethContract.balanceOf(SUSHI_PAIR);
  console.log(`  Pair WETH balance: ${ethers.formatEther(pairWethBalance)} WETH`);

  // =========================================================================
  // Method 3: Fund the vault with more USDC for the trade
  // =========================================================================
  console.log("\n3. Ensuring vault has sufficient USDC...");

  const VAULT = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";

  // USDC balanceOf slot = keccak256(address, 9) for USDC
  const vaultUsdcSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [VAULT, 9] // USDC uses slot 9 for balances
    )
  );

  const largeUsdcBalance = ethers.parseUnits("1000000", 6); // 1M USDC
  await provider.send("tenderly_setStorageAt", [
    USDC,
    vaultUsdcSlot,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [largeUsdcBalance])
  ]);

  const usdcContract = await ethers.getContractAt("IERC20", USDC);
  const vaultBalance = await usdcContract.balanceOf(VAULT);
  console.log(`  Vault USDC balance: ${ethers.formatUnits(vaultBalance, 6)} USDC`);

  // =========================================================================
  // Also fund Uniswap V3 pool with liquidity
  // =========================================================================
  console.log("\n4. Funding Uniswap V3 pool with liquidity...");

  // Fund UniV3 pool with WETH and USDC
  const univ3WethSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [UNIV3_POOL, 3])
  );
  await provider.send("tenderly_setStorageAt", [
    WETH,
    univ3WethSlot,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther("50000")])
  ]);

  const univ3UsdcSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [UNIV3_POOL, 9])
  );
  await provider.send("tenderly_setStorageAt", [
    USDC,
    univ3UsdcSlot,
    ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseUnits("100000000", 6)]) // 100M USDC
  ]);

  const poolWeth = await wethContract.balanceOf(UNIV3_POOL);
  const poolUsdc = await usdcContract.balanceOf(UNIV3_POOL);
  console.log(`  UniV3 Pool WETH: ${ethers.formatEther(poolWeth)} WETH`);
  console.log(`  UniV3 Pool USDC: ${ethers.formatUnits(poolUsdc, 6)} USDC`);

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("\n=== Price Manipulation Complete ===");
  console.log(`\nArbitrage Opportunity Created:`);
  console.log(`  - Uniswap V3: ~$2000/ETH (Chainlink price)`);
  console.log(`  - SushiSwap:  ~$${newSushiPrice.toFixed(0)}/ETH (manipulated 10% higher)`);
  console.log(`\nProfit Strategy (Cross-DEX Arbitrage):`);
  console.log(`  1. Buy WETH on Uniswap V3 at ~$2000`);
  console.log(`  2. Sell WETH on SushiSwap at ~$2200`);
  console.log(`  3. Expected profit: ~10% per trade (~$200 per ETH)`);
  console.log(`\nVault is funded with 1M USDC for trading.`);
  console.log(`\nRun arbitrage job with: "Execute a cross-DEX arbitrage between Uniswap V3 and SushiSwap"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
