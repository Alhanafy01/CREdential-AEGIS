// Contract addresses on Tenderly Virtual Mainnet (Phase 9 - V2.1 Protocol-Agnostic)
// V1 Legacy Addresses (deprecated)
export const REGISTRY_ADDRESS_V1 = "0x608f4Ea047470a36Df5BC5D6121A99AC50394a8c";
export const UNIFIED_EXTRACTOR_ADDRESS_V1 = "0x57D6720c8Ace33c4A88b962510812f1fedb507F4";

// V2.1 Protocol-Agnostic Addresses (Natural Language userPrompt)
// Deployed: 2025-03-02
export const REGISTRY_ADDRESS = "0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0";
export const UNIFIED_EXTRACTOR_ADDRESS = "0xe656743F4FdEB085b733bF56EF5777EF3061b150";

// Core Infrastructure
export const STRATEGY_VAULT_ADDRESS = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";
export const POLICY_ENGINE_ADDRESS = "0x33e1B1dA9249a2E4F943128C0E1C627aB5e48d2f";
export const MOCK_KEYSTONE_FORWARDER = "0x948a7CCb238F00CDfe16CfF33c3045A74aa72fcc";

// V2.1 Dual-Token Model
export const LINK_TOKEN_ADDRESS = "0x514910771AF9Ca656af840dff83E8264EcF986CA"; // Mainnet LINK (staking)
export const AEGIS_TOKEN_ADDRESS = "0xBbbf2Db05746734b2Bad7F402b97c6A00d9d38EC"; // AEGIS (rewards)
export const STAKING_TOKEN_ADDRESS = LINK_TOKEN_ADDRESS; // V2: LINK is staking token

// CCIP Configuration
export const CCIP_ROUTER_ADDRESS = "0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D";
export const BASE_CHAIN_SELECTOR = "15971525489660198786"; // Base Mainnet

// RWA Guardian Contracts (Phase 6 - RWA Collateral Vault)
export const RUSD_ADDRESS = "0x311828C55A410c984153448C754EE25E330d8037";
export const RWA_VAULT_ADDRESS = "0x1516AB1339C027841B7343773EDeC8702e91e36B";
export const RWA_EXTRACTOR_ADDRESS = "0x0D325da3c969e0Fd98B0C174598e725FF5b2e97F";

// Flight Insurance Contract (Phase 10 - Insurance Demo)
export const FLIGHT_INSURANCE_ADDRESS = "0x4E84d6394D95bE6d099e78DDD78F538149a02cdA";
export const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

// World ID Configuration
export const WORLD_APP_ID = "app_staging_e1d37a22196cb3e8f2d60f646c15633e";
export const WORLD_ACTION_ID = "credential:agent_registry:v1";

// Network Configuration
export const TENDERLY_CHAIN_ID = "1";
export const TENDERLY_RPC = "https://virtual.mainnet.eu.rpc.tenderly.co/f277af26-9cfb-4ba8-943c-92c32507741e";

// Contract ABIs - Phase 7 V2 Institutional Grade
export const REGISTRY_ABI = [
  // Core registration
  "function registerAgent(string metadataURI, bytes worldIdPayload) external returns (uint256)",
  "function getAgent(uint256 agentId) external view returns (tuple(uint256 agentId, address agentAddress, address owner, bytes32 humanIdHash, bool verified, uint256 stake, int256 reputation, string metadataURI))",
  "function nextAgentId() external view returns (uint256)",

  // V2: LINK Staking
  "function stake(uint256 agentId, uint256 amount) external",
  "function unstake(uint256 agentId, uint256 amount) external",

  // V2: AEGIS Rewards
  "function depositRewards(uint256 amount) external",
  "function getRewardPoolBalance() external view returns (uint256)",

  // V2: Dynamic ACE
  "function getAgentReputation(uint256 agentId) external view returns (int256)",
  "function getAgentStake(uint256 agentId) external view returns (uint256)",

  // V2: CCIP Identity Hub
  "function broadcastAgentIdentity(uint256 agentId, uint64 destinationChainSelector) external",
  "function getCCIPFeeBalance() external view returns (uint256)",

  // View functions
  "function isAgentVerified(uint256 agentId) external view returns (bool)",
  "function getAgentMetadataURI(uint256 agentId) external view returns (string)",
  "function getAgentIdByAddress(address agentAddress) external view returns (uint256)",

  // Token addresses (immutable)
  "function linkToken() external view returns (address)",
  "function aegisToken() external view returns (address)",
  "function ccipRouter() external view returns (address)",

  // Events
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, address agentAddress, string metadataURI, bytes worldIdPayload)",
  "event AgentVerified(uint256 indexed agentId, bytes32 humanIdHash)",
  "event StakeChanged(uint256 indexed agentId, uint256 newStake, bool isIncrease)",
  "event ReputationChanged(uint256 indexed agentId, int256 newReputation, int256 delta)",
  "event AgentSlashed(uint256 indexed agentId, uint256 slashAmount, int256 reputationPenalty)",
  "event AgentRewarded(uint256 indexed agentId, uint256 aegisAmount)",
  "event RewardsDeposited(address indexed funder, uint256 amount)",
  "event CCIPIdentityBroadcast(uint256 indexed agentId, uint64 indexed destinationChain, bytes32 messageId)"
];

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

