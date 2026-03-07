"use client";

import { useState, useEffect } from "react";
import {
  fetchAllAgents,
  fetchAllJobs,
  createStrategyJob,
  checkACEPolicy,
  formatAddress,
  formatAmount,
  parseAmount,
  connectWallet,
  getNextJobIdFromContract,
} from "@/lib/web3";
import {
  Agent,
  StrategyJob,
  isERC8004Metadata,
} from "@/lib/constants";

// =============================================================================
// DEMO CONFIGURATION - Pre-configured for hackathon demo video
// =============================================================================
const DEMO_CONFIG = {
  // The exact prompt that triggers the successful swap
  prompt: "Swap USDC to WETH on Uniswap V3",
  // Agent IDs that are verified and will AGREE (return identical responses)
  agentIds: [1, 2],
  // Expected results for demo narration
  expectedResults: {
    targets: 2,
    confidence: "94%",
    consensus: "2/2 agents agreed",
    execution: "SUCCESS",
  },
};

// MALICIOUS AGENT DEMO - Shows slashing of dissenting agent
const MALICIOUS_DEMO_CONFIG = {
  prompt: "Swap USDC to WETH on Uniswap V3",
  agentIds: [1, 2, 5], // Agent 5 is the dissenter!
  expectedResults: {
    targets: 2,
    confidence: "94%",
    consensus: "2/3 agents agreed",
    dissenter: "Agent 5",
    execution: "SUCCESS",
    slashing: "Agent 5 SLASHED 50 LINK",
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

export default function StrategyPage() {
  const [address, setAddress] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [jobs, setJobs] = useState<StrategyJob[]>([]);
  const [nextJobId, setNextJobId] = useState<bigint>(BigInt(1)); // On-chain nextJobId
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state - V2.1 Protocol-Agnostic
  const [selectedAgents, setSelectedAgents] = useState<bigint[]>([]);
  const [userPrompt, setUserPrompt] = useState<string>("Swap 500 USDC for WETH using Uniswap V3");

  // Demo mode state
  const [demoMode, setDemoMode] = useState<"none" | "consensus" | "malicious">("none");

  // Example prompts for quick selection - DEMO prompt first
  const examplePrompts = [
    "Swap USDC to WETH on Uniswap V3", // DEMO - triggers 2-target consensus
    "Execute a cross-DEX arbitrage between Uniswap V3 and SushiSwap",
    "Provide liquidity to USDC-WETH pool on Uniswap V3",
    "Supply 1000 USDC to Aave V3 lending pool",
    "Swap 1 ETH for DAI using best route",
  ];

  // Activate consensus demo mode - pre-select agents 1 & 2
  const activateDemoMode = () => {
    setDemoMode("consensus");
    setUserPrompt(DEMO_CONFIG.prompt);
    const demoAgentIds = DEMO_CONFIG.agentIds.map(id => BigInt(id));
    setSelectedAgents(demoAgentIds);
  };

  // Activate malicious agent demo - includes agent 5 who will dissent
  const activateMaliciousDemoMode = () => {
    setDemoMode("malicious");
    setUserPrompt(MALICIOUS_DEMO_CONFIG.prompt);
    const demoAgentIds = MALICIOUS_DEMO_CONFIG.agentIds.map(id => BigInt(id));
    setSelectedAgents(demoAgentIds);
  };

  // Policy state
  const [policyCheck, setPolicyCheck] = useState<{ allowed: boolean; reason: string } | null>(null);

  // Result state
  const [result, setResult] = useState<{ txHash: string; jobId: bigint } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // CRE Command state
  const [copiedCommand, setCopiedCommand] = useState(false);

  // Last updated timestamp for live indicator
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    loadData();
    checkWalletConnection();

    // Auto-refresh agents and jobs every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkWalletConnection = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      const accounts = await window.ethereum.request({ method: "eth_accounts" }) as string[];
      if (accounts.length > 0) {
        setAddress(accounts[0]);
      }
    }
  };

  const loadData = async () => {
    try {
      // Fetch on-chain state in parallel
      const [agentsData, jobsData, contractNextJobId] = await Promise.all([
        fetchAllAgents(),
        fetchAllJobs(),
        getNextJobIdFromContract(),
      ]);
      setAgents(agentsData);
      setJobs(jobsData);
      setNextJobId(contractNextJobId);
      setLastUpdated(new Date());

      console.log(`[loadData] On-chain state: ${jobsData.length} jobs, nextJobId=${contractNextJobId}`);
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

  const handleCheckPolicy = async () => {
    if (!address) return;
    try {
      // Use a default amount for policy check (1000 tokens)
      const amountBigInt = parseAmount("1000");
      const result = await checkACEPolicy(address, amountBigInt);
      setPolicyCheck(result);
    } catch (e) {
      console.error("Error checking policy:", e);
      setPolicyCheck({ allowed: false, reason: "Policy check failed" });
    }
  };

  const handleSubmit = async () => {
    if (!address || selectedAgents.length === 0) return;

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      // Log the expected job ID before creation
      console.log(`[handleSubmit] Creating job, expecting ID: ${nextJobId}`);
      console.log(`[handleSubmit] User Prompt: "${userPrompt}"`);

      // V2.1: Pass userPrompt directly - AI agents interpret the natural language
      const result = await createStrategyJob(
        selectedAgents,
        userPrompt
      );

      console.log(`[handleSubmit] Job created successfully: ID=${result.jobId}, TX=${result.txHash}`);
      setResult(result);

      // Reload all data to sync with on-chain state
      await loadData();

    } catch (e) {
      console.error("Error creating strategy job:", e);
      const errorMessage = e instanceof Error ? e.message : "Failed to create strategy job";

      // Provide more helpful error messages
      if (errorMessage.includes("not found on-chain")) {
        setError(`${errorMessage}. Please refresh and try again.`);
      } else if (errorMessage.includes("user rejected")) {
        setError("Transaction was rejected by user.");
      } else {
        setError(errorMessage);
      }

      // Still refresh data to ensure UI is in sync
      await loadData();
    }

    setSubmitting(false);
  };

  const verifiedAgents = agents.filter((a) => a.verified);
  const completedJobs = jobs.filter((j) => j.completed);
  const pendingJobs = jobs.filter((j) => !j.completed);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading strategy data...</p>
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
                <h1 className="text-3xl font-bold text-white">Strategy Execution</h1>
                <span className="px-2 py-1 rounded bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-medium">
                  V2.1 Protocol-Agnostic
                </span>
                {demoMode === "consensus" && (
                  <span className="px-2 py-1 rounded bg-gradient-to-r from-green-600 to-emerald-600 text-white text-xs font-medium animate-pulse">
                    🎬 CONSENSUS DEMO
                  </span>
                )}
                {demoMode === "malicious" && (
                  <span className="px-2 py-1 rounded bg-gradient-to-r from-red-600 to-orange-600 text-white text-xs font-medium animate-pulse">
                    ⚠️ MALICIOUS AGENT DEMO
                  </span>
                )}
              </div>
              <p className="text-gray-400">
                Universal AI DeFi Executor - Describe your intent in natural language, AI agents execute via CRE
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                <span className="text-blue-400">Natural Language</span>
                <span>Any Protocol</span>
                <span>AI-Powered</span>
                <span className="text-green-500">MEV Protected</span>
                <span className="text-purple-400">Chainlink CRE</span>
                <span className="text-yellow-400">confidential_http</span>
              </div>
            </div>
            {/* Demo Mode Buttons */}
            <div className="flex gap-2">
              <button
                onClick={activateDemoMode}
                className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                  demoMode === "consensus"
                    ? "bg-green-600 text-white"
                    : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                }`}
              >
                <span>✓</span>
                Consensus
              </button>
              <button
                onClick={activateMaliciousDemoMode}
                className={`px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${
                  demoMode === "malicious"
                    ? "bg-red-600 text-white"
                    : "bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white"
                }`}
              >
                <span>⚠️</span>
                Malicious Agent
              </button>
            </div>
          </div>
        </div>

        {/* Consensus Demo Mode Info Banner */}
        {demoMode === "consensus" && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-600">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <h3 className="text-green-400 font-bold mb-1">Consensus Demo - All Agents Agree</h3>
                <p className="text-gray-300 text-sm mb-2">
                  Agents 1 & 2 will return <strong>identical</strong> swap strategies and reach <strong>consensus</strong>. Both get rewarded.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mt-3">
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-gray-400">Expected Targets</p>
                    <p className="text-white font-bold">{DEMO_CONFIG.expectedResults.targets} addresses</p>
                  </div>
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-gray-400">Confidence</p>
                    <p className="text-white font-bold">{DEMO_CONFIG.expectedResults.confidence}</p>
                  </div>
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-gray-400">Consensus</p>
                    <p className="text-green-400 font-bold">{DEMO_CONFIG.expectedResults.consensus}</p>
                  </div>
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-gray-400">Result</p>
                    <p className="text-green-400 font-bold">All Rewarded</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Malicious Agent Demo Mode Info Banner */}
        {demoMode === "malicious" && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-red-900/30 to-orange-900/30 border border-red-600">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-red-400 font-bold mb-1">Malicious Agent Demo - Dissenter Gets Slashed!</h3>
                <p className="text-gray-300 text-sm mb-2">
                  Agents 1 & 2 agree on 500 USDC swap. <strong className="text-red-400">Agent 5</strong> returns 1000 USDC (different calldata) - will be <strong className="text-red-400">SLASHED</strong>!
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs mt-3">
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-gray-400">Consensus</p>
                    <p className="text-yellow-400 font-bold">{MALICIOUS_DEMO_CONFIG.expectedResults.consensus}</p>
                  </div>
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-gray-400">Dissenter</p>
                    <p className="text-red-400 font-bold">{MALICIOUS_DEMO_CONFIG.expectedResults.dissenter}</p>
                  </div>
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-gray-400">Execution</p>
                    <p className="text-green-400 font-bold">{MALICIOUS_DEMO_CONFIG.expectedResults.execution}</p>
                  </div>
                  <div className="bg-black/30 rounded p-2">
                    <p className="text-gray-400">Agents 1 & 2</p>
                    <p className="text-green-400 font-bold">REWARDED</p>
                  </div>
                  <div className="bg-black/30 rounded p-2 border border-red-600">
                    <p className="text-gray-400">Agent 5</p>
                    <p className="text-red-400 font-bold">{MALICIOUS_DEMO_CONFIG.expectedResults.slashing}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">On-Chain Jobs</p>
            <p className="text-2xl font-bold text-white">{jobs.length}</p>
            <p className="text-xs text-gray-500 mt-1">nextJobId: {nextJobId.toString()}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Completed</p>
            <p className="text-2xl font-bold text-green-400">{completedJobs.length}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Pending CRE</p>
            <p className="text-2xl font-bold text-yellow-400">{pendingJobs.length}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Verified Agents</p>
            <p className="text-2xl font-bold text-blue-400">{verifiedAgents.length}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-blue-900 bg-blue-900/20">
            <p className="text-blue-400 text-sm">Next Job ID</p>
            <p className="text-2xl font-bold text-blue-300">{nextJobId.toString()}</p>
            <p className="text-xs text-blue-500 mt-1">Will be assigned on create</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Create Job Form */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-6">Create Strategy Job</h2>

            {!address ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">Connect your wallet to create strategy jobs</p>
                <button
                  onClick={handleConnect}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
                >
                  Connect Wallet
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* V2.1 Protocol-Agnostic Natural Language Prompt */}
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    Strategy Prompt (Natural Language)
                  </label>
                  <p className="text-gray-500 text-xs mb-3">
                    Describe what you want to do in plain English. AI agents will interpret and execute.
                  </p>
                  <textarea
                    value={userPrompt}
                    onChange={(e) => setUserPrompt(e.target.value)}
                    rows={3}
                    className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
                    placeholder="e.g., Swap 500 USDC for WETH using Uniswap V3"
                  />
                  <div className="mt-3">
                    <p className="text-gray-400 text-xs mb-2">Quick examples:</p>
                    <div className="flex flex-wrap gap-2">
                      {examplePrompts.map((prompt, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setUserPrompt(prompt);
                            // If clicking demo prompt, activate demo mode
                            if (prompt === DEMO_CONFIG.prompt) {
                              activateDemoMode();
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs transition ${
                            userPrompt === prompt
                              ? "bg-blue-600 text-white"
                              : idx === 0 // First prompt is the DEMO prompt
                                ? "bg-gradient-to-r from-yellow-600/50 to-orange-600/50 text-yellow-300 hover:from-yellow-600 hover:to-orange-600 border border-yellow-500/50"
                                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          }`}
                        >
                          {idx === 0 && <span className="mr-1">🎬</span>}
                          {prompt.length > 40 ? prompt.substring(0, 40) + "..." : prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-800/50">
                    <p className="text-blue-300 text-xs">
                      <span className="font-medium">Protocol-Agnostic:</span> AI agents analyze your intent, research the best protocols, and generate execution calldata automatically.
                    </p>
                  </div>
                </div>

                {/* Agent Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-gray-300 text-sm font-medium">
                      Select Verified Agents
                    </label>
                    {/* Live indicator */}
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-gray-400 text-xs">Live</span>
                      {lastUpdated && (
                        <span className="text-gray-500 text-xs">
                          {lastUpdated.toLocaleTimeString()}
                        </span>
                      )}
                      <button
                        onClick={loadData}
                        className="p-1 hover:bg-gray-700 rounded transition-colors"
                        title="Refresh now"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-500 text-xs mb-3">
                    Only World ID verified agents can participate in strategy execution
                  </p>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                    {verifiedAgents.length === 0 ? (
                      <p className="text-gray-500 text-sm">No verified agents available</p>
                    ) : (
                      verifiedAgents.map((agent) => (
                        <button
                          key={agent.agentId.toString()}
                          onClick={() => toggleAgentSelection(agent.agentId)}
                          className={`flex items-center justify-between p-3 rounded-lg border transition ${
                            selectedAgents.includes(agent.agentId)
                              ? "bg-blue-900/50 border-blue-500"
                              : "bg-gray-700/50 border-gray-600 hover:border-gray-500"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                              {agent.agentId.toString()}
                            </div>
                            <div className="text-left">
                              <p className="text-white text-sm font-medium">
                                {agent.metadata && isERC8004Metadata(agent.metadata)
                                  ? agent.metadata.name
                                  : `Agent #${agent.agentId}`}
                              </p>
                              <p className="text-gray-400 text-xs">
                                Rep: {agent.reputation.toString()} | {agent.creEndpoint ? "CRE Ready" : "No Endpoint"}
                              </p>
                            </div>
                          </div>
                          {selectedAgents.includes(agent.agentId) && (
                            <span className="text-blue-400">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* ACE Policy Check */}
                <div>
                  <button
                    onClick={handleCheckPolicy}
                    className="text-sm text-blue-400 hover:text-blue-300 transition"
                  >
                    Check ACE Policy Compliance
                  </button>
                  {policyCheck && (
                    <div className={`mt-2 p-3 rounded-lg ${policyCheck.allowed ? "bg-green-900/30 border border-green-700" : "bg-red-900/30 border border-red-700"}`}>
                      <p className={policyCheck.allowed ? "text-green-400" : "text-red-400"}>
                        {policyCheck.allowed ? "Policy Check Passed" : `Policy Violation: ${policyCheck.reason}`}
                      </p>
                    </div>
                  )}
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
                      <p className="text-green-400 font-medium mb-2">✅ Strategy Job Created On-Chain!</p>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-300 text-sm">Job ID:</span>
                        <span className="text-white font-bold text-lg">{result.jobId.toString()}</span>
                        <span className="text-green-500 text-xs bg-green-900/50 px-2 py-0.5 rounded">Confirmed</span>
                      </div>
                      <p className="text-gray-400 text-xs mt-1 break-all">TX: {result.txHash}</p>
                      <p className="text-gray-500 text-xs mt-2">
                        This job is now registered on the StrategyVaultV2 contract and ready for CRE execution.
                      </p>
                    </div>

                    {/* CRE Command Box - Enhanced for Demo */}
                    <div className={`p-4 rounded-lg border ${demoMode !== "none" ? "bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-blue-500" : "bg-gray-900 border-blue-600"}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🔗</span>
                          <p className="text-blue-400 font-bold">CRE Workflow Command</p>
                          {demoMode !== "none" && (
                            <span className={`px-2 py-0.5 rounded text-white text-xs ${demoMode === "malicious" ? "bg-red-600" : "bg-green-600"}`}>
                              {demoMode === "malicious" ? "Slashing Demo" : "Ready for Demo"}
                            </span>
                          )}
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
                              : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                          }`}
                        >
                          {copiedCommand ? "✓ Copied!" : "📋 Copy Full Command"}
                        </button>
                      </div>
                      <div className="bg-black rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto border border-gray-700">
                        <code className="whitespace-pre-wrap break-all">{generateFullCRECommand(result.txHash)}</code>
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-xs">
                        <p className="text-gray-400">
                          <span className="text-yellow-400">⚡</span> Run in terminal to execute CRE council workflow
                        </p>
                        {demoMode !== "none" && (
                          <p className={demoMode === "malicious" ? "text-red-400" : "text-green-400"}>
                            <span>{demoMode === "malicious" ? "⚠️" : "✓"}</span> {demoMode === "malicious" ? "Agent 5 will be SLASHED" : "confidential_http enabled"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={submitting || selectedAgents.length === 0}
                  className={`w-full py-3 rounded-lg font-medium transition ${
                    submitting || selectedAgents.length === 0
                      ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  }`}
                >
                  {submitting ? "Creating Job..." : "Create Strategy Job"}
                </button>
              </div>
            )}
          </div>

          {/* Jobs List */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-6">Recent Jobs</h2>

            {jobs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No strategy jobs yet</p>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                {jobs.slice().reverse().map((job) => (
                  <div
                    key={job.jobId.toString()}
                    className="bg-gray-700/50 rounded-lg p-4 border border-gray-600"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">Job #{job.jobId.toString()}</span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          job.completed
                            ? job.approved
                              ? "bg-green-900/50 text-green-400"
                              : "bg-red-900/50 text-red-400"
                            : "bg-yellow-900/50 text-yellow-400"
                        }`}
                      >
                        {job.completed ? (job.approved ? "Approved" : "Rejected") : "Pending"}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <p>Strategy: {job.strategyName}</p>
                      <p>Amount: {formatAmount(job.amount)} tokens</p>
                      <p>Agents: [{job.agentIds.map(id => id.toString()).join(", ")}]</p>
                      <p>Proposer: {formatAddress(job.proposer)}</p>
                      {job.completed && (
                        <p className={job.pnlDelta >= BigInt(0) ? "text-green-400" : "text-red-400"}>
                          PnL: {job.pnlDelta >= BigInt(0) ? "+" : ""}{formatAmount(job.pnlDelta)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* How It Works - V2.1 Protocol-Agnostic */}
        <div className="mt-8 bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold text-white">How Protocol-Agnostic AI Executor Works</h2>
            <span className="px-2 py-0.5 rounded bg-green-900/50 text-green-400 text-xs">V2.1</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold text-sm">1</span>
              </div>
              <p className="text-gray-300 text-xs">User submits natural language prompt</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold text-sm">2</span>
              </div>
              <p className="text-gray-300 text-xs">CRE extracts userPrompt from event</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold text-sm">3</span>
              </div>
              <p className="text-gray-300 text-xs">AI agents interpret + research protocols</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold text-sm">4</span>
              </div>
              <p className="text-gray-300 text-xs">Agents generate calldata consensus</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-yellow-600 flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold text-sm">5</span>
              </div>
              <p className="text-gray-300 text-xs">CRE delivers to StrategyVault</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center mx-auto mb-2">
                <span className="text-white font-bold text-sm">6</span>
              </div>
              <p className="text-gray-300 text-xs">Atomic DeFi execution + feedback</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-gray-400">Natural Language</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-gray-400">Any Protocol</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <span className="text-gray-400">MEV Protected</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              <span className="text-gray-400">On-chain Intent</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
