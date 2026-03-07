/* eslint-disable @typescript-eslint/no-unused-vars */
import { ethers } from "ethers";
import {
  TENDERLY_RPC,
  REGISTRY_ADDRESS,
  REGISTRY_ABI,
  STRATEGY_VAULT_ADDRESS,
  STRATEGY_VAULT_ABI,
  POLICY_ENGINE_ADDRESS,
  POLICY_ENGINE_ABI,
  Agent,
  AgentMetadata,
  AgentMetadataERC8004,
  isERC8004Metadata,
  StrategyJob,
  ACEPolicyStatus,
  STRATEGY_TYPE_NAMES
} from "./constants";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  }) as string[];

  // Tenderly uses Chain ID 1 (mainnet fork) - we need to add it as a custom network
  // with a different name so MetaMask uses our RPC instead of default mainnet
  const chainIdHex = "0x1"; // Chain ID 1

  try {
    // Try to add/switch to our Tenderly network
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: chainIdHex,
        chainName: "Tenderly AEGIS",
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: [TENDERLY_RPC],
        blockExplorerUrls: [],
      }],
    });
  } catch (_addError: unknown) {
    // If chain already exists, just switch to it
    console.log("Network may already exist, attempting switch...");
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (switchError) {
      console.error("Failed to switch network:", switchError);
    }
  }

  return accounts[0];
}

export async function getEthBalance(address: string): Promise<string> {
  // Always use Tenderly RPC directly to get accurate balance
  const provider = new ethers.JsonRpcProvider(TENDERLY_RPC);
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

export function getProvider(): ethers.BrowserProvider {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }
  return new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
}

export function getReadOnlyProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(TENDERLY_RPC);
}

// Get a signer that uses Tenderly RPC directly (bypasses MetaMask chain ID issues)
export async function getTenderlySigner(): Promise<ethers.Signer> {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  // Get the address from MetaMask
  const accounts = await window.ethereum.request({
    method: "eth_accounts",
  }) as string[];

  if (accounts.length === 0) {
    throw new Error("No wallet connected");
  }

  const address = accounts[0];

  // Create a custom signer that uses Tenderly RPC but signs via MetaMask
  const tenderlyProvider = new ethers.JsonRpcProvider(TENDERLY_RPC);

  // Create a signer that wraps MetaMask signing with Tenderly provider
  const signer = new TenderlyMetaMaskSigner(address, tenderlyProvider);
  return signer;
}

// Custom signer that sends transactions to Tenderly but uses MetaMask for signing
class TenderlyMetaMaskSigner extends ethers.AbstractSigner {
  private _address: string;

  constructor(address: string, provider: ethers.Provider) {
    super(provider);
    this._address = address;
  }

  async getAddress(): Promise<string> {
    return this._address;
  }

  connect(provider: ethers.Provider): ethers.Signer {
    return new TenderlyMetaMaskSigner(this._address, provider);
  }

  async signTransaction(_tx: ethers.TransactionRequest): Promise<string> {
    throw new Error("signTransaction not supported - use sendTransaction");
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const msgHex = typeof message === 'string'
      ? ethers.hexlify(ethers.toUtf8Bytes(message))
      : ethers.hexlify(message);

    return await window.ethereum!.request({
      method: "personal_sign",
      params: [msgHex, this._address],
    }) as string;
  }

  async signTypedData(
    _domain: ethers.TypedDataDomain,
    _types: Record<string, ethers.TypedDataField[]>,
    _value: Record<string, unknown>
  ): Promise<string> {
    throw new Error("signTypedData not implemented");
  }

  async sendTransaction(tx: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    const provider = this.provider as ethers.JsonRpcProvider;

    // Log for debugging
    console.log("[TenderlySigner] sendTransaction called with:", {
      to: tx.to,
      data: tx.data ? `${(tx.data as string).slice(0, 20)}...` : "undefined",
      value: tx.value,
      gasLimit: tx.gasLimit
    });

    // Ensure data is properly formatted
    const txData = tx.data ? tx.data.toString() : "0x";

    // Send the raw transaction directly to Tenderly using their impersonation feature
    // Tenderly Virtual Testnet allows sending transactions without actual signing
    const result = await provider.send("eth_sendTransaction", [{
      from: this._address,
      to: tx.to,
      data: txData,
      value: tx.value ? ethers.toQuantity(tx.value) : "0x0",
      gas: tx.gasLimit ? ethers.toQuantity(tx.gasLimit) : "0x100000", // Increased default gas
    }]);

    console.log("[TenderlySigner] TX hash:", result);

    // Wait for the transaction
    const txResponse = await provider.getTransaction(result);
    if (!txResponse) {
      throw new Error("Transaction not found");
    }
    return txResponse;
  }
}