// StrategyVaultV2 ABI - Protocol-Agnostic Universal Executor (Phase 9 - V2.1)
export const STRATEGY_VAULT_ABI = [
  // V2.1 Protocol-Agnostic Universal Executor - Core Functions
  // userPrompt: Raw natural language intent (e.g., "Swap 500 USDC for WETH using Uniswap V3")
  "function requestStrategyJob(uint256[] agentIds, string userPrompt) external returns (uint256)",

  // ERC-4626 Style Deposit/Withdraw
  "function deposit(uint256 assets) external returns (uint256 shares)",
  "function withdraw(uint256 shares) external returns (uint256 assets)",
  "function previewDeposit(uint256 assets) external view returns (uint256 shares)",
  "function previewRedeem(uint256 shares) external view returns (uint256 assets)",
  "function balanceOf(address user) external view returns (uint256)",
  "function totalAssets() external view returns (uint256)",
  "function totalShares() external view returns (uint256)",
  "function shareBalances(address user) external view returns (uint256)",

  // Job Management
  "function getJob(uint256 jobId) external view returns (uint256[] agentIds, address proposer, uint256 createdAt, bool completed, bool success, string userPrompt)",
  "function getJobUserPrompt(uint256 jobId) external view returns (string)",
  "function isJobCompleted(uint256 jobId) external view returns (bool)",
  "function nextJobId() external view returns (uint256)",

  // Registry Integration
  "function registry() external view returns (address)",
  "function setRegistry(address _registry) external",
  "function asset() external view returns (address)",

  // Events - V2.1 includes userPrompt
  "event StrategyJobCreated(uint256 indexed jobId, address indexed proposer, uint256[] agentIds, string userPrompt)",
  "event UniversalStrategyExecuted(uint256 indexed jobId, address[] targets, bool success)",
  "event CallExecuted(uint256 indexed jobId, uint256 indexed callIndex, address target, uint256 value, bool success)",
  "event Deposit(address indexed user, uint256 assets, uint256 shares)",
  "event Withdraw(address indexed user, uint256 assets, uint256 shares)"
];

