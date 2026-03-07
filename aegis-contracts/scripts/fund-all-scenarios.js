/**
 * Comprehensive funding script for both AEGIS scenarios
 *
 * Scenario 1 (Arbitrage): Agents 1, 2, 5
 * Scenario 2 (Insurance): Agents 7, 8, 9
 *
 * User specifications:
 * - 1000 LINK stake per agent
 * - 50,000 USDC for StrategyVault
 * - $2200/ETH on SushiSwap (vs $2000 on Uniswap)
 */

const { ethers } = require("hardhat");

// Contract addresses
const ADDRESSES = {
  REGISTRY: "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0",
  STRATEGY_VAULT: "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407",
  LINK: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  AEGIS: "0xBbbf2Db05746734b2Bad7F402b97c6A00d9d38EC",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  FLIGHT_INSURANCE: "0x4E84d6394D95bE6d099e78DDD78F538149a02cdA",
  // DEX pools
  UNISWAP_V3_USDC_ETH: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
  SUSHISWAP_V2_USDC_ETH: "0x397FF1542f962076d0BFE58eA045FfA2d347ACa0",
};

// Storage slots for balance manipulation (mainnet verified)
const STORAGE_SLOTS = {
  LINK_BALANCE: 1,
  AEGIS_BALANCE: 0, // Standard ERC20 mapping at slot 0
  USDC_BALANCE: 9,
  WETH_BALANCE: 3,
};

async function setBalance(provider, token, address, amount, slot) {
  const balanceSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [address, slot]
    )
  );
  const hexValue = "0x" + amount.toString(16).padStart(64, '0');
  await provider.send("tenderly_setStorageAt", [
    token,
    balanceSlot,
    hexValue
  ]);
}

async function fundAgentStakes(provider, registry) {
  console.log("\n=== Funding Agent Stakes (1000 LINK each) ===");

  const agents = [1, 2, 5, 7, 8, 9];
  const stakeAmount = ethers.parseUnits("1000", 18); // 1000 LINK per agent
  const link = await ethers.getContractAt("IERC20", ADDRESSES.LINK);

  for (const agentId of agents) {
    try {
      const agent = await registry.getAgent(agentId);
      const owner = agent.owner;

      // Fund owner with LINK
      await setBalance(provider, ADDRESSES.LINK, owner, stakeAmount * 2n, STORAGE_SLOTS.LINK_BALANCE);

      // Check current stake
      const currentStake = await registry.getAgentStake(agentId);
      console.log(`Agent ${agentId} (${owner.slice(0,10)}...): Current stake = ${ethers.formatUnits(currentStake, 18)} LINK`);

      // If stake is less than 1000 LINK, we need to add more
      if (currentStake < stakeAmount) {
        const needed = stakeAmount - currentStake;
        console.log(`  -> Needs ${ethers.formatUnits(needed, 18)} more LINK`);

        // Use Tenderly impersonation via eth_sendTransaction
        await provider.send("tenderly_setBalance", [owner, ethers.toQuantity(ethers.parseEther("10"))]);

        // Approve LINK
        const approveData = link.interface.encodeFunctionData("approve", [ADDRESSES.REGISTRY, needed]);
        await provider.send("eth_sendTransaction", [{
          from: owner,
          to: ADDRESSES.LINK,
          data: approveData,
          gas: "0x100000"
        }]);

        // Stake using impersonation
        const stakeData = registry.interface.encodeFunctionData("stake", [agentId, needed]);
        await provider.send("eth_sendTransaction", [{
          from: owner,
          to: ADDRESSES.REGISTRY,
          data: stakeData,
          gas: "0x200000"
        }]);

        const newStake = await registry.getAgentStake(agentId);
        console.log(`  -> New stake: ${ethers.formatUnits(newStake, 18)} LINK`);
      } else {
        console.log(`  -> Already has sufficient stake`);
      }
    } catch (error) {
      console.log(`Agent ${agentId}: Error - ${error.message}`);
    }
  }
}

async function fundVaultUSDC(provider) {
  console.log("\n=== Funding StrategyVault with 50,000 USDC ===");

  const amount = ethers.parseUnits("50000", 6);
  await setBalance(provider, ADDRESSES.USDC, ADDRESSES.STRATEGY_VAULT, amount, STORAGE_SLOTS.USDC_BALANCE);

  const usdc = await ethers.getContractAt("IERC20", ADDRESSES.USDC);
  const balance = await usdc.balanceOf(ADDRESSES.STRATEGY_VAULT);
  console.log(`StrategyVault USDC: ${ethers.formatUnits(balance, 6)}`);
}

