const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const VAULT_ADDRESS = "0xDb102FB66A06255fa7EF5A620bF9a993eF9c3CBD";
  const REGISTRY_ADDRESS = "0x0752251691D1E48385199e461C555bE31e9EC14e";

  console.log("Setting registry on StrategyVault...");

  const vault = await hre.ethers.getContractAt(
    ["function setRegistry(address _registry) external", "function registry() external view returns (address)"],
    VAULT_ADDRESS,
    deployer
  );

  const tx = await vault.setRegistry(REGISTRY_ADDRESS);
  await tx.wait();

  const newRegistry = await vault.registry();
  console.log("Registry set to:", newRegistry);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