// =============================================================================
// Contract Instance Helpers
// =============================================================================

export async function getRegistryContract(signer?: ethers.Signer): Promise<ethers.Contract> {
  if (signer) {
    return new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, signer);
  }
  return new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, getReadOnlyProvider());
}

export async function getStrategyVaultContract(signer?: ethers.Signer): Promise<ethers.Contract> {
  if (signer) {
    return new ethers.Contract(STRATEGY_VAULT_ADDRESS, STRATEGY_VAULT_ABI, signer);
  }
  return new ethers.Contract(STRATEGY_VAULT_ADDRESS, STRATEGY_VAULT_ABI, getReadOnlyProvider());
}

export async function getPolicyEngineContract(signer?: ethers.Signer): Promise<ethers.Contract> {
  if (signer) {
    return new ethers.Contract(POLICY_ENGINE_ADDRESS, POLICY_ENGINE_ABI, signer);
  }
  return new ethers.Contract(POLICY_ENGINE_ADDRESS, POLICY_ENGINE_ABI, getReadOnlyProvider());
}

// =============================================================================
// Agent Functions
// =============================================================================

export async function fetchAllAgents(): Promise<Agent[]> {
  const provider = getReadOnlyProvider();
  const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);

  const nextId = await registry.nextAgentId();
  const agents: Agent[] = [];

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

        // Fetch and parse metadata
        try {
          const metadata = await fetchAgentMetadata(agent.metadataURI);
          if (metadata) {
            agentData.metadata = metadata as AgentMetadata;

            // Extract CRE endpoint if ERC-8004 format
            if (isERC8004Metadata(agentData.metadata)) {
              const creService = agentData.metadata.services.find(s => s.name === 'cre-agent');
              if (creService) {
                agentData.creEndpoint = creService.endpoint;
              }
            }
          }
        } catch (e) {
          console.error(`Error fetching metadata for agent ${i}:`, e);
        }

        agents.push(agentData);
      }
    } catch (e) {
      console.error(`Error fetching agent ${i}:`, e);
    }
  }

  return agents;
}

export async function fetchAgentById(agentId: number): Promise<Agent | null> {
  const provider = getReadOnlyProvider();
  const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);

  try {
    const agent = await registry.getAgent(agentId);
    if (agent.owner === ethers.ZeroAddress) {
      return null;
    }

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

    // Fetch and parse metadata
    try {
      const metadata = await fetchAgentMetadata(agent.metadataURI);
      if (metadata) {
        agentData.metadata = metadata as AgentMetadata;

        // Extract CRE endpoint if ERC-8004 format
        if (isERC8004Metadata(agentData.metadata)) {
          const creService = agentData.metadata.services.find(s => s.name === 'cre-agent');
          if (creService) {
            agentData.creEndpoint = creService.endpoint;
          }
        }
      }
    } catch (e) {
      console.error(`Error fetching metadata for agent ${agentId}:`, e);
    }

    return agentData;
  } catch (e) {
    console.error(`Error fetching agent ${agentId}:`, e);
    return null;
  }
}

export async function fetchAgentMetadata(metadataURI: string): Promise<AgentMetadata | null> {
  // Handle inline JSON (data: URI)
  if (metadataURI.startsWith("data:")) {
    const json = metadataURI.replace("data:application/json,", "");
    return JSON.parse(decodeURIComponent(json));
  }

  // Handle IPFS
  if (metadataURI.startsWith("ipfs://")) {
    const cid = metadataURI.replace("ipfs://", "");
    const response = await fetch(`https://ipfs.io/ipfs/${cid}`);
    return response.json();
  }

  // Handle HTTP URLs (ERC-8004 style)
  if (metadataURI.startsWith("http://") || metadataURI.startsWith("https://")) {
    try {
      const response = await fetch(metadataURI);
      if (response.ok) {
        return response.json();
      }
    } catch (e) {
      console.error("Error fetching metadata from URL:", e);
    }
  }

  return null;
}

export async function checkAgentEndpointHealth(endpoint: string): Promise<'online' | 'offline' | 'unknown'> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(endpoint.replace('/cre/decide', '/health'), {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok ? 'online' : 'offline';
  } catch {
    return 'unknown';
  }
}

// =============================================================================
// Strategy Job Functions
// =============================================================================

