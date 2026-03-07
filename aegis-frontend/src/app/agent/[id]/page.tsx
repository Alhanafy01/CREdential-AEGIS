"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ethers } from "ethers";
import {
  Agent,
  AgentMetadata,
  REGISTRY_ADDRESS,
  REGISTRY_ABI,
  STAKING_TOKEN_ADDRESS,
  ERC20_ABI,
  isERC8004Metadata,
  AgentMetadataLegacy,
} from "@/lib/constants";
import {
  getReadOnlyProvider,
  getTenderlySigner,
  formatAddress,
  formatStake,
  formatReputation,
  fetchAgentMetadata,
  checkAgentEndpointHealth,
  fetchACEPolicyStatus,
  formatAmount,
} from "@/lib/web3";

export default function AgentDetail() {
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [metadata, setMetadata] = useState<AgentMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOwner, setIsOwner] = useState(false);

  // CRE endpoint state
  const [endpointHealth, setEndpointHealth] = useState<'online' | 'offline' | 'unknown'>('unknown');
  const [creEndpoint, setCreEndpoint] = useState<string | null>(null);

  // ACE policy state
  const [policyStatus, setPolicyStatus] = useState<{
    isBlacklisted: boolean;
    maxTransactionAmount: bigint;
    remainingDailyVolume: bigint;
  } | null>(null);

  // Staking state
  const [stakeAmount, setStakeAmount] = useState("");
  const [staking, setStaking] = useState(false);
  const [unstaking, setUnstaking] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<bigint>(BigInt(0));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tokenAllowance, setTokenAllowance] = useState<bigint>(BigInt(0));

  const loadAgent = useCallback(async () => {
    setLoading(true);
    try {
      const provider = getReadOnlyProvider();
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);

      const agentData = await registry.getAgent(agentId);
      if (agentData.owner === ethers.ZeroAddress) {
        setError("Agent not found");
        return;
      }

      const agentObj: Agent = {
        agentId: agentData.agentId,
        agentAddress: agentData.agentAddress,
        owner: agentData.owner,
        humanIdHash: agentData.humanIdHash,
        verified: agentData.verified,
        stake: agentData.stake,
        reputation: agentData.reputation,
        metadataURI: agentData.metadataURI,
      };
      setAgent(agentObj);

      // Check if current user is owner and fetch token balance
      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: "eth_accounts" }) as string[];
        if (accounts.length > 0) {
          setIsOwner(accounts[0].toLowerCase() === agentData.owner.toLowerCase());

          // Fetch token balance and allowance
          try {
            const token = new ethers.Contract(STAKING_TOKEN_ADDRESS, ERC20_ABI, provider);
            const [balance, allowance] = await Promise.all([
              token.balanceOf(accounts[0]),
              token.allowance(accounts[0], REGISTRY_ADDRESS)
            ]);
            setTokenBalance(balance);
            setTokenAllowance(allowance);
          } catch (e) {
            console.error("Error fetching token balance:", e);
          }

          // Fetch ACE policy status for owner
          try {
            const status = await fetchACEPolicyStatus(accounts[0]);
            setPolicyStatus({
              isBlacklisted: status.isBlacklisted,
              maxTransactionAmount: status.maxTransactionAmount,
              remainingDailyVolume: status.remainingDailyVolume,
            });
          } catch (e) {
            console.error("Error fetching ACE policy:", e);
          }
        }
      }

      // Fetch and parse metadata
      try {
        const meta = await fetchAgentMetadata(agentData.metadataURI);
        if (meta) {
          setMetadata(meta);

          // Extract CRE endpoint if ERC-8004 format
          if (isERC8004Metadata(meta)) {
            const creService = meta.services.find(s => s.name === 'cre-agent');
            if (creService) {
              setCreEndpoint(creService.endpoint);
              // Check endpoint health
              const health = await checkAgentEndpointHealth(creService.endpoint);
              setEndpointHealth(health);
            }
          }
        }
      } catch (e) {
        console.error("Error fetching metadata:", e);
      }
    } catch (e) {
      console.error("Error loading agent:", e);
      setError("Failed to load agent");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadAgent();
  }, [loadAgent]);

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;

    setStaking(true);
    try {
      // Use Tenderly signer for transactions
      const signer = await getTenderlySigner();
      const amount = ethers.parseEther(stakeAmount);

      // Approve token spending
      const token = new ethers.Contract(STAKING_TOKEN_ADDRESS, ERC20_ABI, signer);
      console.log("Approving", stakeAmount, "AEGIS tokens...");
      const approveTx = await token.approve(REGISTRY_ADDRESS, amount);
      await approveTx.wait();
      console.log("Approval confirmed");

      // Stake
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
      console.log("Staking", stakeAmount, "AEGIS tokens to agent", agentId, "...");
      const stakeTx = await registry.stake(agentId, amount);
      await stakeTx.wait();
      console.log("Stake confirmed");

      setStakeAmount("");
      loadAgent(); // Reload agent data including new stake
    } catch (e) {
      console.error("Staking error:", e);
      alert("Staking failed: " + (e as Error).message);
    } finally {
      setStaking(false);
    }
  };

  const handleUnstake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;

    setUnstaking(true);
    try {
      // Use Tenderly signer for transactions
      const signer = await getTenderlySigner();
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);

      const amount = ethers.parseEther(stakeAmount);
      console.log("Unstaking", stakeAmount, "AEGIS tokens from agent", agentId, "...");
      const tx = await registry.unstake(agentId, amount);
      await tx.wait();
      console.log("Unstake confirmed");

      setStakeAmount("");
      loadAgent(); // Reload agent data including new stake
    } catch (e) {
      console.error("Unstaking error:", e);
      alert("Unstaking failed: " + (e as Error).message);
    } finally {
      setUnstaking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="bg-red-500/20 border border-red-500 text-red-400 px-6 py-8 rounded-xl">
          <h2 className="text-2xl font-bold mb-2">Agent Not Found</h2>
          <p className="mb-4">{error || "This agent does not exist."}</p>
          <Link href="/" className="text-blue-400 hover:underline">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  // Extract display data based on metadata type
  let displayName = `Agent #${agent.agentId.toString()}`;
  let displayDesc = "";
  let displayCategory = "";
  let specialties: string[] = [];
  let capabilities: string[] = [];
  let author = "Unknown";
  let version = "1.0.0";

  if (metadata) {
    if (isERC8004Metadata(metadata)) {
      displayName = metadata.name;
      displayDesc = metadata.description;
      specialties = metadata.specialties || [];
      displayCategory = specialties[0] || "DeFi Agent";
    } else {
      const legacy = metadata as AgentMetadataLegacy;
      displayName = legacy.name;
      displayDesc = legacy.description;
      displayCategory = legacy.category;
      capabilities = legacy.capabilities || [];
      author = legacy.author || "Unknown";
      version = legacy.version || "1.0.0";
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back Link */}
      <Link href="/" className="text-gray-400 hover:text-white mb-6 inline-block">
        &larr; Back to Marketplace
      </Link>

      {/* Agent Header */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{displayName}</h1>
              <p className="text-gray-400 font-mono text-sm">{formatAddress(agent.agentAddress)}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {displayCategory && (
                  <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">
                    {displayCategory}
                  </span>
                )}
                {metadata && isERC8004Metadata(metadata) && (
                  <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs">
                    ERC-8004
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {agent.verified ? (
              <span className="flex items-center space-x-1 bg-green-500/20 text-green-400 px-4 py-2 rounded-lg text-sm font-medium">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>World ID Verified</span>
              </span>
            ) : (
              <span className="bg-yellow-500/20 text-yellow-400 px-4 py-2 rounded-lg text-sm font-medium">
                Pending Verification
              </span>
            )}
            {isOwner && (
              <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded text-xs">
                You own this agent
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {displayDesc && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2">Description</h3>
            <p className="text-white">{displayDesc}</p>
          </div>
        )}

        {/* Specialties/Capabilities */}
        {(specialties.length > 0 || capabilities.length > 0) && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              {specialties.length > 0 ? "Specialties" : "Capabilities"}
            </h3>
            <div className="flex flex-wrap gap-2">
              {(specialties.length > 0 ? specialties : capabilities).map((item, i) => (
                <span key={i} className="bg-gray-800 text-gray-300 px-3 py-1 rounded-lg text-sm">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Agent ID</p>
            <p className="text-xl font-bold text-white">#{agent.agentId.toString()}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Stake</p>
            <p className="text-xl font-bold text-white">{formatStake(agent.stake)} ETH</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Reputation</p>
            <p className={`text-xl font-bold ${Number(agent.reputation) >= 0 ? "text-green-400" : "text-red-400"}`}>
              {formatReputation(agent.reputation)}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Version</p>
            <p className="text-xl font-bold text-white">{version}</p>
          </div>
        </div>
      </div>

      {/* CRE Endpoint Section */}
      {creEndpoint && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>CRE Integration</span>
            <span className={`px-2 py-0.5 rounded text-xs ${
              endpointHealth === 'online'
                ? 'bg-green-900/50 text-green-400'
                : endpointHealth === 'offline'
                ? 'bg-red-900/50 text-red-400'
                : 'bg-gray-700 text-gray-400'
            }`}>
              {endpointHealth === 'online' ? 'Online' : endpointHealth === 'offline' ? 'Offline' : 'Unknown'}
            </span>
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-400 mb-1">CRE Agent Endpoint</p>
              <code className="text-blue-400 bg-gray-800 px-3 py-2 rounded block text-sm font-mono">
                {creEndpoint}
              </code>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Metadata URI</p>
              <code className="text-gray-300 bg-gray-800 px-3 py-2 rounded block text-sm font-mono break-all">
                {agent.metadataURI}
              </code>
            </div>
            {metadata && isERC8004Metadata(metadata) && (
              <div>
                <p className="text-sm text-gray-400 mb-2">Available Services</p>
                <div className="flex flex-wrap gap-2">
                  {metadata.services.map((service, i) => (
                    <span key={i} className="bg-gray-800 text-gray-300 px-3 py-1 rounded-lg text-sm flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${service.name === 'cre-agent' ? 'bg-green-400' : 'bg-blue-400'}`}></span>
                      {service.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Owner Details */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Owner Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-400 mb-1">Owner Address</p>
            <p className="text-white font-mono text-sm break-all">{agent.owner}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Author</p>
            <p className="text-white">{author}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400 mb-1">Human ID Hash</p>
            <p className="text-gray-300 font-mono text-xs break-all">
              {agent.humanIdHash === "0x0000000000000000000000000000000000000000000000000000000000000000"
                ? "Not verified"
                : agent.humanIdHash}
            </p>
          </div>
        </div>
      </div>

      {/* ACE Policy Status (for connected wallet) */}
      {policyStatus && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">ACE Policy Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Blacklist Status</p>
              <p className={`font-semibold ${policyStatus.isBlacklisted ? "text-red-400" : "text-green-400"}`}>
                {policyStatus.isBlacklisted ? "Blacklisted" : "Clear"}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Max Transaction</p>
              <p className="text-white font-semibold">{formatAmount(policyStatus.maxTransactionAmount)} tokens</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Remaining Daily Volume</p>
              <p className="text-white font-semibold">{formatAmount(policyStatus.remainingDailyVolume)} tokens</p>
            </div>
          </div>
        </div>
      )}

      {/* Staking Section (Owner Only) */}
      {isOwner && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold mb-4">Manage Stake</h2>
          <p className="text-gray-400 text-sm mb-4">
            Stake AEGIS tokens to increase trust in your agent. Higher stakes indicate greater commitment.
          </p>

          {/* Token Balance Info */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Your AEGIS Balance</p>
              <p className="text-xl font-bold text-purple-400">{formatStake(tokenBalance)} AEGIS</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Currently Staked</p>
              <p className="text-xl font-bold text-green-400">{formatStake(agent.stake)} AEGIS</p>
            </div>
          </div>

          <div className="flex gap-4">
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="Amount to stake/unstake"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleStake}
              disabled={staking || !stakeAmount || parseFloat(stakeAmount) <= 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {staking ? "Staking..." : "Stake"}
            </button>
            <button
              onClick={handleUnstake}
              disabled={unstaking || !stakeAmount || parseFloat(stakeAmount) <= 0 || agent.stake === BigInt(0)}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {unstaking ? "Unstaking..." : "Unstake"}
            </button>
          </div>

          {/* Quick stake buttons */}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setStakeAmount("100")}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded"
            >
              100
            </button>
            <button
              onClick={() => setStakeAmount("500")}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded"
            >
              500
            </button>
            <button
              onClick={() => setStakeAmount("1000")}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1 rounded"
            >
              1000
            </button>
            <button
              onClick={() => setStakeAmount(formatStake(tokenBalance))}
              className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 rounded"
            >
              Max
            </button>
          </div>

          <p className="text-gray-500 text-xs mt-3">
            Staking requires approval of AEGIS tokens. The contract will request approval automatically.
          </p>
        </div>
      )}

      {/* Use in Strategy */}
      {agent.verified && (
        <div className="mt-6">
          <Link
            href="/strategy"
            className="block w-full text-center bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 rounded-lg font-medium transition"
          >
            Use This Agent in Strategy
          </Link>
        </div>
      )}
    </div>
  );
}
