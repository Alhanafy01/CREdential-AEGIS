const { ethers } = require('hardhat');

async function main() {
  const STRATEGY_VAULT = '0x2E3A73aDB42e2DE8EAA8056c262C7306a1DBa036';
  
  const [signer] = await ethers.getSigners();
  console.log('Using signer:', signer.address);
  
  const vault = await ethers.getContractAt('StrategyVault', STRATEGY_VAULT, signer);
  
  console.log('');
  console.log('Creating Job #2 for PENALTY scenario...');
  console.log('Strategy: LEND (type 5)');
  console.log('Amount: 500 ETH');
  console.log('Agents: [1, 2, 3]');
  console.log('Agent 3 will propose EXCESSIVE amount → PENALIZED');
  console.log('');
  
  // LEND strategy, 500 ETH, Aave V3 Pool
  const tx = await vault.createJob(
    5, // LEND
    '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Aave V3 Pool
    ethers.parseEther('500'),
    '0x',
    [1, 2, 3]
  );
  
  console.log('Tx submitted:', tx.hash);
  const receipt = await tx.wait();
  console.log('Tx confirmed in block:', receipt.blockNumber);
  
  // Get job ID from logs
  for (const log of receipt.logs) {
    try {
      const parsed = vault.interface.parseLog(log);
      if (parsed?.name === 'StrategyJobCreated') {
        console.log('');
        console.log('✅ Job Created Successfully!');
        console.log('Job ID:', parsed.args.jobId.toString());
        console.log('Proposer:', parsed.args.proposer);
        console.log('');
        console.log('Use this tx hash for CRE workflow:');
        console.log(tx.hash);
      }
    } catch {}
  }
}

main().catch(console.error);
