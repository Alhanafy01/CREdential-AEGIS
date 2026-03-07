"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import {
  REGISTRY_ADDRESS,
  REGISTRY_ABI,
  TENDERLY_RPC,
  Agent,
  AgentMetadata,
  isERC8004Metadata,
} from "@/lib/constants";

export default function AgentMarketplace() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "verified" | "unverified">("all");
  const [sortBy, setSortBy] = useState<"reputation" | "stake" | "id">("reputation");
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const provider = new ethers.JsonRpcProvider(TENDERLY_RPC);
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);

      const nextId = await registry.nextAgentId();
      console.log(`[Marketplace] Fetching ${Number(nextId) - 1} agents from registry`);

      const fetchedAgents: Agent[] = [];

      for (let i = 1; i < Number(nextId); i++) {
        try {
          const agent = await registry.getAgent(i);
          if (agent.owner !== ethers.ZeroAddress) {
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

            // Try to fetch metadata
            try {
              const metadata = await fetchMetadata(agent.metadataURI);
              if (metadata) {
                agentData.metadata = metadata;
                if (isERC8004Metadata(metadata)) {
                  const creService = metadata.services.find((s) => s.name === "cre-agent");
                  if (creService) {
                    agentData.creEndpoint = creService.endpoint;
                  }
                }
              }
            } catch {
              console.warn(`Could not fetch metadata for agent ${i}`);
            }

            fetchedAgents.push(agentData);
          }
        } catch (e) {
          console.error(`Error fetching agent ${i}:`, e);
        }
      }

      setAgents(fetchedAgents);
      setLastSync(new Date());
      console.log(`[Marketplace] Loaded ${fetchedAgents.length} agents`);
    } catch (e) {
      console.error("Error fetching agents:", e);
      setError("Failed to fetch agents from registry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const fetchMetadata = async (uri: string): Promise<AgentMetadata | null> => {
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
    return null;
  };

  // Filter and sort agents
  const filteredAgents = agents
    .filter((agent) => {
      if (filter === "verified") return agent.verified;
      if (filter === "unverified") return !agent.verified;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "reputation") {
        return Number(b.reputation) - Number(a.reputation);
      }
      if (sortBy === "stake") {
        return Number(b.stake) - Number(a.stake);
      }
      return Number(b.agentId) - Number(a.agentId);
    });

  const formatStake = (stake: bigint) => {
    const formatted = ethers.formatEther(stake);
    return parseFloat(formatted).toFixed(2);
  };

  const formatReputation = (rep: bigint) => {
    const num = Number(rep);
    if (num >= 0) return `+${num}`;
    return num.toString();
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
      if (isERC8004Metadata(agent.metadata)) {
        return agent.metadata.name;
      }
      return (agent.metadata as { name?: string }).name || `Agent #${agent.agentId}`;
    }
    return `Agent #${agent.agentId}`;
  };

  const getAgentDescription = (agent: Agent) => {
    if (agent.metadata) {
      if (isERC8004Metadata(agent.metadata)) {
        return agent.metadata.description;
      }
      return (agent.metadata as { description?: string }).description || "No description";
    }
    return "No description available";
  };

  const getAgentCategory = (agent: Agent) => {
    if (agent.metadata && !isERC8004Metadata(agent.metadata)) {
      return (agent.metadata as { category?: string }).category || "General";
    }
    if (agent.metadata && isERC8004Metadata(agent.metadata)) {
      return agent.metadata.specialties?.[0] || "DeFi";
    }
    return "General";
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-gray-400 hover:text-white text-sm mb-2 inline-block">
                &larr; Back to Home
              </Link>
              <h1 className="text-3xl font-bold">Agent Marketplace</h1>
              <p className="text-gray-400 mt-2">
                Browse all registered agents on AEGIS Protocol
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">
                Registry: <span className="text-gray-400 font-mono">{REGISTRY_ADDRESS.slice(0, 10)}...</span>
              </div>
              {lastSync && (
                <div className="text-xs text-gray-500 mt-1">
                  Last synced: {lastSync.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          {/* Stats */}
          <div className="flex gap-6">
            <div className="bg-gray-800/50 rounded-lg px-4 py-2 border border-gray-700">
              <div className="text-2xl font-bold text-white">{agents.length}</div>
              <div className="text-xs text-gray-400">Total Agents</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg px-4 py-2 border border-green-700/50">
              <div className="text-2xl font-bold text-green-400">
                {agents.filter((a) => a.verified).length}
              </div>
              <div className="text-xs text-gray-400">Verified</div>
            </div>
            <div className="bg-gray-800/50 rounded-lg px-4 py-2 border border-yellow-700/50">
              <div className="text-2xl font-bold text-yellow-400">
                {agents.filter((a) => !a.verified).length}
              </div>
              <div className="text-xs text-gray-400">Pending</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Agents</option>
              <option value="verified">Verified Only</option>
              <option value="unverified">Pending Verification</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="reputation">Sort by Reputation</option>
              <option value="stake">Sort by Stake</option>
              <option value="id">Sort by ID</option>
            </select>

            <button
              onClick={fetchAgents}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? "Syncing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && agents.length === 0 && (
          <div className="text-center py-20">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Loading agents from registry...</p>
          </div>
        )}

        {/* Agent Grid */}
        {!loading && filteredAgents.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400">No agents found matching your criteria</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => (
            <div
              key={agent.agentId.toString()}
              className={`bg-gray-800/50 border rounded-xl p-6 hover:border-blue-500/50 transition-all ${
                agent.verified ? "border-green-700/50" : "border-gray-700"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                      agent.verified
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {getAgentName(agent).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{getAgentName(agent)}</h3>
                    <span className="text-xs text-gray-500">ID: {agent.agentId.toString()}</span>
                  </div>
                </div>
                {agent.verified ? (
                  <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Verified
                  </span>
                ) : (
                  <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full">
                    Pending
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                {getAgentDescription(agent)}
              </p>

              {/* Category */}
              <div className="mb-4">
                <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded">
                  {getAgentCategory(agent)}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Reputation</div>
                  <div className={`text-lg font-bold ${getReputationColor(agent.reputation)}`}>
                    {formatReputation(agent.reputation)}
                  </div>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Stake</div>
                  <div className="text-lg font-bold text-blue-400">
                    {formatStake(agent.stake)} LINK
                  </div>
                </div>
              </div>

              {/* Owner */}
              <div className="text-xs text-gray-500 mb-4">
                Owner:{" "}
                <span className="font-mono text-gray-400">
                  {agent.owner.slice(0, 6)}...{agent.owner.slice(-4)}
                </span>
              </div>

              {/* Actions */}
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
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-center py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Use Agent
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