// V2 Registry ABI - TrustedAgentRegistryV2 with Report Types
export const REGISTRY_V2_ABI = [
  // Core Registration
  "function registerAgent(string metadataURI, bytes worldIdPayload) external returns (uint256)",
  "function getAgent(uint256 agentId) external view returns (tuple(uint256 agentId, address agentAddress, address owner, bytes32 humanIdHash, bool verified, uint256 stake, int256 reputation, string metadataURI))",
  "function nextAgentId() external view returns (uint256)",

  // LINK Staking
  "function stake(uint256 agentId, uint256 amount) external",
  "function unstake(uint256 agentId, uint256 amount) external",

  // AEGIS Rewards
  "function depositRewards(uint256 amount) external",
  "function getRewardPoolBalance() external view returns (uint256)",

  // Dynamic ACE
  "function getAgentReputation(uint256 agentId) external view returns (int256)",
  "function getAgentStake(uint256 agentId) external view returns (uint256)",
  "function isAgentVerified(uint256 agentId) external view returns (bool)",

  // CRE Report Processing (V2 - Payload Multiplexing)
  "function _processReport(bytes32 workflowExecutionId, address reportSigner, bytes reportContext, bytes report) external",

  // CCIP Identity Hub
  "function broadcastAgentIdentity(uint256 agentId, uint64 destinationChainSelector) external",

  // View Functions
  "function getAgentMetadataURI(uint256 agentId) external view returns (string)",
  "function getAgentIdByAddress(address agentAddress) external view returns (uint256)",

  // Token addresses
  "function linkToken() external view returns (address)",
  "function aegisToken() external view returns (address)",

  // Events
  "event AgentRegistered(uint256 indexed agentId, address indexed owner, address agentAddress, string metadataURI, bytes worldIdPayload)",
  "event AgentVerified(uint256 indexed agentId, bytes32 humanIdHash)",
  "event StakeChanged(uint256 indexed agentId, uint256 newStake, bool isIncrease)",
  "event ReputationChanged(uint256 indexed agentId, int256 newReputation, int256 delta)",
  "event AgentSlashed(uint256 indexed agentId, uint256 slashAmount, int256 reputationPenalty)",
  "event AgentRewarded(uint256 indexed agentId, uint256 aegisAmount)"
];

// RWACollateralVault ABI - CDP with CCIP
export const RWA_VAULT_ABI = [
  // Core CDP functions
  "function deposit() external payable",
  "function borrow(uint256 amount) external",
  "function repay(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  // Guardian job function
  "function requestGuardianJob(uint256[] agentIds) external returns (uint256)",
  "function nextGuardianJobId() external view returns (uint256)",
  // Position view functions
  "function getPosition(address user) external view returns (uint256 collateralETH, uint256 debtRUSD, uint256 healthFactor, uint256 ethPriceUSD)",
  "function getVaultStats() external view returns (uint256 totalCollateral, uint256 totalDebt, uint256 ethPrice, uint256 collateralRatio)",
  "function getHealthFactor(address user) external view returns (uint256)",
  "function getPositionHolders() external view returns (address[])",
  // Price functions
  "function getETHPrice() external view returns (uint256)",
  "function setMockETHPrice(int256 price) external",
  "function setUseMockPrice(bool useMock) external",
  // Config
  "function COLLATERAL_RATIO() external view returns (uint256)",
  "function LIQUIDATION_BONUS() external view returns (uint256)",
  // Events
  "event Deposited(address indexed user, uint256 ethAmount)",
  "event Borrowed(address indexed user, uint256 rusdAmount)",
  "event Repaid(address indexed user, uint256 rusdAmount)",
  "event Withdrawn(address indexed user, uint256 ethAmount)",
  "event Liquidated(address indexed user, uint256 collateralSeized, uint256 debtRepaid, address liquidator)",
  "event CCIPTransferInitiated(address indexed user, uint64 destinationChain, uint256 amount, bytes32 messageId)",
  "event MockPriceSet(int256 price)",
  "event RWAGuardianJobCreated(uint256 indexed jobId, address indexed user, bytes jobData)"
];

// RUSD Token ABI
export const RUSD_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)"
];

// FlightInsurance ABI - Insurance Demo
export const FLIGHT_INSURANCE_ABI = [
  // Policy management
  "function buyPolicy(string flightNumber, uint256 payoutAmount) external returns (uint256)",
  "function processPayout(uint256 policyId) external",
  "function getPolicy(uint256 policyId) external view returns (address user, string flightNumber, uint256 payoutAmount, uint256 premium, uint256 purchaseTime, bool active)",
  "function policyCount() external view returns (uint256)",
  "function getStats() external view returns (uint256 totalPolicies, uint256 totalPremiums, uint256 totalPayouts, uint256 balance)",
  "function universalExecutor() external view returns (address)",
  // Events
  "event PolicyPurchased(uint256 indexed policyId, address indexed user, string flightNumber, uint256 premium, uint256 payout)",
  "event ClaimProcessed(uint256 indexed policyId, address indexed user, uint256 amount)"
];