/**
 * Get the next job ID from the contract (indicates how many jobs exist)
 * This is the source of truth for on-chain job state
 */
export async function getNextJobIdFromContract(): Promise<bigint> {
  const provider = getReadOnlyProvider();
  const vault = new ethers.Contract(STRATEGY_VAULT_ADDRESS, STRATEGY_VAULT_ABI, provider);
  const nextJobId = await vault.nextJobId();
  return BigInt(nextJobId);
}

/**
 * Verify a job exists on-chain by checking its proposer
 * Returns true if the job has a valid proposer (not zero address)
 */
export async function verifyJobExistsOnChain(jobId: number): Promise<boolean> {
  const provider = getReadOnlyProvider();
  const vault = new ethers.Contract(STRATEGY_VAULT_ADDRESS, STRATEGY_VAULT_ABI, provider);

  try {
    const job = await vault.getJob(jobId);
    return job.proposer !== ethers.ZeroAddress;
  } catch {
    return false;
  }
}

export async function fetchAllJobs(): Promise<StrategyJob[]> {
  const provider = getReadOnlyProvider();
  const vault = new ethers.Contract(STRATEGY_VAULT_ADDRESS, STRATEGY_VAULT_ABI, provider);

  const nextJobId = await vault.nextJobId();
  const jobs: StrategyJob[] = [];

  console.log(`[fetchAllJobs] Contract nextJobId: ${nextJobId} (jobs 1 to ${Number(nextJobId) - 1} exist)`);

  for (let i = 1; i < Number(nextJobId); i++) {
    try {
      const job = await vault.getJob(i);

      // Skip jobs with zero address proposer (shouldn't exist, but safety check)
      if (job.proposer === ethers.ZeroAddress) {
        console.log(`[fetchAllJobs] Skipping job ${i} - no proposer (invalid job)`);
        continue;
      }

      // V2 format: (agentIds[], proposer, createdAt, completed, success)
      jobs.push({
        jobId: BigInt(i),
        agentIds: job.agentIds ? job.agentIds.map((id: bigint) => id) : [],
        strategyType: 0, // V2 uses Universal Executor - type determined by AI
        targetProtocol: ethers.ZeroAddress,
        amount: BigInt(0),
        proposer: job.proposer || ethers.ZeroAddress,
        completed: job.completed || false,
        approved: job.success || false, // V2 uses 'success' instead of 'approved'
        pnlDelta: BigInt(0),
        strategyName: 'Universal Executor', // V2 style
      });
    } catch (e) {
      console.error(`Error fetching job ${i}:`, e);
    }
  }

  console.log(`[fetchAllJobs] Found ${jobs.length} valid jobs on-chain`);
  return jobs;
}

export async function fetchJobById(jobId: number): Promise<StrategyJob | null> {
  const provider = getReadOnlyProvider();
  const vault = new ethers.Contract(STRATEGY_VAULT_ADDRESS, STRATEGY_VAULT_ABI, provider);

  try {
    const job = await vault.getJob(jobId);
    return {
      jobId: BigInt(jobId),
      agentIds: job.agentIds.map((id: bigint) => id),
      strategyType: Number(job.strategyType),
      targetProtocol: job.targetProtocol,
      amount: job.amount,
      proposer: job.proposer,
      completed: job.completed,
      approved: job.approved,
      pnlDelta: job.pnlDelta,
      strategyName: STRATEGY_TYPE_NAMES[Number(job.strategyType)] || 'Unknown',
    };
  } catch (e) {
    console.error(`Error fetching job ${jobId}:`, e);
    return null;
  }
}

