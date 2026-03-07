const { ethers } = require("hardhat");

async function main() {
  // Check the 'to' address of TX1 and TX2 to see which registry they were sent to
  const tx1 = await ethers.provider.getTransaction("0x27f414f424611d91f4ebfc7662d33b7f5f94477b2b288843af1ccbeaeb568a4b");
  console.log("TX1 to:", tx1.to);

  const tx2 = await ethers.provider.getTransaction("0x8ef74758519444a9170730579507fa483f7d7439cb879f3dbaf20aff0da09077");
  console.log("TX2 to:", tx2.to);

  // Correct registry
  console.log("Expected Registry:", "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0");
}

main().catch(console.error);
