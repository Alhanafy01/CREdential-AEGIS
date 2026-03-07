"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  fetchAllAgents,
  formatAddress,
  createStrategyJob,
  connectWallet,
  getTenderlySigner,
  getProvider,
} from "@/lib/web3";
import {
  Agent,
  isERC8004Metadata,
  FLIGHT_INSURANCE_ADDRESS,
  FLIGHT_INSURANCE_ABI,
  USDC_ADDRESS,
  ERC20_ABI,
  TENDERLY_RPC,
} from "@/lib/constants";

// =============================================================================
// INSURANCE DEMO CONFIGURATION
// =============================================================================
const INSURANCE_DEMO_CONFIG = {
  prompt: "Process insurance claim for Flight UA456 Policy #",
  agentIds: [7, 8, 9],
  expectedResults: {
    consensus: "3/3 agents agreed",
    execution: "SUCCESS",
    payout: "Claim processed via CRE",
  },
};

// Full CRE command with cd for easy copy
const generateFullCRECommand = (txHash: string) => {
  return `cd /xdata/chainlinkhackathone/aegis-cre && cre workflow simulate ./council-workflow --target local-simulation --evm-tx-hash ${txHash} --non-interactive --trigger-index 0 --evm-event-index 0 --broadcast`;
};

// Copy to clipboard helper
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

interface Policy {
  id: number;
  user: string;
  flightNumber: string;
  payoutAmount: bigint;
  premium: bigint;
  purchaseTime: number;
  active: boolean;
}

interface InsuranceStats {
  totalPolicies: bigint;
  totalPremiums: bigint;
  totalPayouts: bigint;
  balance: bigint;
}

