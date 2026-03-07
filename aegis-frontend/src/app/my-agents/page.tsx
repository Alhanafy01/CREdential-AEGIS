"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import {
  REGISTRY_ADDRESS,
  REGISTRY_ABI,
  TENDERLY_RPC,
  LINK_TOKEN_ADDRESS,
  ERC20_ABI,
  Agent,
  AgentMetadata,
  isERC8004Metadata,
} from "@/lib/constants";
import { connectWallet, getTenderlySigner } from "@/lib/web3";

export default function MyAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [linkBalance, setLinkBalance] = useState<string>("0");

  // Action states
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [stakeAmounts, setStakeAmounts] = useState<{ [key: string]: string }>({});
  const [unstakeAmounts, setUnstakeAmounts] = useState<{ [key: string]: string }>({});
  const [txStatus, setTxStatus] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const fetchMetadata = async (uri: string): Promise<AgentMetadata | null> => {
    try {
      if (uri.startsWith("data:")) {
        const json = uri.replace("data:application/json,", "");
        return JSON.parse(decodeURIComponent(json));
      }
      if (uri.startsWith("ipfs://")) {
        const cid = uri.replace("ipfs://", "");
        const response = await fetch(`https://ipfs.io/ipfs/${cid}`);
        return response.json();
      }
      if (uri.startsWith("http://") || uri.startsWith("https://")) {
        const response = await fetch(uri);
        if (response.ok) return response.json();
      }
    } catch (e) {
      console.warn("Failed to fetch metadata:", e);
    }
    return null;
  };

  const loadMyAgents = useCallback(async (address: string) => {
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(TENDERLY_RPC);
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
      const linkToken = new ethers.Contract(LINK_TOKEN_ADDRESS, ERC20_ABI, provider);

      // Get LINK balance
      const balance = await linkToken.balanceOf(address);
      setLinkBalance(ethers.formatEther(balance));

      // Fetch all agents
      const nextId = await registry.nextAgentId();
      const myAgents: Agent[] = [];

      for (let i = 1; i < Number(nextId); i++) {
        try {
          const agent = await registry.getAgent(i);
          if (agent.owner.toLowerCase() === address.toLowerCase()) {
            const agentData: Agent = {
              agentId: agent.agentId,
              agentAddress: agent.agentAddress,
              owner: agent.owner,
              humanIdHash: agent.humanIdHash,
              verified: agent.verified,
              stake: agent.stake,
              reputation: agent.reputation,
              metadataURI: agent.metadataURI,
            };

            // Fetch metadata
            const metadata = await fetchMetadata(agent.metadataURI);
            if (metadata) {
              agentData.metadata = metadata;
              if (isERC8004Metadata(metadata)) {
                const creService = metadata.services.find((s) => s.name === "cre-agent");
                if (creService) agentData.creEndpoint = creService.endpoint;
              }
            }

            myAgents.push(agentData);
          }
        } catch (e) {
          console.error(`Error fetching agent ${i}:`, e);
        }
      }

      setAgents(myAgents);
      setLastSync(new Date());
    } catch (e) {
      console.error("Error loading agents:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkWalletAndLoad = useCallback(async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" }) as string[];
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          loadMyAgents(accounts[0]);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [loadMyAgents]);

  useEffect(() => {
    checkWalletAndLoad();
  }, [checkWalletAndLoad]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const addr = await connectWallet();
      setWalletAddress(addr);
      loadMyAgents(addr);
    } catch (e) {
      console.error(e);
    } finally {
      setConnecting(false);
    }
  };

  // STAKE LINK
  const handleStake = async (agentId: bigint) => {
    const amount = stakeAmounts[agentId.toString()];
    if (!amount || parseFloat(amount) <= 0) {
      setTxStatus({ message: "Enter a valid stake amount", type: "error" });
      return;
    }

    setActionLoading({ ...actionLoading, [`stake-${agentId}`]: true });
    setTxStatus({ message: "Approving LINK...", type: "info" });

    try {
      const signer = await getTenderlySigner();
      const linkToken = new ethers.Contract(LINK_TOKEN_ADDRESS, ERC20_ABI, signer);
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
      const amountWei = ethers.parseEther(amount);

      // Approve LINK
      const approveTx = await linkToken.approve(REGISTRY_ADDRESS, amountWei);
      await approveTx.wait();

      setTxStatus({ message: "Staking LINK...", type: "info" });

      // Stake
      const stakeTx = await registry.stake(agentId, amountWei);
      await stakeTx.wait();

      setTxStatus({ message: `Successfully staked ${amount} LINK!`, type: "success" });
      setStakeAmounts({ ...stakeAmounts, [agentId.toString()]: "" });
      loadMyAgents(walletAddress);
    } catch (e: unknown) {
      console.error(e);
      setTxStatus({ message: `Stake failed: ${(e as Error).message}`, type: "error" });
    } finally {
      setActionLoading({ ...actionLoading, [`stake-${agentId}`]: false });
    }
  };

  // UNSTAKE LINK
  const handleUnstake = async (agentId: bigint) => {
    const amount = unstakeAmounts[agentId.toString()];
    if (!amount || parseFloat(amount) <= 0) {
      setTxStatus({ message: "Enter a valid unstake amount", type: "error" });
      return;
    }

    setActionLoading({ ...actionLoading, [`unstake-${agentId}`]: true });
    setTxStatus({ message: "Unstaking LINK...", type: "info" });

    try {
      const signer = await getTenderlySigner();
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
      const amountWei = ethers.parseEther(amount);

      const tx = await registry.unstake(agentId, amountWei);
      await tx.wait();

      setTxStatus({ message: `Successfully unstaked ${amount} LINK!`, type: "success" });
      setUnstakeAmounts({ ...unstakeAmounts, [agentId.toString()]: "" });
      loadMyAgents(walletAddress);
    } catch (e: unknown) {
      console.error(e);
      setTxStatus({ message: `Unstake failed: ${(e as Error).message}`, type: "error" });
    } finally {
      setActionLoading({ ...actionLoading, [`unstake-${agentId}`]: false });
    }
  };

  const formatStake = (stake: bigint) => {
    return parseFloat(ethers.formatEther(stake)).toFixed(4);
  };

  const formatReputation = (rep: bigint) => {
    const num = Number(rep);
    return num >= 0 ? `+${num}` : num.toString();
  };

  const getReputationColor = (rep: bigint) => {
    const num = Number(rep);
    if (num >= 50) return "text-green-400";
    if (num >= 0) return "text-blue-400";
    if (num >= -25) return "text-yellow-400";
    return "text-red-400";
  };

  const getAgentName = (agent: Agent) => {
    if (agent.metadata) {
      if (isERC8004Metadata(agent.metadata)) return agent.metadata.name;
      return (agent.metadata as { name?: string }).name || `Agent #${agent.agentId}`;
    }
    return `Agent #${agent.agentId}`;
  };

  // Not connected state
  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-8">Connect your wallet to view and manage your registered agents.</p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-8 py-3 rounded-lg font-medium transition-colors"
          >
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Agents</h1>
              <p className="text-gray-400 mt-2">Manage your registered AI agents</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">
                LINK Balance: <span className="text-blue-400 font-bold">{parseFloat(linkBalance).toFixed(2)} LINK</span>
              </div>
              {lastSync && (
                <div className="text-xs text-gray-500 mt-1">Last synced: {lastSync.toLocaleTimeString()}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Message */}
      {txStatus && (
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4`}>
          <div className={`p-4 rounded-lg ${
            txStatus.type === "success" ? "bg-green-900/30 border border-green-700 text-green-400" :
            txStatus.type === "error" ? "bg-red-900/30 border border-red-700 text-red-400" :
            "bg-blue-900/30 border border-blue-700 text-blue-400"
          }`}>
            {txStatus.message}
            <button onClick={() => setTxStatus(null)} className="float-right text-gray-400 hover:text-white">x</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <div className="text-2xl font-bold text-white">{agents.length}</div>
            <div className="text-xs text-gray-400">My Agents</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-green-700/50">
            <div className="text-2xl font-bold text-green-400">{agents.filter(a => a.verified).length}</div>
            <div className="text-xs text-gray-400">Verified</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-blue-700/50">
            <div className="text-2xl font-bold text-blue-400">
              {formatStake(agents.reduce((sum, a) => sum + a.stake, BigInt(0)))} LINK
            </div>
            <div className="text-xs text-gray-400">Total Staked</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4 border border-purple-700/50">
            <div className="text-2xl font-bold text-purple-400">
              {agents.reduce((sum, a) => sum + Number(a.reputation), 0)}
            </div>
            <div className="text-xs text-gray-400">Total Reputation</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center mb-6">
          <Link
            href="/register"
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Register New Agent
          </Link>
          <button
            onClick={() => loadMyAgents(walletAddress)}
            disabled={loading}
            className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? "Syncing..." : "Refresh"}
          </button>
        </div>

        {/* Loading */}
        {loading && agents.length === 0 && (
          <div className="text-center py-20">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading your agents...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && agents.length === 0 && (
          <div className="text-center py-20 bg-gray-900/50 rounded-xl border border-gray-800">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No Agents Yet</h3>
            <p className="text-gray-500 mb-6">You haven&apos;t registered any AI agents yet.</p>
            <Link
              href="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-block"
            >
              Register Your First Agent
            </Link>
          </div>
        )}

        {/* Agent Cards with Full Controls */}
        <div className="space-y-6">
          {agents.map((agent) => (
            <div
              key={agent.agentId.toString()}
              className={`bg-gray-800/50 border rounded-xl p-6 ${
                agent.verified ? "border-green-700/50" : "border-gray-700"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                {/* Agent Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${
                      agent.verified ? "bg-green-500/20 text-green-400" : "bg-gray-700 text-gray-400"
                    }`}>
                      {getAgentName(agent).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">{getAgentName(agent)}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">ID: {agent.agentId.toString()}</span>
                        {agent.verified ? (
                          <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">Verified</span>
                        ) : (
                          <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full">Pending</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Reputation</div>
                      <div className={`text-lg font-bold ${getReputationColor(agent.reputation)}`}>
                        {formatReputation(agent.reputation)}
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Staked</div>
                      <div className="text-lg font-bold text-blue-400">{formatStake(agent.stake)} LINK</div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Human ID</div>
                      <div className="text-sm font-mono text-gray-400 truncate">
                        {agent.humanIdHash.slice(0, 10)}...
                      </div>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500">Agent Address</div>
                      <div className="text-sm font-mono text-gray-400 truncate">
                        {agent.agentAddress.slice(0, 10)}...
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Panel */}
                <div className="lg:w-80 space-y-4">
                  {/* Stake LINK */}
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Stake LINK</h4>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={stakeAmounts[agent.agentId.toString()] || ""}
                        onChange={(e) => setStakeAmounts({ ...stakeAmounts, [agent.agentId.toString()]: e.target.value })}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleStake(agent.agentId)}
                        disabled={actionLoading[`stake-${agent.agentId}`]}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        {actionLoading[`stake-${agent.agentId}`] ? "..." : "Stake"}
                      </button>
                    </div>
                  </div>

                  {/* Unstake LINK */}
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Unstake LINK</h4>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={unstakeAmounts[agent.agentId.toString()] || ""}
                        onChange={(e) => setUnstakeAmounts({ ...unstakeAmounts, [agent.agentId.toString()]: e.target.value })}
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleUnstake(agent.agentId)}
                        disabled={actionLoading[`unstake-${agent.agentId}`] || agent.stake === BigInt(0)}
                        className="bg-red-600 hover:bg-red-500 disabled:bg-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        {actionLoading[`unstake-${agent.agentId}`] ? "..." : "Unstake"}
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Available: {formatStake(agent.stake)} LINK
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/agent/${agent.agentId}`}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-center py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      View Details
                    </Link>
                    {agent.verified && (
                      <Link
                        href={`/strategy?agents=${agent.agentId}`}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-center py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Use in Strategy
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