// SimplePolicyEngine ABI - ACE compliance
export const POLICY_ENGINE_ABI = [
  // Policy check functions
  "function checkPolicy(address caller, uint256 amount) external returns (bool approved, string reason)",
  "function checkPolicyView(address caller, uint256 amount) external view returns (bool approved, string reason)",
  "function isAllowed(address account) external view returns (bool)",
  // State getters
  "function blacklisted(address account) external view returns (bool)",
  "function maxTransactionAmount() external view returns (uint256)",
  "function maxDailyVolume() external view returns (uint256)",
  "function dailyVolume(address account) external view returns (uint256)",
  "function getRemainingDailyVolume(address account) external view returns (uint256)",
  // Admin functions
  "function setBlacklisted(address account, bool status) external",
  "function setVolumeLimits(uint256 maxTransaction, uint256 maxDaily) external",
  // Events
  "event PolicyCheckPassed(address indexed caller, uint256 amount)",
  "event PolicyCheckFailed(address indexed caller, string reason)",
  "event AddressBlacklisted(address indexed account, bool status)",
  "event VolumeLimitsUpdated(uint256 maxTransaction, uint256 maxDaily)"
];

// Strategy types (Legacy - V1)
export const STRATEGY_TYPES = {
  SWAP: 0,
  PROVIDE_LIQUIDITY: 1,
  REMOVE_LIQUIDITY: 2,
  STAKE: 3,
  UNSTAKE: 4,
  LEND: 5,
  BORROW: 6,
  REPAY: 7
} as const;

export const STRATEGY_TYPE_NAMES: { [key: number]: string } = {
  0: 'Swap',
  1: 'Provide Liquidity',
  2: 'Remove Liquidity',
  3: 'Stake',
  4: 'Unstake',
  5: 'Lend',
  6: 'Borrow',
  7: 'Repay'
};

// =============================================================================
// V2 Demo Scenarios (CRE Council Workflow - Universal Executor)
// =============================================================================
export const DEMO_SCENARIOS = {
  SWAP: {
    name: 'Uniswap V3 Swap',
    description: 'USDC to WETH swap via Uniswap V3 (0.05% fee pool)',
    scenarioType: 'SWAP',
    defaultAmount: '1000000000', // 1000 USDC
    expectedOutput: '~0.50 WETH',
    confidence: 95,
    targets: ['USDC', 'UniswapRouter'],
    gasEstimate: 207134
  },
  YIELD: {
    name: 'Aave V3 Yield',
    description: 'Supply USDC to Aave V3 for ~4.2% APY',
    scenarioType: 'YIELD',
    defaultAmount: '5000000000', // 5000 USDC
    expectedOutput: '5000 aUSDC (~210 USDC/year)',
    confidence: 92,
    targets: ['USDC', 'AavePool'],
    gasEstimate: 272193
  },
  ARBITRAGE: {
    name: 'Cross-DEX Arbitrage',
    description: 'Atomic arbitrage between Uniswap V3 and SushiSwap',
    scenarioType: 'ARBITRAGE',
    defaultAmount: '2000000000', // 2000 USDC
    expectedOutput: '~20 USDC profit (MEV protected)',
    confidence: 88,
    targets: ['USDC', 'UniswapRouter', 'SushiRouter'],
    gasEstimate: 190034
  },
  REBALANCE: {
    name: 'Portfolio Rebalance',
    description: 'Rebalance portfolio across multiple assets',
    scenarioType: 'REBALANCE',
    defaultAmount: '10000000000', // 10000 USDC
    expectedOutput: 'Optimal allocation',
    confidence: 90,
    targets: ['USDC', 'WETH', 'DAI'],
    gasEstimate: 350000
  }
} as const;

export type DemoScenarioType = keyof typeof DEMO_SCENARIOS;

// =============================================================================
// ERC-8004 Agent Metadata Schema (trusted-agent-registration-v1)
// =============================================================================
export interface AgentService {
  name: string;           // Service identifier (e.g., "cre-agent", "api", "websocket")
  endpoint: string;       // Full URL to the service endpoint
}