async function fundRegistryAEGIS(provider) {
  console.log("\n=== Funding Registry with AEGIS tokens for rewards ===");

  const amount = ethers.parseUnits("100000", 18); // 100k AEGIS for rewards
  await setBalance(provider, ADDRESSES.AEGIS, ADDRESSES.REGISTRY, amount, STORAGE_SLOTS.AEGIS_BALANCE);

  const aegis = await ethers.getContractAt("IERC20", ADDRESSES.AEGIS);
  const balance = await aegis.balanceOf(ADDRESSES.REGISTRY);
  console.log(`Registry AEGIS: ${ethers.formatUnits(balance, 18)}`);
}

async function setupSushiSwapPool(provider) {
  console.log("\n=== Setting up SushiSwap pool for $2200/ETH ===");

  // SushiSwap V2 uses constant product (x*y=k)
  // For $2200/ETH: We need USDC/WETH ratio to reflect this price
  // Using 22M USDC and 10,000 WETH = $2200/ETH

  const sushiPool = ADDRESSES.SUSHISWAP_V2_USDC_ETH;

  // SushiSwap V2 pool storage:
  // slot 8: reserve0 (USDC - token0) and reserve1 (WETH - token1) packed
  // For UniswapV2Pair: reserve0, reserve1, blockTimestampLast are packed in slot 8

  const usdcReserve = ethers.parseUnits("22000000", 6); // 22M USDC
  const wethReserve = ethers.parseUnits("10000", 18);   // 10,000 WETH = $2200/ETH
  const blockTimestamp = BigInt(Math.floor(Date.now() / 1000)) % (2n ** 32n);

  // Pack reserves: reserve0 (112 bits) | reserve1 (112 bits) | blockTimestampLast (32 bits)
  // Note: USDC is token0, WETH is token1 in this pool
  const packed = (usdcReserve) | (wethReserve << 112n) | (blockTimestamp << 224n);

  // Convert to hex string properly
  const hexValue = "0x" + packed.toString(16).padStart(64, '0');

  await provider.send("tenderly_setStorageAt", [
    sushiPool,
    "0x0000000000000000000000000000000000000000000000000000000000000008",
    hexValue
  ]);

  // Also fund the pool with actual tokens
  await setBalance(provider, ADDRESSES.USDC, sushiPool, usdcReserve, STORAGE_SLOTS.USDC_BALANCE);
  await setBalance(provider, ADDRESSES.WETH, sushiPool, wethReserve, STORAGE_SLOTS.WETH_BALANCE);

  // Verify by reading storage directly
  const slot8 = await provider.getStorage(sushiPool, 8);
  const reserve0 = BigInt(slot8) & ((1n << 112n) - 1n);
  const reserve1 = (BigInt(slot8) >> 112n) & ((1n << 112n) - 1n);
  const impliedPrice = (Number(reserve0) / 1e6) / (Number(reserve1) / 1e18);
  console.log(`SushiSwap reserves: ${ethers.formatUnits(reserve0, 6)} USDC / ${ethers.formatUnits(reserve1, 18)} WETH`);
  console.log(`SushiSwap implied price: $${impliedPrice.toFixed(2)}/ETH`);
}

async function setupUniswapV3Pool(provider) {
  console.log("\n=== Checking Uniswap V3 pool ($2000/ETH target) ===");

  // Read current price from Uniswap V3
  // slot0 contains sqrtPriceX96 in the first 160 bits
  const slot0Data = await provider.getStorage(ADDRESSES.UNISWAP_V3_USDC_ETH, 0);
  const sqrtPriceX96 = BigInt(slot0Data) & ((1n << 160n) - 1n);

  // Calculate price from sqrtPriceX96
  // For USDC/WETH pair: price = (sqrtPriceX96)^2 / 2^192 * 10^12
  const impliedPrice = (Number(sqrtPriceX96) / 2**96) ** 2 * 1e12;
  console.log(`Uniswap V3 sqrtPriceX96: ${sqrtPriceX96.toString()}`);
  console.log(`Uniswap V3 implied price: $${impliedPrice.toFixed(2)}/ETH`);

  // Fund pool with liquidity tokens (keeping existing price, just ensuring liquidity)
  const usdcAmount = ethers.parseUnits("20000000", 6);  // 20M USDC
  const wethAmount = ethers.parseUnits("10000", 18);    // 10,000 WETH
  await setBalance(provider, ADDRESSES.USDC, ADDRESSES.UNISWAP_V3_USDC_ETH, usdcAmount, STORAGE_SLOTS.USDC_BALANCE);
  await setBalance(provider, ADDRESSES.WETH, ADDRESSES.UNISWAP_V3_USDC_ETH, wethAmount, STORAGE_SLOTS.WETH_BALANCE);
  console.log(`Uniswap V3 funded with liquidity`);
}

async function fundFlightInsurance(provider) {
  console.log("\n=== Funding FlightInsurance contract ===");

  // Fund FlightInsurance with USDC for payouts
  const amount = ethers.parseUnits("100000", 6); // 100k USDC for payouts
  await setBalance(provider, ADDRESSES.USDC, ADDRESSES.FLIGHT_INSURANCE, amount, STORAGE_SLOTS.USDC_BALANCE);

  const usdc = await ethers.getContractAt("IERC20", ADDRESSES.USDC);
  const balance = await usdc.balanceOf(ADDRESSES.FLIGHT_INSURANCE);
  console.log(`FlightInsurance USDC: ${ethers.formatUnits(balance, 6)}`);
}

