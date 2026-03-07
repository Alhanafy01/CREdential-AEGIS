'use client';

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import Link from 'next/link';
import {
  RWA_VAULT_ADDRESS,
  RUSD_ADDRESS,
  REGISTRY_ADDRESS,
  RWA_VAULT_ABI,
  RUSD_ABI,
  REGISTRY_ABI,
} from '@/lib/constants';

interface Position {
  collateralETH: bigint;
  debtRUSD: bigint;
  healthFactor: bigint;
  ethPriceUSD: bigint;
}

interface VaultStats {
  totalCollateral: bigint;
  totalDebt: bigint;
  ethPrice: bigint;
  collateralRatio: bigint;
}

interface Agent {
  agentId: number;
  name: string;
  verified: boolean;
  reputation: number;
}

export default function RWAPage() {
  const [, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [address, setAddress] = useState<string>('');
  const [position, setPosition] = useState<Position | null>(null);
  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);
  const [rusdBalance, setRusdBalance] = useState<bigint>(BigInt(0));
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<number[]>([1, 2, 3]);

  // Form states
  const [depositAmount, setDepositAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [mockPrice, setMockPrice] = useState('2000');

  // Loading states
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // CRE Command Modal
  const [creModal, setCreModal] = useState<{
    show: boolean;
    jobId: string;
    txHash: string;
    blockNumber: number;
  } | null>(null);

  // Tenderly Network Configuration
  // Tenderly Virtual Mainnet uses Chain ID 1 (it's a mainnet fork)
  // We use a dedicated JsonRpcProvider for transactions to ensure correct RPC
  const TENDERLY_RPC = 'https://virtual.mainnet.eu.rpc.tenderly.co/f277af26-9cfb-4ba8-943c-92c32507741e';

  // Demo wallet for Tenderly Virtual Testnet
  // This is a test private key - NEVER use in production!
  const DEMO_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const DEMO_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

  // State for demo mode
  const [useDemo, setUseDemo] = useState(false);

  // Get a signer that directly uses Tenderly RPC
  const getTenderlyProvider = () => {
    return new ethers.JsonRpcProvider(TENDERLY_RPC);
  };

  const getTenderlySigner = () => {
    const provider = getTenderlyProvider();
    return new ethers.Wallet(DEMO_PRIVATE_KEY, provider);
  };

  // Connect with demo wallet (direct Tenderly RPC)
  const connectDemoWallet = async () => {
    try {
      setTxStatus('Connecting to Tenderly with Demo Wallet...');

      const demoSigner = getTenderlySigner();
      const demoProvider = getTenderlyProvider();

      setProvider(demoProvider as unknown as ethers.BrowserProvider);
      setSigner(demoSigner);
      setAddress(DEMO_ADDRESS);
      setUseDemo(true);
      setTxStatus('Connected with Demo Wallet!');

      // Clear status after 3 seconds
      setTimeout(() => setTxStatus(''), 3000);
    } catch (error) {
      console.error('Failed to connect demo wallet:', error);
      setTxStatus('Failed to connect demo wallet');
    }
  };

  // Connect with MetaMask (if user has Tenderly network configured)
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        setTxStatus('Connecting MetaMask...');

        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        await browserProvider.send('eth_requestAccounts', []);
        const walletSigner = await browserProvider.getSigner();
        const walletAddress = await walletSigner.getAddress();

        setProvider(browserProvider);
        setSigner(walletSigner);
        setAddress(walletAddress);
        setUseDemo(false);
        setTxStatus('Connected with MetaMask! Make sure you\'re on Tenderly network.');

        // Clear status after 3 seconds
        setTimeout(() => setTxStatus(''), 3000);
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        setTxStatus('Failed to connect wallet');
      }
    } else {
      alert('Please install MetaMask or use the Demo Wallet!');
    }
  };

  // Load data
  const loadData = useCallback(async () => {
    if (!address) return;

    try {
      // Use the Tenderly RPC directly to ensure we're reading from the right network
      const rpcProvider = new ethers.JsonRpcProvider(TENDERLY_RPC);
      const vaultContract = new ethers.Contract(RWA_VAULT_ADDRESS, RWA_VAULT_ABI, rpcProvider);
      const rusdContract = new ethers.Contract(RUSD_ADDRESS, RUSD_ABI, rpcProvider);
      const registryContract = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, rpcProvider);

      // Get position
      const [collateralETH, debtRUSD, healthFactor, ethPriceUSD] = await vaultContract.getPosition(address);
      setPosition({ collateralETH, debtRUSD, healthFactor, ethPriceUSD });

      // Get vault stats
      const [totalCollateral, totalDebt, ethPrice, collateralRatio] = await vaultContract.getVaultStats();
      setVaultStats({ totalCollateral, totalDebt, ethPrice, collateralRatio });

      // Get RUSD balance
      const balance = await rusdContract.balanceOf(address);
      setRusdBalance(balance);

      // Get agents
      const nextAgentId = await registryContract.nextAgentId();
      const agentList: Agent[] = [];
      for (let i = 1; i < Number(nextAgentId); i++) {
        try {
          const agent = await registryContract.getAgent(i);
          agentList.push({
            agentId: i,
            name: `Agent ${i}`,
            verified: agent.verified,
            reputation: Number(agent.reputation),
          });
        } catch {
          // Agent doesn't exist
        }
      }
      setAgents(agentList);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, [address]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (address) {
      loadData();
      const interval = setInterval(loadData, 10000);
      return () => clearInterval(interval);
    }
  }, [address, loadData]);

  // Get the active signer (demo or MetaMask)
  const getActiveSigner = () => {
    if (useDemo) {
      return getTenderlySigner();
    }
    return signer;
  };

  // Deposit ETH
  const handleDeposit = async () => {
    const activeSigner = getActiveSigner();
    if (!activeSigner || !depositAmount) return;
    setLoading(true);
    setTxStatus('Depositing ETH...');
    try {
      const vaultContract = new ethers.Contract(RWA_VAULT_ADDRESS, RWA_VAULT_ABI, activeSigner);
      const tx = await vaultContract.deposit({ value: ethers.parseEther(depositAmount) });
      setTxStatus('Transaction submitted, waiting for confirmation...');
      await tx.wait();
      setTxStatus('Deposit successful!');
      setDepositAmount('');
      loadData();
    } catch (error: unknown) {
      const err = error as Error;
      setTxStatus(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  // Borrow RUSD
  const handleBorrow = async () => {
    const activeSigner = getActiveSigner();
    if (!activeSigner || !borrowAmount) return;
    setLoading(true);
    setTxStatus('Borrowing RUSD...');
    try {
      const vaultContract = new ethers.Contract(RWA_VAULT_ADDRESS, RWA_VAULT_ABI, activeSigner);
      const tx = await vaultContract.borrow(ethers.parseEther(borrowAmount));
      setTxStatus('Transaction submitted, waiting for confirmation...');
      await tx.wait();
      setTxStatus('Borrow successful!');
      setBorrowAmount('');
      loadData();
    } catch (error: unknown) {
      const err = error as Error;
      setTxStatus(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  // Repay RUSD
  const handleRepay = async () => {
    const activeSigner = getActiveSigner();
    if (!activeSigner || !repayAmount) return;
    setLoading(true);
    setTxStatus('Repaying RUSD...');
    try {
      const vaultContract = new ethers.Contract(RWA_VAULT_ADDRESS, RWA_VAULT_ABI, activeSigner);
      const rusdContract = new ethers.Contract(RUSD_ADDRESS, RUSD_ABI, activeSigner);

      // Approve RUSD spending
      const amount = ethers.parseEther(repayAmount);
      const allowance = await rusdContract.allowance(address, RWA_VAULT_ADDRESS);
      if (allowance < amount) {
        setTxStatus('Approving RUSD...');
        const approveTx = await rusdContract.approve(RWA_VAULT_ADDRESS, amount);
        await approveTx.wait();
      }

      const tx = await vaultContract.repay(amount);
      setTxStatus('Transaction submitted, waiting for confirmation...');
      await tx.wait();
      setTxStatus('Repay successful!');
      setRepayAmount('');
      loadData();
    } catch (error: unknown) {
      const err = error as Error;
      setTxStatus(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  // Withdraw ETH
  const handleWithdraw = async () => {
    const activeSigner = getActiveSigner();
    if (!activeSigner || !withdrawAmount) return;
    setLoading(true);
    setTxStatus('Withdrawing ETH...');
    try {
      const vaultContract = new ethers.Contract(RWA_VAULT_ADDRESS, RWA_VAULT_ABI, activeSigner);
      const tx = await vaultContract.withdraw(ethers.parseEther(withdrawAmount));
      setTxStatus('Transaction submitted, waiting for confirmation...');
      await tx.wait();
      setTxStatus('Withdraw successful!');
      setWithdrawAmount('');
      loadData();
    } catch (error: unknown) {
      const err = error as Error;
      setTxStatus(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  // Set mock ETH price (admin function)
  const handleSetMockPrice = async () => {
    const activeSigner = getActiveSigner();
    if (!activeSigner || !mockPrice) return;
    setLoading(true);
    setTxStatus('Setting mock ETH price...');
    try {
      const vaultContract = new ethers.Contract(RWA_VAULT_ADDRESS, RWA_VAULT_ABI, activeSigner);
      const priceWith8Decimals = BigInt(parseFloat(mockPrice) * 1e8);
      const tx = await vaultContract.setMockETHPrice(priceWith8Decimals);
      setTxStatus('Transaction submitted, waiting for confirmation...');
      await tx.wait();
      setTxStatus(`Mock price set to $${mockPrice}!`);
      loadData();
    } catch (error: unknown) {
      const err = error as Error;
      setTxStatus(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  // Request Guardian Job (triggers CRE workflow)
  const handleRequestGuardianJob = async () => {
    const activeSigner = getActiveSigner();
    if (!activeSigner) return;
    setLoading(true);
    setTxStatus('Requesting Guardian Job...');
    try {
      const vaultContract = new ethers.Contract(RWA_VAULT_ADDRESS, RWA_VAULT_ABI, activeSigner);
      // Use selected agents or default to [1, 2]
      const agentIds = selectedAgents.length > 0 ? selectedAgents : [1, 2];
      const tx = await vaultContract.requestGuardianJob(agentIds);
      setTxStatus('Transaction submitted, waiting for confirmation...');
      const receipt = await tx.wait();

      // Find the job ID from the event
      const jobEvent = receipt.logs.find((log: { topics: string[] }) =>
        log.topics[0] === ethers.id('RWAGuardianJobCreated(uint256,address,bytes)')
      );

      let jobId = '0';
      if (jobEvent) {
        jobId = BigInt(jobEvent.topics[1]).toString();
      }

      // Show CRE command modal
      setCreModal({
        show: true,
        jobId,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });

      setTxStatus(`Guardian Job #${jobId} created!`);
      loadData();
    } catch (error: unknown) {
      const err = error as Error;
      setTxStatus(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  // Toggle agent selection
  const toggleAgent = (agentId: number) => {
    setSelectedAgents(prev =>
      prev.includes(agentId)
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  // Format values for display
  const formatETH = (wei: bigint) => {
    return parseFloat(ethers.formatEther(wei)).toFixed(4);
  };

  const formatUSD = (value: bigint, decimals: number = 8) => {
    return (Number(value) / Math.pow(10, decimals)).toFixed(2);
  };

  const formatHealthFactor = (hf: bigint) => {
    return (Number(hf) / 100).toFixed(2);
  };

  const getHealthFactorColor = (hf: bigint) => {
    const hfNum = Number(hf);
    if (hfNum < 100) return 'text-red-500';
    if (hfNum < 150) return 'text-orange-500';
    if (hfNum < 200) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block">
              &larr; Back to Marketplace
            </Link>
            <h1 className="text-3xl font-bold">RWA Collateral Guardian</h1>
            <p className="text-gray-400">CDP Vault with AI-Powered Risk Management</p>
          </div>
          <div className="text-right">
            {address ? (
              <div>
                <div className="text-sm text-green-400 flex items-center gap-1 justify-end">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  {useDemo ? 'Demo Wallet' : 'MetaMask'} on Tenderly
                </div>
                <div className="font-mono text-sm">{address.slice(0, 6)}...{address.slice(-4)}</div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={connectDemoWallet}
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium text-sm"
                >
                  Demo Wallet
                </button>
                <button
                  onClick={connectWallet}
                  className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg font-medium text-sm"
                >
                  MetaMask
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live Indicator */}
        {lastUpdate && (
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live - Last updated: {lastUpdate.toLocaleTimeString()}
            <button onClick={loadData} className="text-blue-400 hover:text-blue-300 ml-2">
              Refresh
            </button>
          </div>
        )}

        {address && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Vault Stats & Position */}
            <div className="space-y-6">
              {/* Vault Stats */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Vault Statistics</h2>
                {vaultStats && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-gray-400 text-sm">Total Collateral</div>
                      <div className="text-2xl font-bold">{formatETH(vaultStats.totalCollateral)} ETH</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-sm">Total Debt</div>
                      <div className="text-2xl font-bold">{formatETH(vaultStats.totalDebt)} RUSD</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-sm">ETH Price</div>
                      <div className="text-2xl font-bold">${formatUSD(vaultStats.ethPrice)}</div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-sm">Collateral Ratio</div>
                      <div className="text-2xl font-bold">{Number(vaultStats.collateralRatio)}%</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Your Position */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h2 className="text-xl font-semibold mb-4">Your Position</h2>
                {position && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-gray-400 text-sm">Collateral</div>
                        <div className="text-xl font-bold">{formatETH(position.collateralETH)} ETH</div>
                        <div className="text-gray-500 text-sm">
                          ${(parseFloat(formatETH(position.collateralETH)) * parseFloat(formatUSD(position.ethPriceUSD))).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-sm">Debt</div>
                        <div className="text-xl font-bold">{formatETH(position.debtRUSD)} RUSD</div>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-700">
                      <div className="text-gray-400 text-sm">Health Factor</div>
                      <div className={`text-3xl font-bold ${getHealthFactorColor(position.healthFactor)}`}>
                        {position.debtRUSD > BigInt(0) ? formatHealthFactor(position.healthFactor) : '∞'}
                      </div>
                      <div className="text-gray-500 text-sm mt-1">
                        {Number(position.healthFactor) < 150
                          ? '⚠️ At risk of liquidation'
                          : Number(position.healthFactor) > 200
                          ? '✓ Eligible for CCIP transfer'
                          : '✓ Healthy'}
                      </div>
                    </div>
                    <div className="pt-4 border-t border-gray-700">
                      <div className="text-gray-400 text-sm">RUSD Balance</div>
                      <div className="text-xl font-bold">{formatETH(rusdBalance)} RUSD</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Mock Price Control (Demo) */}
              <div className="bg-gray-800 rounded-xl p-6 border border-yellow-600/30">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <span>Demo Controls</span>
                  <span className="text-yellow-500 text-sm">(Tenderly Only)</span>
                </h2>
                <p className="text-gray-400 text-sm mb-4">
                  Simulate price changes to test liquidation and CCIP scenarios
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={mockPrice}
                    onChange={(e) => setMockPrice(e.target.value)}
                    placeholder="ETH Price (USD)"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                  />
                  <button
                    onClick={handleSetMockPrice}
                    disabled={loading}
                    className="bg-yellow-600 hover:bg-yellow-700 px-6 py-2 rounded-lg font-medium disabled:opacity-50"
                  >
                    Set Price
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setMockPrice('3000')} className="text-xs bg-gray-700 px-3 py-1 rounded">
                    $3000 (HF ↑)
                  </button>
                  <button onClick={() => setMockPrice('2000')} className="text-xs bg-gray-700 px-3 py-1 rounded">
                    $2000 (Normal)
                  </button>
                  <button onClick={() => setMockPrice('1200')} className="text-xs bg-gray-700 px-3 py-1 rounded">
                    $1200 (HF ↓)
                  </button>
                  <button onClick={() => setMockPrice('800')} className="text-xs bg-gray-700 px-3 py-1 rounded">
                    $800 (Liquidate)
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Actions */}
            <div className="space-y-6">
              {/* Deposit */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-4">Deposit Collateral</h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="ETH amount"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                  />
                  <button
                    onClick={handleDeposit}
                    disabled={loading || !depositAmount}
                    className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-medium disabled:opacity-50"
                  >
                    Deposit
                  </button>
                </div>
              </div>

              {/* Borrow */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-4">Borrow RUSD</h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={borrowAmount}
                    onChange={(e) => setBorrowAmount(e.target.value)}
                    placeholder="RUSD amount"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                  />
                  <button
                    onClick={handleBorrow}
                    disabled={loading || !borrowAmount}
                    className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium disabled:opacity-50"
                  >
                    Borrow
                  </button>
                </div>
                {position && position.collateralETH > BigInt(0) && vaultStats && (
                  <p className="text-gray-500 text-sm mt-2">
                    Max borrow: ~{(parseFloat(formatETH(position.collateralETH)) * parseFloat(formatUSD(vaultStats.ethPrice)) / 1.3).toFixed(2)} RUSD
                  </p>
                )}
              </div>

              {/* Repay */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-4">Repay RUSD</h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(e.target.value)}
                    placeholder="RUSD amount"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                  />
                  <button
                    onClick={handleRepay}
                    disabled={loading || !repayAmount}
                    className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg font-medium disabled:opacity-50"
                  >
                    Repay
                  </button>
                </div>
              </div>

              {/* Withdraw */}
              <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-4">Withdraw Collateral</h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="ETH amount"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                  />
                  <button
                    onClick={handleWithdraw}
                    disabled={loading || !withdrawAmount}
                    className="bg-orange-600 hover:bg-orange-700 px-6 py-2 rounded-lg font-medium disabled:opacity-50"
                  >
                    Withdraw
                  </button>
                </div>
              </div>

              {/* Guardian Agents */}
              <div className="bg-gray-800 rounded-xl p-6 border border-blue-600/30">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>Guardian Agents</span>
                  <span className="text-blue-400 text-sm">(CRE Workflow)</span>
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  Select agents to monitor your position and execute guardian actions via CRE
                </p>
                <div className="space-y-2 mb-4">
                  {agents.length > 0 ? agents.map((agent) => (
                    <label
                      key={agent.agentId}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${
                        selectedAgents.includes(agent.agentId)
                          ? 'bg-blue-900/30 border border-blue-600'
                          : 'bg-gray-700 border border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedAgents.includes(agent.agentId)}
                          onChange={() => toggleAgent(agent.agentId)}
                          className="w-4 h-4"
                        />
                        <span>{agent.name}</span>
                        {agent.verified && (
                          <span className="text-green-400 text-xs">Verified</span>
                        )}
                      </div>
                      <span className={`text-sm ${agent.reputation >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        Rep: {agent.reputation}
                      </span>
                    </label>
                  )) : (
                    <div className="text-gray-500 text-sm">
                      No agents registered. Using default agents [1, 2].
                    </div>
                  )}
                </div>
                <button
                  onClick={handleRequestGuardianJob}
                  disabled={loading || (position?.collateralETH === BigInt(0))}
                  className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium disabled:opacity-50 transition"
                >
                  Request Guardian Job
                </button>
                <p className="text-gray-500 text-xs mt-2 text-center">
                  Triggers CRE workflow to analyze position and execute actions
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Status */}
        {txStatus && (
          <div className="fixed bottom-4 right-4 bg-gray-800 border border-gray-600 rounded-lg p-4 max-w-md">
            <div className="flex items-center gap-2">
              {loading && (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              )}
              <span className={txStatus.startsWith('Error') ? 'text-red-400' : 'text-gray-300'}>
                {txStatus}
              </span>
            </div>
          </div>
        )}

        {/* CRE Command Modal */}
        {creModal?.show && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 border border-blue-500 rounded-xl p-6 max-w-3xl w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-blue-400">Guardian Job Created!</h3>
                <button
                  onClick={() => setCreModal(null)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Job ID:</span>
                    <span className="ml-2 text-white font-mono">#{creModal.jobId}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Block:</span>
                    <span className="ml-2 text-white font-mono">{creModal.blockNumber}</span>
                  </div>
                </div>

                <div>
                  <span className="text-gray-400 text-sm">Transaction Hash:</span>
                  <div className="bg-gray-900 rounded p-2 mt-1 font-mono text-xs text-green-400 break-all">
                    {creModal.txHash}
                  </div>
                </div>

                <div>
                  <span className="text-gray-400 text-sm">Run CRE Workflow Command:</span>
                  <div className="bg-gray-900 rounded p-3 mt-1 font-mono text-xs text-yellow-400 break-all relative group">
                    <pre className="whitespace-pre-wrap">cd /xdata/chainlinkhackathone/aegis-cre && cre workflow simulate rwa-guardian-workflow --target local-simulation --non-interactive --trigger-index 0 --evm-tx-hash {creModal.txHash} --evm-event-index 0 --broadcast</pre>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`cd /xdata/chainlinkhackathone/aegis-cre && cre workflow simulate rwa-guardian-workflow --target local-simulation --non-interactive --trigger-index 0 --evm-tx-hash ${creModal.txHash} --evm-event-index 0 --broadcast`);
                        setTxStatus('Command copied to clipboard!');
                        setTimeout(() => setTxStatus(''), 2000);
                      }}
                      className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs text-white"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div className="bg-blue-900/30 border border-blue-600/50 rounded-lg p-4 mt-4">
                  <h4 className="text-blue-400 font-semibold mb-2">Next Steps:</h4>
                  <ol className="text-gray-300 text-sm space-y-1 list-decimal list-inside">
                    <li>Copy the command above</li>
                    <li>Open a terminal and paste the command</li>
                    <li>The CRE workflow will analyze your position health factor</li>
                    <li>If HF &lt; 1.5: Liquidation action will execute</li>
                    <li>If HF &gt; 2.0: CCIP transfer will be initiated</li>
                  </ol>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`cd /xdata/chainlinkhackathone/aegis-cre && cre workflow simulate rwa-guardian-workflow --target local-simulation --non-interactive --trigger-index 0 --evm-tx-hash ${creModal.txHash} --evm-event-index 0 --broadcast`);
                      setTxStatus('Command copied to clipboard!');
                      setTimeout(() => setTxStatus(''), 2000);
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium"
                  >
                    Copy CRE Command
                  </button>
                  <button
                    onClick={() => setCreModal(null)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">How RWA Guardian Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-400">1. Deposit & Borrow</h3>
              <p className="text-gray-400 text-sm">
                Deposit ETH as collateral and borrow RUSD stablecoin at 130% collateralization ratio.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-yellow-400">2. AI Guardian Monitoring</h3>
              <p className="text-gray-400 text-sm">
                AI agents monitor your position health factor and reach consensus on protective actions.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-green-400">3. Automated Actions</h3>
              <p className="text-gray-400 text-sm">
                If HF &lt; 1.5: Partial liquidation. If HF &gt; 2.0: CCIP transfer to L2 for better yield.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