// V2.1: Create strategy job with agent IDs and natural language userPrompt
// The AI agent interprets the userPrompt and generates targets, values, calldatas via CRE workflow
export async function createStrategyJob(
  agentIds: bigint[],
  userPrompt: string = "Swap 500 USDC for WETH using Uniswap V3"  // Default for backwards compatibility
): Promise<{ txHash: string; jobId: bigint }> {
  const signer = await getTenderlySigner();
  const vault = await getStrategyVaultContract(signer);

  // Get the expected job ID before creating (for verification)
  const expectedJobId = await getNextJobIdFromContract();
  console.log(`[createStrategyJob] Expected new job ID: ${expectedJobId}`);
  console.log(`[createStrategyJob] User Prompt: "${userPrompt}"`);

  // V2.1: Use requestStrategyJob(uint256[] agentIds, string userPrompt) - raw natural language intent
  const tx = await vault.requestStrategyJob(agentIds, userPrompt);

  const receipt = await tx.wait();
  console.log(`[createStrategyJob] TX confirmed: ${receipt.hash}`);

  // Parse job ID from V2.1 event: StrategyJobCreated(uint256 indexed jobId, address indexed proposer, uint256[] agentIds, string userPrompt)
  const eventTopic = ethers.id("StrategyJobCreated(uint256,address,uint256[],string)");
  const eventLog = receipt.logs.find((log: { topics: string[] }) => log.topics[0] === eventTopic);
  const jobIdFromEvent = eventLog ? BigInt(eventLog.topics[1]) : BigInt(0);

  console.log(`[createStrategyJob] Job ID from event: ${jobIdFromEvent}`);

  // Verify the job actually exists on-chain
  const jobExists = await verifyJobExistsOnChain(Number(jobIdFromEvent));
  if (!jobExists) {
    console.error(`[createStrategyJob] WARNING: Job ${jobIdFromEvent} does not exist on-chain after TX!`);
    throw new Error(`Job creation failed - job ${jobIdFromEvent} not found on-chain. TX may have been simulated but not committed.`);
  }

  // Get the new nextJobId to confirm state changed
  const newNextJobId = await getNextJobIdFromContract();
  console.log(`[createStrategyJob] Contract nextJobId after creation: ${newNextJobId}`);

  if (newNextJobId <= expectedJobId) {
    console.error(`[createStrategyJob] WARNING: nextJobId did not increase! Expected > ${expectedJobId}, got ${newNextJobId}`);
  }

  return { txHash: receipt.hash, jobId: jobIdFromEvent };
}

// V2.1: Create demo scenario job with natural language prompt
// The userPrompt is passed directly to AI agents - protocol agnostic!
export async function createDemoScenarioJob(
  agentIds: bigint[],
  userPrompt: string
): Promise<{ txHash: string; jobId: bigint }> {
  console.log(`Creating demo scenario job with agents [${agentIds.join(', ')}]`);
  console.log(`User Prompt: "${userPrompt}"`);
  return createStrategyJob(agentIds, userPrompt);
}

// =============================================================================
// ACE Policy Functions
// =============================================================================

export async function fetchACEPolicyStatus(address: string): Promise<ACEPolicyStatus> {
  const provider = getReadOnlyProvider();
  const policyEngine = new ethers.Contract(POLICY_ENGINE_ADDRESS, POLICY_ENGINE_ABI, provider);

  const [
    isBlacklisted,
    maxTransactionAmount,
    maxDailyVolume,
    currentDailyVolume,
    remainingDailyVolume
  ] = await Promise.all([
    policyEngine.blacklisted(address),
    policyEngine.maxTransactionAmount(),
    policyEngine.maxDailyVolume(),
    policyEngine.dailyVolume(address),
    policyEngine.getRemainingDailyVolume(address)
  ]);

  return {
    isBlacklisted,
    maxTransactionAmount,
    maxDailyVolume,
    currentDailyVolume,
    remainingDailyVolume
  };
}

export async function checkACEPolicy(address: string, amount: bigint): Promise<{ allowed: boolean; reason: string }> {
  const provider = getReadOnlyProvider();
  const policyEngine = new ethers.Contract(POLICY_ENGINE_ADDRESS, POLICY_ENGINE_ABI, provider);

  try {
    const [allowed, reason] = await policyEngine.checkPolicyView(address, amount);
    return { allowed, reason };
  } catch (e) {
    console.error("Error checking ACE policy:", e);
    return { allowed: false, reason: "Policy check failed" };
  }
}

export async function fetchPolicyLimits(): Promise<{ maxTransaction: bigint; maxDaily: bigint }> {
  const provider = getReadOnlyProvider();
  const policyEngine = new ethers.Contract(POLICY_ENGINE_ADDRESS, POLICY_ENGINE_ABI, provider);

  const [maxTransaction, maxDaily] = await Promise.all([
    policyEngine.maxTransactionAmount(),
    policyEngine.maxDailyVolume()
  ]);

  return { maxTransaction, maxDaily };
}

// =============================================================================
// Formatting Helpers
// =============================================================================

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatStake(stake: bigint): string {
  return ethers.formatEther(stake);
}

export function formatAmount(amount: bigint, decimals: number = 18): string {
  return ethers.formatUnits(amount, decimals);
}

export function parseAmount(amount: string, decimals: number = 18): bigint {
  return ethers.parseUnits(amount, decimals);
}

export function formatReputation(reputation: bigint): string {
  const rep = Number(reputation);
  if (rep > 0) return `+${rep}`;
  return rep.toString();
}
