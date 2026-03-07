"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IDKitWidget, VerificationLevel, ISuccessResult } from "@worldcoin/idkit";
import { ethers } from "ethers";
import {
  REGISTRY_ADDRESS,
  REGISTRY_ABI,
  WORLD_APP_ID,
  WORLD_ACTION_ID,
  AGENT_CATEGORIES,
  AgentMetadataLegacy,
} from "@/lib/constants";
import { connectWallet, getTenderlySigner, getProvider } from "@/lib/web3";

// CRE Command Generator for verification workflow
const generateVerificationCRECommand = (txHash: string) => {
  return `cre workflow simulate ./onboarding-workflow --target local-simulation --evm-tx-hash ${txHash} --non-interactive --trigger-index 0 --evm-event-index 0 --broadcast`;
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

type Step = "form" | "worldid" | "submit" | "success";

export default function RegisterAgent() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [txHash, setTxHash] = useState("");
  const [agentId, setAgentId] = useState("");
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Form state
  const [formData, setFormData] = useState<AgentMetadataLegacy>({
    name: "",
    description: "",
    category: AGENT_CATEGORIES[0],
    capabilities: [],
    apiEndpoint: "",
    version: "1.0.0",
    author: "",
  });
  const [capabilityInput, setCapabilityInput] = useState("");

  // World ID proof
  const [worldIdProof, setWorldIdProof] = useState<ISuccessResult | null>(null);

  // Check agent verification status
  const checkVerificationStatus = useCallback(async () => {
    if (!agentId) return;

    setCheckingStatus(true);
    try {
      const provider = getProvider();
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
      const verified = await registry.isAgentVerified(BigInt(agentId));
      setIsVerified(verified);
    } catch (e) {
      console.error("Error checking verification status:", e);
    }
    setCheckingStatus(false);
  }, [agentId]);

  // Poll for verification status when on success step
  useEffect(() => {
    if (step === "success" && agentId && !isVerified) {
      // Check immediately
      checkVerificationStatus();

      // Then poll every 5 seconds
      const interval = setInterval(checkVerificationStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [step, agentId, isVerified, checkVerificationStatus]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const addCapability = () => {
    if (capabilityInput.trim() && !formData.capabilities.includes(capabilityInput.trim())) {
      setFormData({
        ...formData,
        capabilities: [...formData.capabilities, capabilityInput.trim()],
      });
      setCapabilityInput("");
    }
  };

  const removeCapability = (cap: string) => {
    setFormData({
      ...formData,
      capabilities: formData.capabilities.filter((c) => c !== cap),
    });
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError("Agent name is required");
      return false;
    }
    if (!formData.description.trim()) {
      setError("Description is required");
      return false;
    }
    if (!formData.author.trim()) {
      setError("Author name is required");
      return false;
    }
    return true;
  };

  const handleContinueToWorldId = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError("");
    try {
      const addr = await connectWallet();
      setWalletAddress(addr);
      setFormData({ ...formData, author: formData.author || addr });
      setStep("worldid");
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || "Failed to connect wallet");
    } finally {
      setLoading(false);
    }
  };

  const onWorldIdSuccess = useCallback((result: ISuccessResult) => {
    console.log("World ID verification successful:", result);
    setWorldIdProof(result);
    setStep("submit");
  }, []);

  const encodeWorldIdProof = (result: ISuccessResult): string => {
    const abiCoder = new ethers.AbiCoder();

    // World ID SDK returns proof as a hex string that needs to be decoded into uint256[8]
    // The proof is ABI-packed as 8 uint256 values
    let proofArray: bigint[];

    if (typeof result.proof === 'string') {
      // Check if it's a hex string (starts with 0x)
      if (result.proof.startsWith('0x')) {
        // Decode the packed proof - it's 8 uint256 values packed together
        // Each uint256 is 32 bytes = 64 hex chars
        const proofHex = result.proof.slice(2); // Remove 0x
        proofArray = [];
        for (let i = 0; i < 8; i++) {
          const chunk = proofHex.slice(i * 64, (i + 1) * 64);
          if (chunk) {
            proofArray.push(BigInt('0x' + chunk));
          } else {
            proofArray.push(BigInt(0));
          }
        }
      } else {
        // Fallback: try comma-separated format
        proofArray = result.proof.split(",").map((p: string) => BigInt(p.trim()));
      }
    } else if (Array.isArray(result.proof)) {
      // Already an array
      proofArray = (result.proof as (string | number | bigint)[]).map((p) => BigInt(p));
    } else {
      throw new Error("Unexpected proof format");
    }

    // Ensure we have exactly 8 elements
    while (proofArray.length < 8) {
      proofArray.push(BigInt(0));
    }
    proofArray = proofArray.slice(0, 8);

    console.log("Encoding World ID proof:");
    console.log("  merkle_root:", result.merkle_root);
    console.log("  nullifier_hash:", result.nullifier_hash);
    console.log("  proof array length:", proofArray.length);

    return abiCoder.encode(
      ["uint256", "uint256", "uint256[8]"],
      [result.merkle_root, result.nullifier_hash, proofArray]
    );
  };

  const handleRegister = async () => {
    if (!worldIdProof) {
      setError("World ID verification required");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Use Tenderly signer to bypass MetaMask chain ID issues
      const signer = await getTenderlySigner();
      const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);

      // Create metadata URI (inline JSON for demo)
      const metadataJson = JSON.stringify(formData);
      const metadataURI = `data:application/json,${encodeURIComponent(metadataJson)}`;

      // Encode World ID proof
      const worldIdPayload = encodeWorldIdProof(worldIdProof);

      console.log("Registering agent...");
      console.log("Metadata:", metadataURI);
      console.log("World ID Payload length:", worldIdPayload.length);

      const tx = await registry.registerAgent(metadataURI, worldIdPayload);
      setTxHash(tx.hash);
      console.log("Transaction sent:", tx.hash);

      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);

      // Parse agent ID from event
      let newAgentId = "";
      for (const log of receipt.logs) {
        try {
          const parsed = registry.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsed?.name === "AgentRegistered") {
            newAgentId = parsed.args.agentId.toString();
            setAgentId(newAgentId);
            break;
          }
        } catch {
          // Skip logs that don't match
        }
      }

      // Notify agent server about new registration
      if (newAgentId) {
        try {
          await fetch("http://localhost:3001/api/notify-registration", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agentId: newAgentId,
              name: formData.name,
              category: formData.category,
              metadataURI: `data:application/json,${encodeURIComponent(JSON.stringify(formData))}`,
            }),
          });
          console.log("Agent server notified of new registration");
        } catch (notifyError) {
          console.warn("Could not notify agent server:", notifyError);
        }
      }

      setStep("success");
    } catch (e: unknown) {
      const err = e as Error;
      console.error("Registration error:", e);
      setError(err.message || "Failed to register agent");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Register Your AI Agent</h1>
        <p className="text-gray-400">
          Verify your humanity with World ID and register your agent on the AEGIS marketplace.
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {["Agent Details", "World ID", "Confirm", "Complete"].map((label, i) => {
          const stepIndex = ["form", "worldid", "submit", "success"].indexOf(step);
          const isActive = i === stepIndex;
          const isComplete = i < stepIndex;
          return (
            <div key={label} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isComplete
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-gray-400"
                }`}
              >
                {isComplete ? "✓" : i + 1}
              </div>
              <span className={`ml-2 text-sm ${isActive ? "text-white" : "text-gray-500"}`}>
                {label}
              </span>
              {i < 3 && <div className="w-12 h-0.5 bg-gray-700 mx-2"></div>}
            </div>
          );
        })}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Step 1: Agent Details Form */}
      {step === "form" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-xl font-semibold mb-6">Agent Details</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Agent Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="My DeFi Trading Bot"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe what your agent does..."
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Category *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              >
                {AGENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Capabilities
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={capabilityInput}
                  onChange={(e) => setCapabilityInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addCapability())}
                  placeholder="Add capability..."
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={addCapability}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-sm flex items-center gap-1"
                  >
                    {cap}
                    <button
                      onClick={() => removeCapability(cap)}
                      className="hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                API Endpoint (Optional)
              </label>
              <input
                type="url"
                name="apiEndpoint"
                value={formData.apiEndpoint}
                onChange={handleInputChange}
                placeholder="https://api.myagent.com/v1"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Version
                </label>
                <input
                  type="text"
                  name="version"
                  value={formData.version}
                  onChange={handleInputChange}
                  placeholder="1.0.0"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Author *
                </label>
                <input
                  type="text"
                  name="author"
                  value={formData.author}
                  onChange={handleInputChange}
                  placeholder="Your name or team"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleContinueToWorldId}
            disabled={loading}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? "Connecting Wallet..." : "Continue to World ID Verification"}
          </button>
        </div>
      )}

      {/* Step 2: World ID Verification */}
      {step === "worldid" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 text-center">
          <h2 className="text-xl font-semibold mb-4">Verify Your Humanity</h2>
          <p className="text-gray-400 mb-6">
            Click the button below to verify with World ID. This proves you&apos;re a unique human.
          </p>

          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-400 mb-1">Connected Wallet</p>
            <p className="text-white font-mono">{walletAddress}</p>
          </div>

          {(() => {
            const signalValue = walletAddress.toLowerCase();
            console.log("IDKitWidget signal:", signalValue);
            console.log("IDKitWidget action:", WORLD_ACTION_ID);
            return null;
          })()}
          <IDKitWidget
            app_id={WORLD_APP_ID as `app_${string}`}
            action={WORLD_ACTION_ID}
            signal={walletAddress.toLowerCase()}
            onSuccess={onWorldIdSuccess}
            verification_level={VerificationLevel.Orb}
          >
            {({ open }) => (
              <button
                onClick={open}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-8 py-4 rounded-lg font-medium text-lg transition-all"
              >
                Verify with World ID
              </button>
            )}
          </IDKitWidget>

          <button
            onClick={() => setStep("form")}
            className="mt-4 text-gray-400 hover:text-white text-sm"
          >
            ← Back to form
          </button>
        </div>
      )}

      {/* Step 3: Confirm & Submit */}
      {step === "submit" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-xl font-semibold mb-6">Confirm Registration</h2>

          <div className="space-y-4 mb-6">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Agent Name</p>
              <p className="text-white font-semibold">{formData.name}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Category</p>
              <p className="text-white">{formData.category}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Description</p>
              <p className="text-white text-sm">{formData.description}</p>
            </div>
            <div className="bg-green-500/20 border border-green-500 rounded-lg p-4">
              <p className="text-sm text-green-400 mb-1">World ID Status</p>
              <p className="text-green-400 font-semibold flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Verified
              </p>
            </div>
          </div>

          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? "Registering Agent..." : "Register Agent"}
          </button>

          <button
            onClick={() => setStep("worldid")}
            className="w-full mt-2 text-gray-400 hover:text-white text-sm py-2"
          >
            ← Back
          </button>
        </div>
      )}

      {/* Step 4: Success */}
      {step === "success" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold mb-2">Agent Registered!</h2>
            <p className="text-gray-400">
              Your agent has been registered. Run the CRE workflow below to verify.
            </p>
          </div>

          {/* Agent ID & Status */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Agent ID</p>
              <p className="text-2xl font-bold text-blue-400">#{agentId}</p>
            </div>
            <div className={`rounded-lg p-4 ${isVerified ? 'bg-green-900/30 border border-green-600' : 'bg-yellow-900/30 border border-yellow-600'}`}>
              <p className="text-sm text-gray-400 mb-1">Verification Status</p>
              <div className="flex items-center gap-2">
                {checkingStatus ? (
                  <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                ) : isVerified ? (
                  <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <div className="h-5 w-5 border-2 border-yellow-500 rounded-full"></div>
                )}
                <span className={`font-semibold ${isVerified ? 'text-green-400' : 'text-yellow-400'}`}>
                  {isVerified ? 'Verified' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Transaction Hash */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-400 mb-1">Transaction Hash</p>
            <a
              href={`https://dashboard.tenderly.co/tx/mainnet/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline text-sm font-mono break-all"
            >
              {txHash}
            </a>
          </div>

          {/* CRE Command Box */}
          {!isVerified && (
            <div className="p-4 rounded-lg bg-gray-950 border border-purple-600 mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-purple-400 font-medium text-sm">🔗 CRE Verification Command</p>
                <button
                  onClick={async () => {
                    const cmd = generateVerificationCRECommand(txHash);
                    const success = await copyToClipboard(`cd /xdata/chainlinkhackathone/aegis-cre && ${cmd}`);
                    if (success) {
                      setCopiedCommand(true);
                      setTimeout(() => setCopiedCommand(false), 2000);
                    }
                  }}
                  className={`px-3 py-1 rounded text-xs font-medium transition ${
                    copiedCommand
                      ? "bg-green-600 text-white"
                      : "bg-purple-600 hover:bg-purple-700 text-white"
                  }`}
                >
                  {copiedCommand ? "✓ Copied!" : "Copy Command"}
                </button>
              </div>
              <div className="bg-black rounded p-3 font-mono text-xs text-green-400 overflow-x-auto">
                <code>cd /xdata/chainlinkhackathone/aegis-cre && {generateVerificationCRECommand(txHash)}</code>
              </div>
              <p className="text-gray-500 text-xs mt-2">
                Run this command in your terminal to verify the agent with World ID via CRE
              </p>
            </div>
          )}

          {/* Verified Success Message */}
          {isVerified && (
            <div className="p-4 rounded-lg bg-green-900/30 border border-green-600 mb-6">
              <p className="text-green-400 font-medium flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Agent verified successfully! Ready for strategy jobs.
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => router.push(`/agent/${agentId}`)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
            >
              View Agent
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-medium transition-colors"
            >
              Back to Marketplace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
