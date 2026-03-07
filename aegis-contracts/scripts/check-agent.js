const hre = require("hardhat");
async function main() {
  const reg = await hre.ethers.getContractAt("TrustedAgentRegistry", "0x608f4Ea047470a36Df5BC5D6121A99AC50394a8c");
  const agent = await reg.getAgent(7);
  console.log("Agent 7 Owner:", agent.owner);
  console.log("Agent 7 Address:", agent.agentAddress);
  console.log("Your wallet:", "0x29a3F93aFC9b52d9122358DbD65970aEc5c1697a");
  console.log("Match:", agent.owner.toLowerCase() === "0x29a3F93aFC9b52d9122358DbD65970aEc5c1697a".toLowerCase());
}
main();
