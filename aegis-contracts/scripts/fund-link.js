// Fund TrustedAgentRegistryV2 with LINK for CCIP fees
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  const LINK_TOKEN = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
  const REGISTRY_V2 = "0xae633E7208e8D6b2930ad6f698D625C95db932AF";

  console.log("Funding RegistryV2 with LINK for CCIP fees...");

  // For LINK token, the balances mapping is at slot 1
  // Slot calculation: keccak256(abi.encode(address, uint256(1)))
  const amount = ethers.parseEther("1000"); // 1000 LINK

  // Calculate storage slot for registry balance
  const registrySlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [REGISTRY_V2, 1]
    )
  );

  // Calculate storage slot for deployer balance
  const deployerSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [deployer.address, 1]
    )
  );

  // Set storage using tenderly_setStorageAt
  const amountHex = ethers.zeroPadValue(ethers.toBeHex(amount), 32);

  await ethers.provider.send("tenderly_setStorageAt", [
    LINK_TOKEN,
    registrySlot,
    amountHex
  ]);
  console.log("Set 1000 LINK balance on RegistryV2 via storage override");

  await ethers.provider.send("tenderly_setStorageAt", [
    LINK_TOKEN,
    deployerSlot,
    amountHex
  ]);
  console.log("Set 1000 LINK balance on deployer via storage override");

  // Verify
  const linkToken = await ethers.getContractAt("IERC20", LINK_TOKEN);

  const registryV2 = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY_V2);
  const ccipBalance = await registryV2.getCCIPFeeBalance();
  console.log("Registry CCIP Fee Balance:", ethers.formatEther(ccipBalance), "LINK");

  const deployerLinkBalance = await linkToken.balanceOf(deployer.address);
  console.log("Deployer LINK Balance:", ethers.formatEther(deployerLinkBalance), "LINK");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