export interface AgentMetadataERC8004 {
  type: 'trusted-agent-registration-v1';
  name: string;
  description: string;
  services: AgentService[];
  specialties?: string[];
}

// Legacy metadata interface (for backward compatibility)
export interface AgentMetadataLegacy {
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  apiEndpoint?: string;
  version: string;
  author: string;
  icon?: string;
}

// Combined metadata type
export type AgentMetadata = AgentMetadataERC8004 | AgentMetadataLegacy;

// Type guard for ERC-8004 metadata
export function isERC8004Metadata(metadata: AgentMetadata): metadata is AgentMetadataERC8004 {
  return (metadata as AgentMetadataERC8004).type === 'trusted-agent-registration-v1';
}

// =============================================================================
// Agent Interface
// =============================================================================
export interface Agent {
  agentId: bigint;
  agentAddress: string;
  owner: string;
  humanIdHash: string;
  verified: boolean;
  stake: bigint;
  reputation: bigint;
  metadataURI: string;
  metadata?: AgentMetadata;
  // Derived fields for UI
  creEndpoint?: string;   // Extracted CRE endpoint from services array
  endpointHealth?: 'online' | 'offline' | 'unknown';
}

// =============================================================================
// Strategy Job Interface
// =============================================================================
export interface StrategyJob {
  jobId: bigint;
  agentIds: bigint[];
  strategyType: number;
  targetProtocol: string;
  amount: bigint;
  proposer: string;
  completed: boolean;
  approved: boolean;
  pnlDelta: bigint;
  // UI metadata
  strategyName?: string;
  createdAt?: number;
  completedAt?: number;
}

// =============================================================================
// ACE Policy Status Interface
// =============================================================================
export interface ACEPolicyStatus {
  isBlacklisted: boolean;
  maxTransactionAmount: bigint;
  maxDailyVolume: bigint;
  currentDailyVolume: bigint;
  remainingDailyVolume: bigint;
  policyCheckResult?: {
    allowed: boolean;
    reason: string;
  };
}

// =============================================================================
// Categories and Constants
// =============================================================================
export const AGENT_CATEGORIES = [
  "DeFi Trading",
  "Yield Optimization",
  "Risk Management",
  "Portfolio Management",
  "Market Analysis",
  "Arbitrage",
  "Liquidation Protection",
  "Other"
];

export const AGENT_SPECIALTIES = [
  "defi",
  "yield-farming",
  "stable-coins",
  "lending",
  "borrowing",
  "market-making",
  "arbitrage",
  "risk-management",
  "portfolio-optimization"
];

// Common DeFi protocol addresses (for strategy creation)
export const DEFI_PROTOCOLS = {
  UNISWAP_V2_ROUTER: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  UNISWAP_V3_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  SUSHISWAP_ROUTER: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
  AAVE_V3_POOL: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  COMPOUND_V3: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
  CURVE_3POOL: "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7"
};

// =============================================================================
// V2 CRE Report Types (Payload Multiplexing)
// =============================================================================
export const CRE_REPORT_TYPES = {
  NONE: 0,       // Invalid
  VERIFY: 1,     // World ID verification + auto CCIP (Workflow 1)
  REPUTATION: 2, // Reputation delta update (Workflow 2)
  SLASH: 3,      // Stake slashing (Workflow 2)
  REWARD: 4      // AEGIS reward distribution (Workflow 2)
} as const;

export const CRE_REPORT_TYPE_NAMES: { [key: number]: string } = {
  0: 'None',
  1: 'Verify (World ID + CCIP)',
  2: 'Reputation Update',
  3: 'Slash Stake',
  4: 'Reward AEGIS'
};

// V2 Workflow Assignment
export const CRE_WORKFLOWS = {
  ONBOARDING: {
    name: 'CRE Onboarding',
    reportTypes: [CRE_REPORT_TYPES.VERIFY],
    description: 'World ID verification with auto CCIP identity broadcast'
  },
  COUNCIL: {
    name: 'CRE Council',
    reportTypes: [CRE_REPORT_TYPES.REPUTATION, CRE_REPORT_TYPES.SLASH, CRE_REPORT_TYPES.REWARD],
    description: 'Reputation, slashing, and reward distribution'
  }
} as const;
