const { ethers } = require("hardhat");

const REGISTRY = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
const LINK = "0x514910771AF9Ca656af840dff83E8264EcF986CA";
const LINK_BALANCE_SLOT = 1;

async function main() {
  const provider = ethers.provider;
  const registry = await ethers.getContractAt("TrustedAgentRegistryV2", REGISTRY);
  const link = await ethers.getContractAt("IERC20", LINK);
  
  // Agent 5's owner
  const agent5Owner = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  
  console.log("=== Refunding Agent 5 ===");
  
  // 1. Fund owner with LINK via storage manipulation
  const amount = ethers.parseEther("200"); // 200 LINK
  const balanceSlot = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "uint256"],
      [agent5Owner, LINK_BALANCE_SLOT]
    )
  );
  const hexValue = "0x" + amount.toString(16).padStart(64, '0');

  await provider.send("tenderly_setStorageAt", [
    LINK,
    balanceSlot,
    hexValue
  ]);
  
  const linkBalance = await link.balanceOf(agent5Owner);
  console.log("Owner LINK balance:", ethers.formatEther(linkBalance), "LINK");
  
  // 2. Approve LINK for registry via eth_sendTransaction (Tenderly impersonation)
  const approveData = link.interface.encodeFunctionData("approve", [REGISTRY, ethers.MaxUint256]);
  await provider.send("eth_sendTransaction", [{
    from: agent5Owner,
    to: LINK,
    data: approveData,
    gas: "0x100000"
  }]);
  console.log("Approved Registry for LINK");
  
  // 3. Add stake via increaseStake using eth_sendTransaction
  const stakeAmount = ethers.parseEther("150"); // Add 150 LINK stake
  const stakeData = registry.interface.encodeFunctionData("increaseStake", [5, stakeAmount]);
  
  await provider.send("eth_sendTransaction", [{
    from: agent5Owner,
    to: REGISTRY,
    data: stakeData,
    gas: "0x200000"
  }]);
  console.log("Added 150 LINK stake to Agent 5");
  
  // 4. Verify
  const agent = await registry.agents(5);
  console.log("\n=== Agent 5 After Refund ===");
  console.log("Stake:", ethers.formatEther(agent.stake), "LINK");
  console.log("Reputation:", agent.reputation.toString());
  console.log("Verified:", agent.verified);
}

main().catch(console.error);