async function fundDeployer(provider, deployer) {
  console.log("\n=== Funding deployer wallet ===");

  // Fund deployer with ETH
  await provider.send("tenderly_setBalance", [
    deployer.address,
    ethers.toQuantity(ethers.parseEther("100"))
  ]);

  // Fund with USDC for buying policies
  const usdcAmount = ethers.parseUnits("10000", 6);
  await setBalance(provider, ADDRESSES.USDC, deployer.address, usdcAmount, STORAGE_SLOTS.USDC_BALANCE);

  // Fund with LINK for staking
  const linkAmount = ethers.parseUnits("10000", 18);
  await setBalance(provider, ADDRESSES.LINK, deployer.address, linkAmount, STORAGE_SLOTS.LINK_BALANCE);

  const usdc = await ethers.getContractAt("IERC20", ADDRESSES.USDC);
  const link = await ethers.getContractAt("IERC20", ADDRESSES.LINK);

  console.log(`Deployer ETH: ${ethers.formatEther(await provider.getBalance(deployer.address))}`);
  console.log(`Deployer USDC: ${ethers.formatUnits(await usdc.balanceOf(deployer.address), 6)}`);
  console.log(`Deployer LINK: ${ethers.formatUnits(await link.balanceOf(deployer.address), 18)}`);
}

async function verifySetup(provider) {
  console.log("\n" + "=".repeat(60));
  console.log("=== VERIFICATION SUMMARY ===");
  console.log("=".repeat(60));

  const usdc = await ethers.getContractAt("IERC20", ADDRESSES.USDC);
  const link = await ethers.getContractAt("IERC20", ADDRESSES.LINK);
  const aegis = await ethers.getContractAt("IERC20", ADDRESSES.AEGIS);
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", ADDRESSES.REGISTRY);

  console.log("\n--- Token Balances ---");
  console.log(`StrategyVault USDC: ${ethers.formatUnits(await usdc.balanceOf(ADDRESSES.STRATEGY_VAULT), 6)}`);
  console.log(`FlightInsurance USDC: ${ethers.formatUnits(await usdc.balanceOf(ADDRESSES.FLIGHT_INSURANCE), 6)}`);
  console.log(`Registry AEGIS: ${ethers.formatUnits(await aegis.balanceOf(ADDRESSES.REGISTRY), 18)}`);

  console.log("\n--- Agent Stakes ---");
  for (const agentId of [1, 2, 5, 7, 8, 9]) {
    const stake = await registry.getAgentStake(agentId);
    console.log(`Agent ${agentId}: ${ethers.formatUnits(stake, 18)} LINK`);
  }

  console.log("\n--- DEX Pools ---");
  try {
    const sushiSlot8 = await provider.getStorage(ADDRESSES.SUSHISWAP_V2_USDC_ETH, 8);
    const r0 = BigInt(sushiSlot8) & ((1n << 112n) - 1n);
    const r1 = (BigInt(sushiSlot8) >> 112n) & ((1n << 112n) - 1n);
    const sushiPrice = (Number(r0) / 1e6) / (Number(r1) / 1e18);
    console.log(`SushiSwap: $${sushiPrice.toFixed(2)}/ETH`);
  } catch (e) {
    console.log(`SushiSwap: Error reading reserves`);
  }

  try {
    const slot0Data = await provider.getStorage(ADDRESSES.UNISWAP_V3_USDC_ETH, 0);
    const sqrtPriceX96 = BigInt(slot0Data) & ((1n << 160n) - 1n);
    const uniPrice = (Number(sqrtPriceX96) / 2**96) ** 2 * 1e12;
    console.log(`Uniswap V3: $${uniPrice.toFixed(2)}/ETH`);
  } catch (e) {
    console.log(`Uniswap V3: Error reading price`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("Setup complete! Ready for testing both scenarios.");
  console.log("=".repeat(60));
}

async function main() {
  console.log("=".repeat(60));
  console.log("AEGIS Protocol - Comprehensive Funding Script");
  console.log("=".repeat(60));

  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", ADDRESSES.REGISTRY);

  console.log("Deployer:", deployer.address);
  console.log("Network:", (await provider.getNetwork()).chainId.toString());

  // Execute all funding operations
  await fundDeployer(provider, deployer);
  await fundVaultUSDC(provider);
  await fundRegistryAEGIS(provider);
  await fundFlightInsurance(provider);
  await fundAgentStakes(provider, registry);
  await setupSushiSwapPool(provider);
  await setupUniswapV3Pool(provider);

  // Verify everything
  await verifySetup(provider);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
