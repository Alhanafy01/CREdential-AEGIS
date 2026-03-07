"use client";

import Link from "next/link";
import { Agent, AgentMetadata, isERC8004Metadata, AgentMetadataLegacy } from "@/lib/constants";
import { formatAddress, formatStake, fetchAgentMetadata, checkAgentEndpointHealth, formatReputation } from "@/lib/web3";
import { useEffect, useState } from "react";

interface AgentCardProps {
  agent: Agent;
}

export default function AgentCard({ agent }: AgentCardProps) {
  const [metadata, setMetadata] = useState<AgentMetadata | null>(agent.metadata || null);
  const [endpointHealth, setEndpointHealth] = useState<'online' | 'offline' | 'unknown'>('unknown');

  useEffect(() => {
    // Fetch metadata if not already provided
    if (!metadata && agent.metadataURI) {
      fetchAgentMetadata(agent.metadataURI).then((data) => {
        if (data) setMetadata(data);
      }).catch(console.error);
    }
  }, [agent.metadataURI, metadata]);

  useEffect(() => {
    // Check endpoint health if CRE endpoint is available
    if (agent.creEndpoint) {
      checkAgentEndpointHealth(agent.creEndpoint).then(setEndpointHealth);
    }
  }, [agent.creEndpoint]);

  // Extract display data based on metadata type
  let displayName = `Agent #${agent.agentId.toString()}`;
  let displayDesc = "No description provided";
  let displayCategory = "Uncategorized";
  let specialties: string[] = [];
  let capabilities: string[] = [];
  let hasCREEndpoint = !!agent.creEndpoint;

  if (metadata) {
    if (isERC8004Metadata(metadata)) {
      // ERC-8004 format
      displayName = metadata.name;
      displayDesc = metadata.description;
      specialties = metadata.specialties || [];
      displayCategory = specialties[0] || "DeFi Agent";
      hasCREEndpoint = metadata.services.some(s => s.name === 'cre-agent');
    } else {
      // Legacy format
      const legacy = metadata as AgentMetadataLegacy;
      displayName = legacy.name;
      displayDesc = legacy.description;
      displayCategory = legacy.category;
      capabilities = legacy.capabilities || [];
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 hover:border-blue-500 transition-all hover:shadow-lg hover:shadow-blue-500/10">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{displayName}</h3>
            <p className="text-sm text-gray-400">{formatAddress(agent.agentAddress)}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {agent.verified ? (
            <span className="flex items-center space-x-1 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Verified</span>
            </span>
          ) : (
            <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-sm">
              Pending
            </span>
          )}
          {/* CRE Endpoint Status */}
          {hasCREEndpoint && (
            <span className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs ${
              endpointHealth === 'online'
                ? 'bg-green-900/30 text-green-400'
                : endpointHealth === 'offline'
                ? 'bg-red-900/30 text-red-400'
                : 'bg-gray-700 text-gray-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                endpointHealth === 'online' ? 'bg-green-400' :
                endpointHealth === 'offline' ? 'bg-red-400' : 'bg-gray-400'
              }`}></span>
              <span>CRE {endpointHealth === 'online' ? 'Online' : endpointHealth === 'offline' ? 'Offline' : 'Unknown'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Category/Specialty Badges */}
      <div className="flex flex-wrap gap-1 mb-3">
        <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">
          {displayCategory}
        </span>
        {metadata && isERC8004Metadata(metadata) && (
          <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs">
            ERC-8004
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-gray-400 text-sm mb-4 line-clamp-2">{displayDesc}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gray-900 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Stake</p>
          <p className="text-white font-semibold">{formatStake(agent.stake)} ETH</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">Reputation</p>
          <p className={`font-semibold ${Number(agent.reputation) >= 0 ? "text-green-400" : "text-red-400"}`}>
            {formatReputation(agent.reputation)}
          </p>
        </div>
      </div>

      {/* Specialties/Capabilities */}
      {(specialties.length > 0 || capabilities.length > 0) && (
        <div className="flex flex-wrap gap-1 mb-4">
          {(specialties.length > 0 ? specialties : capabilities).slice(0, 3).map((item, i) => (
            <span key={i} className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs">
              {item}
            </span>
          ))}
          {(specialties.length > 0 ? specialties : capabilities).length > 3 && (
            <span className="bg-gray-700 text-gray-400 px-2 py-0.5 rounded text-xs">
              +{(specialties.length > 0 ? specialties : capabilities).length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Action */}
      <Link
        href={`/agent/${agent.agentId.toString()}`}
        className="block w-full text-center bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm font-medium transition-colors"
      >
        View Details
      </Link>
    </div>
  );
}