export default function InsurancePage() {
  const [address, setAddress] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [stats, setStats] = useState<InsuranceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [buyingPolicy, setBuyingPolicy] = useState(false);

  // Form state
  const [selectedAgents, setSelectedAgents] = useState<bigint[]>(
    INSURANCE_DEMO_CONFIG.agentIds.map((id) => BigInt(id))
  );
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | null>(null);
  const [flightNumber, setFlightNumber] = useState("UA456");
  const [payoutAmount, setPayoutAmount] = useState("500");

  // Result state
  const [result, setResult] = useState<{ txHash: string; jobId: bigint } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(BigInt(0));

  useEffect(() => {
    loadData();
    checkWalletConnection();

    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      const accounts = (await window.ethereum.request({
        method: "eth_accounts",
      })) as string[];
      if (accounts.length > 0) {
        setAddress(accounts[0]);
        await loadUSDCBalance(accounts[0]);
      }
    }
  };

  const loadUSDCBalance = async (addr: string) => {
    try {
      const provider = getProvider();
      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);
      const balance = await usdc.balanceOf(addr);
      setUsdcBalance(balance);
    } catch (e) {
      console.error("Error loading USDC balance:", e);
    }
  };

  const loadData = async () => {
    try {
      const [agentsData] = await Promise.all([fetchAllAgents()]);
      setAgents(agentsData);

      // Load insurance data
      const provider = new ethers.JsonRpcProvider(TENDERLY_RPC);
      const insurance = new ethers.Contract(
        FLIGHT_INSURANCE_ADDRESS,
        FLIGHT_INSURANCE_ABI,
        provider
      );

      // Load stats
      const statsData = await insurance.getStats();
      setStats({
        totalPolicies: statsData[0],
        totalPremiums: statsData[1],
        totalPayouts: statsData[2],
        balance: statsData[3],
      });

      // Load policies
      const policyCount = await insurance.policyCount();
      const loadedPolicies: Policy[] = [];
      for (let i = 1; i <= Number(policyCount); i++) {
        const policy = await insurance.getPolicy(i);
        loadedPolicies.push({
          id: i,
          user: policy[0],
          flightNumber: policy[1],
          payoutAmount: policy[2],
          premium: policy[3],
          purchaseTime: Number(policy[4]),
          active: policy[5],
        });
      }
      setPolicies(loadedPolicies);
      setLastUpdated(new Date());

      // Reload USDC balance if connected
      if (address) {
        await loadUSDCBalance(address);
      }
    } catch (e) {
      console.error("Error loading data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      const addr = await connectWallet();
      setAddress(addr);
      await loadUSDCBalance(addr);
    } catch (e) {
      console.error("Error connecting wallet:", e);
    }
  };

  const toggleAgentSelection = (agentId: bigint) => {
    setSelectedAgents((prev) => {
      if (prev.includes(agentId)) {
        return prev.filter((id) => id !== agentId);
      } else {
        return [...prev, agentId];
      }
    });
  };

  // Buy policy using TenderlySigner - same approach as Register page
  const handleBuyPolicy = async () => {
    if (!address) {
      setError("Please connect your wallet first");
      return;
    }

    setBuyingPolicy(true);
    setError(null);

    try {
      // Use getTenderlySigner - same as Register page
      const signer = await getTenderlySigner();
      const insurance = new ethers.Contract(
        FLIGHT_INSURANCE_ADDRESS,
        FLIGHT_INSURANCE_ABI,
        signer
      );

      const payoutAmountWei = ethers.parseUnits(payoutAmount, 6);
      const premiumAmount = payoutAmountWei / BigInt(10); // 10% premium

      // Check and approve USDC if needed
      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
      const allowance = await usdc.allowance(address, FLIGHT_INSURANCE_ADDRESS);

      if (allowance < premiumAmount) {
        console.log("Approving USDC...");
        const approveTx = await usdc.approve(
          FLIGHT_INSURANCE_ADDRESS,
          ethers.MaxUint256 // Approve unlimited for convenience
        );
        await approveTx.wait();
        console.log("USDC approved");
      }

      // Buy policy
      console.log("Buying policy...");
      console.log("Flight:", flightNumber);
      console.log("Payout:", payoutAmount, "USDC");

      const buyTx = await insurance.buyPolicy(flightNumber, payoutAmountWei);
      console.log("TX Hash:", buyTx.hash);

      await buyTx.wait();
      console.log("Policy purchased successfully!");

      // Reload data
      await loadData();
    } catch (e) {
      console.error("Error buying policy:", e);
      const errorMessage = e instanceof Error ? e.message : "Failed to buy policy";
      setError(errorMessage);
    }

    setBuyingPolicy(false);
  };

  // Create claim job using the existing createStrategyJob function
  const handleCreateClaimJob = async () => {
    if (!address || selectedAgents.length === 0 || !selectedPolicyId) return;

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const userPrompt = `${INSURANCE_DEMO_CONFIG.prompt}${selectedPolicyId}`;
      console.log(`Creating insurance claim job...`);
      console.log(`User Prompt: "${userPrompt}"`);
      console.log(`Agents: [${selectedAgents.map(a => a.toString()).join(", ")}]`);

      // Use the existing createStrategyJob function from web3.ts
      const jobResult = await createStrategyJob(selectedAgents, userPrompt);

      console.log(`Job created: ID=${jobResult.jobId}, TX=${jobResult.txHash}`);
      setResult(jobResult);
      await loadData();
    } catch (e) {
      console.error("Error creating claim job:", e);
      const errorMessage = e instanceof Error ? e.message : "Failed to create claim job";
      setError(errorMessage);
      await loadData();
    }

    setSubmitting(false);
  };

  const insuranceAgents = agents.filter((a) =>
    INSURANCE_DEMO_CONFIG.agentIds.includes(Number(a.agentId))
  );
  const activePolicies = policies.filter((p) => p.active);
  const processedPolicies = policies.filter((p) => !p.active);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading insurance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">
                  Flight Insurance
                </h1>
                <span className="px-2 py-1 rounded bg-gradient-to-r from-orange-600 to-red-600 text-white text-xs font-medium">
                  CRE Demo
                </span>
              </div>
              <p className="text-gray-400">
                Buy flight insurance policies and process claims via AI agent
                consensus
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="text-orange-400">Agents 7, 8, 9</span>
                <span>AI Claim Processing</span>
                <span className="text-green-500">CRE Execution</span>
                <span className="text-purple-400">Tenderly RPC</span>
              </div>
            </div>
            <div className="text-right">
              {address ? (
                <>
                  <p className="text-gray-400 text-sm">Connected Wallet</p>
                  <p className="text-white font-mono text-sm">{formatAddress(address)}</p>
                  <p className="text-green-400 font-bold">
                    {ethers.formatUnits(usdcBalance, 6)} USDC
                  </p>
                </>
              ) : (
                <button
                  onClick={handleConnect}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Total Policies</p>
            <p className="text-2xl font-bold text-white">
              {stats?.totalPolicies.toString() || "0"}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Active</p>
            <p className="text-2xl font-bold text-green-400">
              {activePolicies.length}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Processed</p>
            <p className="text-2xl font-bold text-blue-400">
              {processedPolicies.length}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Total Premiums</p>
            <p className="text-2xl font-bold text-yellow-400">
              {stats ? ethers.formatUnits(stats.totalPremiums, 6) : "0"} USDC
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-orange-900 bg-orange-900/20">
            <p className="text-orange-400 text-sm">Contract Balance</p>
            <p className="text-2xl font-bold text-orange-300">
              {stats ? ethers.formatUnits(stats.balance, 6) : "0"} USDC
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Buy Policy / Create Claim Form */}
          <div className="space-y-6">
            {/* Buy Policy */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-6">
                Buy Insurance Policy
              </h2>

              {!address ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">
                    Connect your wallet to buy policies
                  </p>
                  <button
                    onClick={handleConnect}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Flight Number
                    </label>
                    <input
                      type="text"
                      value={flightNumber}
                      onChange={(e) => setFlightNumber(e.target.value)}
                      className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-blue-500 focus:outline-none"
                      placeholder="e.g., UA456"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Payout Amount (USDC)
                    </label>
                    <input
                      type="number"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-blue-500 focus:outline-none"
                      placeholder="500"
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      Premium: {(Number(payoutAmount) * 0.1).toFixed(2)} USDC
                      (10%)
                    </p>
                  </div>
                  <button
                    onClick={handleBuyPolicy}
                    disabled={buyingPolicy}
                    className={`w-full py-3 rounded-lg font-medium transition ${
                      buyingPolicy
                        ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
                    }`}
                  >
                    {buyingPolicy ? "Buying Policy..." : "Buy Policy"}
                  </button>
                </div>
              )}
            </div>

            {/* Process Claim */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-bold text-white mb-6">
                Process Insurance Claim
              </h2>

              {!address ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">
                    Connect your wallet to process claims
                  </p>
                  <button
                    onClick={handleConnect}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Select Policy */}
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Select Active Policy
                    </label>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {activePolicies.length === 0 ? (
                        <p className="text-gray-500 text-sm">
                          No active policies available - buy one first!
                        </p>
                      ) : (
                        activePolicies.map((policy) => (
                          <button
                            key={policy.id}
                            onClick={() => setSelectedPolicyId(policy.id)}
                            className={`flex items-center justify-between p-3 rounded-lg border transition ${
                              selectedPolicyId === policy.id
                                ? "bg-orange-900/50 border-orange-500"
                                : "bg-gray-700/50 border-gray-600 hover:border-gray-500"
                            }`}
                          >
                            <div className="text-left">
                              <p className="text-white text-sm font-medium">
                                Policy #{policy.id} - {policy.flightNumber}
                              </p>
                              <p className="text-gray-400 text-xs">
                                Payout:{" "}
                                {ethers.formatUnits(policy.payoutAmount, 6)}{" "}
                                USDC
                              </p>
                            </div>
                            {selectedPolicyId === policy.id && (
                              <span className="text-orange-400">
                                <svg
                                  className="w-5 h-5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Agent Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-gray-300 text-sm font-medium">
                        Insurance Agents (7, 8, 9)
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-gray-400 text-xs">Live</span>
                        {lastUpdated && (
                          <span className="text-gray-500 text-xs">
                            {lastUpdated.toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {insuranceAgents.map((agent) => (
                        <button
                          key={agent.agentId.toString()}
                          onClick={() => toggleAgentSelection(agent.agentId)}
                          className={`flex items-center justify-between p-3 rounded-lg border transition ${
                            selectedAgents.includes(agent.agentId)
                              ? "bg-orange-900/50 border-orange-500"
                              : "bg-gray-700/50 border-gray-600 hover:border-gray-500"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-sm font-bold">
                              {agent.agentId.toString()}
                            </div>
                            <div className="text-left">
                              <p className="text-white text-sm font-medium">
                                {agent.metadata && isERC8004Metadata(agent.metadata)
                                  ? agent.metadata.name
                                  : `Agent #${agent.agentId}`}
                              </p>
                              <p className="text-gray-400 text-xs">
                                Rep: {agent.reputation.toString()} |{" "}
                                {agent.creEndpoint ? "CRE Ready" : "No Endpoint"}
                              </p>
                            </div>
                          </div>
                          {selectedAgents.includes(agent.agentId) && (
                            <span className="text-orange-400">
                              <svg
                                className="w-5 h-5"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="p-3 rounded-lg bg-red-900/30 border border-red-700">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Success */}
                  {result && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-green-900/30 border border-green-700">
                        <p className="text-green-400 font-medium mb-2">
                          Insurance Claim Job Created!
                        </p>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-300 text-sm">Job ID:</span>
                          <span className="text-white font-bold text-lg">
                            {result.jobId.toString()}
                          </span>
                          <span className="text-green-500 text-xs bg-green-900/50 px-2 py-0.5 rounded">
                            Confirmed
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs mt-1 break-all">
                          TX: {result.txHash}
                        </p>
                      </div>

                      {/* CRE Command Box */}
                      <div className="p-4 rounded-lg bg-gradient-to-r from-orange-900/50 to-red-900/50 border border-orange-500">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🔗</span>
                            <p className="text-orange-400 font-bold">
                              CRE Workflow Command
                            </p>
                          </div>
                          <button
                            onClick={async () => {
                              const cmd = generateFullCRECommand(result.txHash);
                              const success = await copyToClipboard(cmd);
                              if (success) {
                                setCopiedCommand(true);
                                setTimeout(() => setCopiedCommand(false), 2000);
                              }
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                              copiedCommand
                                ? "bg-green-600 text-white"
                                : "bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
                            }`}
                          >
                            {copiedCommand ? "Copied!" : "Copy Command"}
                          </button>
                        </div>
                        <div className="bg-black rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto border border-gray-700">
                          <code className="whitespace-pre-wrap break-all">
                            {generateFullCRECommand(result.txHash)}
                          </code>
                        </div>
                        <p className="text-gray-400 text-xs mt-3">
                          <span className="text-yellow-400">Run</span> in
                          terminal to process claim via CRE council workflow
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    onClick={handleCreateClaimJob}
                    disabled={
                      submitting ||
                      selectedAgents.length === 0 ||
                      !selectedPolicyId
                    }
                    className={`w-full py-3 rounded-lg font-medium transition ${
                      submitting ||
                      selectedAgents.length === 0 ||
                      !selectedPolicyId
                        ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
                    }`}
                  >
                    {submitting
                      ? "Creating Claim Job..."
                      : "Create Insurance Claim Job"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Policies List */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-6">All Policies</h2>

            {policies.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No policies yet. Buy one to get started!
              </p>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {policies
                  .slice()
                  .reverse()
                  .map((policy) => (
                    <div
                      key={policy.id}
                      className={`bg-gray-700/50 rounded-lg p-4 border ${
                        policy.active
                          ? "border-green-600"
                          : "border-gray-600 opacity-75"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium">
                          Policy #{policy.id}
                        </span>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            policy.active
                              ? "bg-green-900/50 text-green-400"
                              : "bg-gray-600 text-gray-400"
                          }`}
                        >
                          {policy.active ? "Active" : "Processed"}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 space-y-1">
                        <p>Flight: {policy.flightNumber}</p>
                        <p>
                          Payout:{" "}
                          {ethers.formatUnits(policy.payoutAmount, 6)} USDC
                        </p>
                        <p>
                          Premium: {ethers.formatUnits(policy.premium, 6)} USDC
                        </p>
                        <p>
                          Purchased:{" "}
                          {new Date(
                            policy.purchaseTime * 1000
                          ).toLocaleString()}
                        </p>
                        <p>User: {formatAddress(policy.user)}</p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* How It Works */}
        <div className="mt-8 bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4">
            How Insurance Claims Work
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold text-sm">1</span>
              </div>
              <p className="text-gray-300 text-xs">User buys policy with USDC</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold text-sm">2</span>
              </div>
              <p className="text-gray-300 text-xs">
                User files claim via CRE job
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold text-sm">3</span>
              </div>
              <p className="text-gray-300 text-xs">
                AI agents 7, 8, 9 reach consensus
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold text-sm">4</span>
              </div>
              <p className="text-gray-300 text-xs">
                CRE executes processPayout()
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold text-sm">5</span>
              </div>
              <p className="text-gray-300 text-xs">User receives USDC payout</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
