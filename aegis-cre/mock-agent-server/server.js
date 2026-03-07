/**
 * AEGIS Mock Agent Server
 *
 * Provides HTTP endpoints for CRE to:
 * 1. Fetch agent metadata (ERC-8004 pattern) - contains cre-agent endpoint
 * 2. Execute CRE voting decisions via the cre-agent service endpoint
 *
 * This simulates real AI agent APIs that would:
 * - Host their own metadata JSON (or on IPFS)
 * - Analyze market data and return trading decisions
 *
 * Endpoints:
 *   GET  /metadata/:agentId    - Returns ERC-8004 style metadata JSON
 *   POST /cre/decide           - CRE agent decision endpoint (from metadata services)
 *
 * Run: node server.js
 * Default port: 3001
 */

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.use(express.json());

// Agent configuration - Agent 5 is "malicious" for demo (dissents from consensus)
const AGENT_CONFIG = {
  1: {
    name: 'Yield Optimizer Alpha',
    description: 'DeFi yield optimization agent focusing on stable yield strategies',
    bias: 'conservative',
    malicious: false,
    specialties: ['defi', 'yield-farming', 'stable-coins'],
  },
  2: {
    name: 'Risk Manager Beta',
    description: 'Portfolio risk management agent with focus on diversification',
    bias: 'balanced',
    malicious: false,
    specialties: ['defi', 'risk-management', 'portfolio'],
  },
  3: {
    name: 'Arbitrage Hunter',
    description: 'Arbitrage bot - previously malicious, now disabled',
    bias: 'aggressive',
    malicious: false, // Disabled for now
    specialties: ['arbitrage', 'flash-loans'],
  },
  4: {
    name: 'Market Maker Gamma',
    description: 'Automated market making agent for liquidity provision',
    bias: 'neutral',
    malicious: false,
    specialties: ['market-making', 'liquidity'],
  },
  5: {
    name: 'Rogue Trader Epsilon',
    description: 'MALICIOUS: Dissenting agent that returns different calldatas to break consensus',
    bias: 'contrarian',
    malicious: true, // MALICIOUS - will dissent from consensus
    dissenter: true, // Returns DIFFERENT (but valid) response to break consensus
    specialties: ['trading', 'momentum', 'technical-analysis'],
  },
  // Insurance Specialist Agents (7, 8, 9)
  7: {
    name: 'FlightWatch Alpha',
    description: 'AI agent specialized in flight delay/cancellation verification using FlightAware and AviationStack APIs',
    bias: 'conservative',
    malicious: false,
    specialties: ['insurance', 'flight-data', 'verification'],
  },
  8: {
    name: 'ClaimVerifier Beta',
    description: 'AI agent for cross-referencing insurance claims with weather data and airline announcements',
    bias: 'balanced',
    malicious: false,
    specialties: ['insurance', 'claims', 'cross-reference'],
  },
  9: {
    name: 'RiskAssessor Gamma',
    description: 'AI agent for evaluating claim validity and fraud detection in insurance payouts',
    bias: 'conservative',
    malicious: false,
    specialties: ['insurance', 'risk-assessment', 'fraud-detection'],
  },
};

/**
 * Generate ERC-8004 style metadata for agent
 * This is what CRE fetches from metadataURI stored in TrustedAgentRegistry
 */
function generateAgentMetadata(agentId) {
  const config = AGENT_CONFIG[agentId];
  if (!config) return null;

  return {
    type: 'trusted-agent-registration-v1',
    name: `${config.name} #${agentId}`,
    description: config.description,
    services: [
      {
        name: 'cre-agent',
        endpoint: `${BASE_URL}/cre/decide`,  // CRE will POST to this endpoint
      },
    ],
    specialties: config.specialties,
  };
}

/**
 * Generate deterministic agent decision based on agentId and jobId
 * This ensures reproducible results for testing while simulating real agent behavior
 */
function generateAgentDecision(agentId, jobId, strategyType, amount) {
  const config = AGENT_CONFIG[agentId] || AGENT_CONFIG[1];

  // Deterministic seed for reproducibility
  const seed = agentId * 1000 + jobId;

  // Decision based on seed (60% BUY, 25% HOLD, 15% SELL)
  const decisionRoll = seed % 100;
  let decision;
  if (decisionRoll < 60) {
    decision = 'BUY';
  } else if (decisionRoll < 85) {
    decision = 'HOLD';
  } else {
    decision = 'SELL';
  }

  // Confidence varies by agent (70-95%)
  const confidence = 70 + (agentId * 5) % 25;

  // Malicious agents propose excessive amounts (100x) that will fail ACE check
  const proposedAmount = config.malicious
    ? (BigInt(amount) * 100n).toString()
    : amount.toString();

  return {
    agentId: agentId,
    agentName: config.name,
    decision: decision,
    confidence: confidence,
    reasoning: config.malicious
      ? 'YOLO max leverage trade opportunity detected - proposing 100x position'
      : `Market analysis suggests ${decision} based on ${config.bias} strategy indicators`,
    proposedAmount: proposedAmount,
    targetProtocol: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2
    timestamp: Date.now(),
    isMalicious: config.malicious,
  };
}

// =============================================================================
// Health check endpoint
// =============================================================================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'aegis-mock-agent-server', timestamp: Date.now() });
});

// =============================================================================
// Agent Metadata endpoint (ERC-8004 pattern)
// CRE fetches this via HttpCapability to discover the cre-agent service endpoint
// =============================================================================
app.get('/metadata/:agentId', (req, res) => {
  const agentId = parseInt(req.params.agentId);
  console.log(`[Metadata] Request for Agent ${agentId}`);

  const metadata = generateAgentMetadata(agentId);
  if (!metadata) {
    return res.status(404).json({ error: `Agent ${agentId} not found` });
  }

  console.log(`[Metadata] Returning metadata for ${metadata.name}`);
  console.log(`[Metadata] CRE endpoint: ${metadata.services[0].endpoint}`);
  res.json(metadata);
});

// =============================================================================
// CRE Agent Decision endpoint
// This is the endpoint specified in metadata.services[name="cre-agent"].endpoint
// CRE calls this to get voting decisions from agents
// =============================================================================
app.post('/cre/decide', (req, res) => {
  const { agentId, jobId, strategyType, amount } = req.body;
  const parsedAgentId = parseInt(agentId) || 1;

  console.log(`[CRE Decide] Agent ${parsedAgentId} voting on Job ${jobId}`);
  console.log(`  Strategy: ${strategyType}, Amount: ${amount}`);

  if (!AGENT_CONFIG[parsedAgentId]) {
    return res.status(404).json({ error: `Agent ${parsedAgentId} not found` });
  }

  const decision = generateAgentDecision(
    parsedAgentId,
    parseInt(jobId) || 1,
    parseInt(strategyType) || 0,
    amount || '1000000000000000000000'
  );

  console.log(`[CRE Decide] Agent ${parsedAgentId} decision: ${decision.decision} (confidence: ${decision.confidence}%)`);
  if (decision.isMalicious) {
    console.log(`[CRE Decide] ⚠️  MALICIOUS: Proposing excessive amount ${decision.proposedAmount}`);
  }

  res.json(decision);
});

// =============================================================================
// Universal Executor Decision endpoint for council-workflow
// Returns targets[], values[], calldatas[] for the StrategyVaultV2 executor
// Supports multiple strategy types for impressive demo scenarios
// =============================================================================
app.post('/agent/decide', (req, res) => {
  const { jobId, agentIds, agentReputations, vaultBalance, strategyType, scenario, userPrompt, verifiedEthPrice } = req.body;

  // Parse Chainlink ETH/USD price (8 decimals)
  const ethPriceRaw = BigInt(verifiedEthPrice || "0");
  const ethPriceFormatted = Number(ethPriceRaw) / 1e8;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[AI AGENT COUNCIL] Job ${jobId}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Agents: [${agentIds?.join(', ')}]`);
  console.log(`  Strategy: ${strategyType}`);
  console.log(`  User Prompt: ${userPrompt || 'Not provided'}`);
  console.log(`  Scenario: ${scenario || 'SWAP'}`);
  console.log(`  Vault Balance: ${vaultBalance}`);
  console.log(`  Chainlink ETH/USD: $${ethPriceFormatted.toFixed(2)} (verified on-chain)`);

  // Use the first verified agent as the proposer
  const proposingAgentId = agentIds?.[0] || "1";

  // Mainnet addresses
  const ADDRESSES = {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    DAI: "0x6B175474E89094C44Da98b954EescdeCB5BE1B22",
    UNISWAP_V3_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    AAVE_POOL: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    SUSHI_ROUTER: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
  };
  const VAULT_ADDRESS = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407"; // V2.1

  let response;
  const scenarioType = scenario || strategyType || 'SWAP';

  // =========================================================================
  // SCENARIO: YIELD - Supply to Aave V3 for yield
  // =========================================================================
  if (scenarioType === 'YIELD' || scenarioType === 'AAVE_SUPPLY') {
    const supplyAmount = BigInt("5000000000"); // 5000 USDC
    const supplyAmountHex = supplyAmount.toString(16).padStart(64, '0');

    // Approve USDC for Aave Pool
    const approveCalldata = "0x095ea7b3" +
      "00000000000000000000000087870bca3f3fd6335c3f4ce8392d69350b4fa4e2" +
      supplyAmountHex;

    // Aave supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)
    // selector: 0x617ba037
    const supplyCalldata = "0x617ba037" +
      "000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" + // asset: USDC
      supplyAmountHex +                                                       // amount
      "000000000000000000000000" + VAULT_ADDRESS.slice(2).toLowerCase() +     // onBehalfOf: vault
      "0000000000000000000000000000000000000000000000000000000000000000";      // referralCode: 0

    response = {
      targets: [ADDRESSES.USDC, ADDRESSES.AAVE_POOL],
      values: ["0", "0"],
      calldatas: [approveCalldata, supplyCalldata],
      agentId: proposingAgentId,
      confidence: 92,
      reasoning: "AI Analysis: Aave V3 USDC Supply APY at 4.2% - optimal risk-adjusted yield. Protocol safety rating: AAA. Supplying 5,000 USDC for passive yield generation."
    };

    console.log(`\n  [AI DECISION] YIELD STRATEGY`);
    console.log(`    Protocol: Aave V3`);
    console.log(`    Action: Supply 5,000 USDC`);
    console.log(`    Expected APY: 4.2%`);
    console.log(`    Confidence: 92%`);

  // =========================================================================
  // SCENARIO: CROSS_DEX_ARBITRAGE - Full 4-step cross-DEX atomic arbitrage
  // Triggered by: userPrompt containing "arbitrage" or "cross-dex" or scenario=CROSS_DEX_ARBITRAGE
  // Route: 2000 USDC -> WETH (UniV3 @ $2000) -> USDC (SushiV2 @ $2200)
  // Expected profit: ~10% (~200 USDC)
  // =========================================================================
  } else if (scenarioType === 'CROSS_DEX_ARBITRAGE' || scenarioType === 'ARBITRAGE' || scenarioType === 'ARB' ||
             (userPrompt && (userPrompt.toLowerCase().includes('arbitrage') ||
                            userPrompt.toLowerCase().includes('cross-dex')))) {

    // Use ethers-generated calldata for correctness (identical to /agent/:agentId/decide)

    // Step 1: Approve 2000 USDC for Uniswap V3 Router
    const step1 = "0x095ea7b3000000000000000000000000e592427a0aece92de3edee1f18e0157c058615640000000000000000000000000000000000000000000000000000000077359400";

    // Step 2: Swap 2000 USDC -> WETH on Uniswap V3 (exactInputSingle)
    // At $2000/ETH, expect ~1 WETH
    const step2 = "0x414bf389000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000001f4000000000000000000000000be00a41bb943a58cb17b70ecc0570bb02a84a4070000000000000000000000000000000000000000000000000000000070dbd880000000000000000000000000000000000000000000000000000000007735940000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

    // Step 3: Approve max WETH for SushiSwap V2 Router
    const step3 = "0x095ea7b3000000000000000000000000d9e1ce17f2641f24ae83637ab66a2cca9c378b9fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

    // Step 4: Swap 0.99 WETH -> USDC on SushiSwap V2 (safe amount we're sure to have)
    // At $2200/ETH on Sushi, 0.99 WETH gives ~2178 USDC (profit: ~178 USDC)
    const step4 = "0x38ed17390000000000000000000000000000000000000000000000000dbd2fc137a30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000be00a41bb943a58cb17b70ecc0570bb02a84a4070000000000000000000000000000000000000000000000000000000070dbd8800000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

    response = {
      targets: [
        ADDRESSES.USDC,              // Step 1: Approve USDC
        ADDRESSES.UNISWAP_V3_ROUTER, // Step 2: Swap on UniV3
        ADDRESSES.WETH,              // Step 3: Approve WETH
        ADDRESSES.SUSHI_ROUTER       // Step 4: Swap on SushiV2
      ],
      values: ["0", "0", "0", "0"],
      calldatas: [step1, step2, step3, step4],
      agentId: proposingAgentId,
      confidence: 99,
      reasoning: `Cross-DEX Arbitrage Detected! Chainlink ETH/USD at $${ethPriceFormatted.toFixed(2)}. Route: 2000 USDC -> 0.99 WETH (Uniswap V3 @ $2000) -> ~2178 USDC (SushiSwap V2 @ $2200). Expected ~9% profit from price discrepancy. MEV protected via CRE confidential_http.`
    };

    console.log(`\n  [AI DECISION] CROSS-DEX ARBITRAGE (4-Step)`);
    console.log(`    Chainlink ETH/USD: $${ethPriceFormatted.toFixed(2)}`);
    console.log(`    Input: 2,000 USDC`);
    console.log(`    Step 2: Swap 2000 USDC -> ~0.999 WETH on UniV3`);
    console.log(`    Step 4: Swap 0.99 WETH -> ~2178 USDC on SushiV2`);
    console.log(`    Expected Profit: ~178 USDC (9%)`);
    console.log(`    Targets: ${response.targets.length} contracts`);
    console.log(`    MEV Protection: CRE confidential_http`);
    console.log(`    Confidence: 99%`);

  // =========================================================================
  // SCENARIO: REBALANCE - Portfolio rebalancing
  // =========================================================================
  } else if (scenarioType === 'REBALANCE') {
    const rebalanceAmount = BigInt("3000000000"); // 3000 USDC
    const rebalanceAmountHex = rebalanceAmount.toString(16).padStart(64, '0');
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const deadlineHex = deadline.toString(16).padStart(64, '0');

    // Diversify: 50% to WETH
    const approveCalldata = "0x095ea7b3" +
      "000000000000000000000000e592427a0aece92de3edee1f18e0157c05861564" +
      rebalanceAmountHex;

    const swapCalldata = "0x414bf389" +
      "000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" +
      "000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" +
      "00000000000000000000000000000000000000000000000000000000000001f4" +
      "000000000000000000000000" + VAULT_ADDRESS.slice(2).toLowerCase() +
      deadlineHex +
      rebalanceAmountHex +
      "0000000000000000000000000000000000000000000000000000000000000000" +
      "0000000000000000000000000000000000000000000000000000000000000000";

    response = {
      targets: [ADDRESSES.USDC, ADDRESSES.UNISWAP_V3_ROUTER],
      values: ["0", "0"],
      calldatas: [approveCalldata, swapCalldata],
      agentId: proposingAgentId,
      confidence: 90,
      reasoning: `AI Portfolio Analysis: Current allocation 100% USDC - suboptimal. Rebalancing to 70/30 USDC/WETH at Chainlink-verified ETH price of $${ethPriceFormatted.toFixed(2)}. ETH showing bullish momentum indicators.`
    };

    console.log(`\n  [AI DECISION] REBALANCE STRATEGY`);
    console.log(`    Current: 100% USDC`);
    console.log(`    Target: 70% USDC / 30% WETH`);
    console.log(`    Action: Swap 3,000 USDC to WETH`);
    console.log(`    Chainlink ETH/USD: $${ethPriceFormatted.toFixed(2)}`);
    console.log(`    Confidence: 90%`);

  // =========================================================================
  // SCENARIO: BLACKLIST_TEST - Tests ACE blacklist policy
  // Returns Tornado Cash address to test ACE policy enforcement
  // Triggered by: userPrompt containing "tornado" or "blacklist" or scenario=BLACKLIST_TEST
  // =========================================================================
  } else if (scenarioType === 'BLACKLIST_TEST' ||
             (userPrompt && (userPrompt.toLowerCase().includes('tornado') ||
                            userPrompt.toLowerCase().includes('blacklist')))) {
    // Tornado Cash - OFAC sanctioned, should be blocked by ACE blacklist
    const TORNADO_CASH = "0x8589427373D6D84E98730D7795D8f6f8731FDA16";

    response = {
      targets: [TORNADO_CASH],
      values: ["100000000000000000"], // 0.1 ETH
      calldatas: ["0x"], // Empty call
      agentId: proposingAgentId,
      confidence: 99,
      reasoning: "MALICIOUS: Attempting to interact with Tornado Cash - a sanctioned address. This should be blocked by ACE blacklist policy."
    };

    console.log(`\n  [AI DECISION] BLACKLIST TEST (MALICIOUS)`);
    console.log(`    Target: Tornado Cash (OFAC sanctioned)`);
    console.log(`    Address: ${TORNADO_CASH}`);
    console.log(`    Action: Transfer 0.1 ETH`);
    console.log(`    Expected: BLOCKED by ACE Policy Engine`);
    console.log(`    Confidence: 99% (malicious)`);

  // =========================================================================
  // SCENARIO: FLIGHT_INSURANCE - Process insurance claim payout
  // Triggered by: userPrompt containing "flight" or "policy" or "insurance" or "claim"
  // Target: FlightInsurance contract (already deployed and whitelisted in ACE)
  // =========================================================================
  } else if (scenarioType === 'FLIGHT_INSURANCE' || scenarioType === 'INSURANCE' ||
             (userPrompt && (userPrompt.toLowerCase().includes('flight') ||
                            userPrompt.toLowerCase().includes('policy') ||
                            userPrompt.toLowerCase().includes('insurance') ||
                            userPrompt.toLowerCase().includes('claim')))) {
    // FlightInsurance contract address (deployed and whitelisted in ACE)
    const FLIGHT_INSURANCE = "0x4E84d6394D95bE6d099e78DDD78F538149a02cdA";

    // Parse policy ID from prompt like "Policy #2" or "Policy #1"
    const promptLower = (userPrompt || '').toLowerCase();
    const policyMatch = promptLower.match(/policy\s*#?(\d+)/i);
    const policyId = policyMatch ? parseInt(policyMatch[1]) : 2; // default to 2

    // processPayout(uint256 policyId) selector = 0x89ee68bf (correct selector)
    const policyIdHex = policyId.toString(16).padStart(64, '0');
    const processPayoutCalldata = "0x89ee68bf" + policyIdHex;

    response = {
      targets: [FLIGHT_INSURANCE],
      values: ["0"],
      calldatas: [processPayoutCalldata],
      agentId: proposingAgentId,
      confidence: 99,
      reasoning: `Flight cancellation verified via off-chain audit (FlightAware API, AviationStack). Cross-referenced with weather data and airline announcements. Claim valid - instructing Universal Executor to trigger processPayout on FlightInsurance contract for Policy #${policyId}.`
    };

    console.log(`\n  [AI DECISION] FLIGHT INSURANCE CLAIM`);
    console.log(`    Contract: FlightInsurance (${FLIGHT_INSURANCE})`);
    console.log(`    Action: processPayout(${policyId})`);
    console.log(`    Policy #${policyId} extracted from prompt`);
    console.log(`    Verification: FlightAware + AviationStack APIs`);
    console.log(`    Confidence: 99%`);

  // =========================================================================
  // DEFAULT SCENARIO: SWAP - Uniswap V3 swap (real DeFi action)
  // Includes USDC approval + swap in atomic execution
  // =========================================================================
  } else {
    const balance = BigInt(vaultBalance || "0");
    let swapAmount = balance / 10n;
    const maxSwap = BigInt("500000000"); // 500 USDC
    if (swapAmount > maxSwap) swapAmount = maxSwap;
    if (swapAmount === 0n) swapAmount = maxSwap;

    const swapAmountHex = swapAmount.toString(16).padStart(64, '0');
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const deadlineHex = deadline.toString(16).padStart(64, '0');

    // Step 1: Approve USDC for Uniswap V3 Router
    const approveCalldata = "0x095ea7b3" +
      "000000000000000000000000e592427a0aece92de3edee1f18e0157c05861564" + // spender: Uniswap V3 Router
      swapAmountHex;                                                         // amount

    // Step 2: Uniswap V3 exactInputSingle swap
    // ExactInputSingleParams struct: tokenIn, tokenOut, fee, recipient, deadline, amountIn, amountOutMinimum, sqrtPriceLimitX96
    // Struct is packed directly (no offset pointer needed)
    const swapCalldata = "0x414bf389" +
      "000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" + // tokenIn: USDC
      "000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" + // tokenOut: WETH
      "00000000000000000000000000000000000000000000000000000000000001f4" + // fee: 500 (0.05%)
      "000000000000000000000000" + VAULT_ADDRESS.slice(2).toLowerCase() +    // recipient: vault
      deadlineHex +                                                           // deadline
      swapAmountHex +                                                         // amountIn
      "0000000000000000000000000000000000000000000000000000000000000000" +    // amountOutMinimum: 0
      "0000000000000000000000000000000000000000000000000000000000000000";     // sqrtPriceLimitX96: 0

    response = {
      targets: [ADDRESSES.USDC, ADDRESSES.UNISWAP_V3_ROUTER],
      values: ["0", "0"],
      calldatas: [approveCalldata, swapCalldata],
      agentId: proposingAgentId,
      confidence: 95,
      reasoning: `Optimal route: USDC -> WETH via Uniswap V3 0.05% pool. Swapping ${Number(swapAmount) / 1e6} USDC at Chainlink-verified ETH price of $${ethPriceFormatted.toFixed(2)}. Highest liquidity and lowest slippage.`
    };

    console.log(`\n  [AI DECISION] SWAP STRATEGY`);
    console.log(`    Route: USDC -> WETH`);
    console.log(`    DEX: Uniswap V3 (0.05% fee tier)`);
    console.log(`    Amount: ${Number(swapAmount) / 1e6} USDC`);
    console.log(`    Chainlink ETH/USD: $${ethPriceFormatted.toFixed(2)}`);
    console.log(`    Operations: Approve + Swap (atomic)`);
    console.log(`    Confidence: 95%`);
  }

  console.log(`\n  Targets: ${response.targets.length} contracts`);
  console.log(`  Calldatas: ${response.calldatas.length} operations`);
  console.log(`${'='.repeat(60)}\n`);

  res.json(response);
});

// =============================================================================
// Per-Agent Decision endpoint for Multi-Agent Consensus (v2.2)
// CRE queries each agent INDIVIDUALLY via confidential_http
// Supports multiple scenarios: SWAP, ARBITRAGE, YIELD, BLACKLIST_TEST
// Returns strict deterministic JSON: {agentId, targets, values, calldatas, confidence}
// =============================================================================
app.post('/agent/:agentId/decide', (req, res) => {
  const agentId = parseInt(req.params.agentId);
  const { jobId, userPrompt, vaultBalance } = req.body;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[AGENT ${agentId}] Processing Job ${jobId} (Multi-Agent Consensus)`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Prompt: ${userPrompt || 'Not provided'}`);
  console.log(`  Vault Balance: ${vaultBalance}`);

  const config = AGENT_CONFIG[agentId];
  if (!config) {
    return res.status(404).json({ error: `Agent ${agentId} not found` });
  }

  // Mainnet addresses (whitelisted in ACE)
  const ADDRESSES = {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    UNISWAP_V3_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    SUSHI_ROUTER: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
    AAVE_POOL: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  };
  const VAULT_ADDRESS = "0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407";

  // Malicious/Dissenting agent returns DIFFERENT (but valid) response to break consensus
  if (config.malicious || config.dissenter) {
    console.log(`  ⚠️  DISSENTING AGENT - Returning DIFFERENT calldatas to break consensus`);

    // Return a valid swap but with DIFFERENT amount (1000 USDC instead of 500 USDC)
    // This will cause consensus failure because calldatas don't match
    const dissenterAmount = BigInt("1000000000"); // 1000 USDC (different from 500 USDC)
    const dissenterAmountHex = dissenterAmount.toString(16).padStart(64, '0');
    // Use same deterministic deadline
    const deadline = 1893456000;
    const deadlineHex = deadline.toString(16).padStart(64, '0');

    // Step 1: Approve DIFFERENT amount for Uniswap V3 Router
    const approveCalldata = "0x095ea7b3" +
      "000000000000000000000000e592427a0aece92de3edee1f18e0157c05861564" +
      dissenterAmountHex;

    // Step 2: Swap DIFFERENT amount on Uniswap V3
    const swapCalldata = "0x414bf389" +
      "000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" +
      "000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" +
      "00000000000000000000000000000000000000000000000000000000000001f4" +
      "000000000000000000000000be00a41bb943a58cb17b70ecc0570bb02a84a407" +
      deadlineHex +
      dissenterAmountHex + // DIFFERENT: 1000 USDC instead of 500 USDC
      "0000000000000000000000000000000000000000000000000000000000000000" +
      "0000000000000000000000000000000000000000000000000000000000000000";

    const response = {
      agentId: agentId,
      targets: [ADDRESSES.USDC, ADDRESSES.UNISWAP_V3_ROUTER],
      values: ["0", "0"],
      calldatas: [approveCalldata, swapCalldata],
      confidence: 0.95
    };

    console.log(`  Response: DISSENT (swapping 1000 USDC instead of 500 USDC)`);
    console.log(`  This will break consensus with agents 1 & 2 (who swap 500 USDC)`);
    console.log(`${'='.repeat(60)}\n`);
    return res.json(response);
  }

  // Parse the user prompt to determine scenario
  const prompt = (userPrompt || '').toLowerCase();
  // Use DETERMINISTIC deadline for consensus (all agents must return identical calldata)
  // Fixed timestamp far in the future: Jan 1, 2030 00:00:00 UTC
  const deadline = 1893456000;
  const deadlineHex = deadline.toString(16).padStart(64, '0');

  let response;

  // =========================================================================
  // SCENARIO: CROSS-DEX ARBITRAGE - Full 4-step atomic arbitrage
  // Route: 2000 USDC -> WETH (UniV3 @ $2000) -> USDC (SushiV2 @ $2200)
  // FIX: Use 0.99 WETH in step 4 (we receive ~0.999 WETH, so 0.99 is safe)
  // =========================================================================
  if (prompt.includes('arbitrage') || prompt.includes('cross-dex')) {
    // Step 1: Approve 2000 USDC for Uniswap V3 Router
    const step1 = "0x095ea7b3000000000000000000000000e592427a0aece92de3edee1f18e0157c058615640000000000000000000000000000000000000000000000000000000077359400";

    // Step 2: Swap 2000 USDC -> WETH on Uniswap V3 (exactInputSingle)
    // At $2000/ETH, receive ~0.999 WETH after fees
    const step2 = "0x414bf389000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000001f4000000000000000000000000be00a41bb943a58cb17b70ecc0570bb02a84a4070000000000000000000000000000000000000000000000000000000070dbd880000000000000000000000000000000000000000000000000000000007735940000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

    // Step 3: Approve max WETH for SushiSwap V2 Router
    const step3 = "0x095ea7b3000000000000000000000000d9e1ce17f2641f24ae83637ab66a2cca9c378b9fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

    // Step 4: Swap 0.99 WETH -> USDC on SushiSwap V2 (safe amount we're sure to have)
    // At $2200/ETH on Sushi, 0.99 WETH gives ~2178 USDC (profit: ~178 USDC)
    const step4 = "0x38ed17390000000000000000000000000000000000000000000000000dbd2fc137a30000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000be00a41bb943a58cb17b70ecc0570bb02a84a4070000000000000000000000000000000000000000000000000000000070dbd8800000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

    response = {
      agentId: agentId,
      targets: [ADDRESSES.USDC, ADDRESSES.UNISWAP_V3_ROUTER, ADDRESSES.WETH, ADDRESSES.SUSHI_ROUTER],
      values: ["0", "0", "0", "0"],
      calldatas: [step1, step2, step3, step4],
      confidence: 0.99
    };

    console.log(`  Decision: 4-STEP CROSS-DEX ARBITRAGE`);
    console.log(`    Input: 2000 USDC`);
    console.log(`    Step 1: Approve USDC for UniV3`);
    console.log(`    Step 2: Swap 2000 USDC -> ~0.999 WETH on UniV3 @ ~$2000`);
    console.log(`    Step 3: Approve WETH for SushiV2`);
    console.log(`    Step 4: Swap 0.99 WETH -> ~2178 USDC on SushiV2 @ ~$2200`);
    console.log(`    Expected Profit: ~178 USDC (9%)`);
    console.log(`  Targets: ${response.targets.length} contracts`);

  // =========================================================================
  // SCENARIO: FLIGHT INSURANCE - Process insurance claim payout
  // Agents 7, 8, 9 handle insurance claims
  // =========================================================================
  } else if (prompt.includes('flight') || prompt.includes('policy') ||
             prompt.includes('insurance') || prompt.includes('claim')) {
    // FlightInsurance contract address (deployed and whitelisted in ACE)
    const FLIGHT_INSURANCE = "0x4E84d6394D95bE6d099e78DDD78F538149a02cdA";

    // processPayout(uint256 policyId) - extract policyId from prompt or default to 2
    // Parse policy ID from prompt like "Policy #2" or "Policy #1"
    const policyMatch = prompt.match(/policy\s*#?(\d+)/i);
    const policyId = policyMatch ? parseInt(policyMatch[1]) : 2; // default to 2

    // processPayout(uint256 policyId) selector = 0x89ee68bf (correct selector)
    const policyIdHex = policyId.toString(16).padStart(64, '0');
    const processPayoutCalldata = "0x89ee68bf" + policyIdHex;

    response = {
      agentId: agentId,
      targets: [FLIGHT_INSURANCE],
      values: ["0"],
      calldatas: [processPayoutCalldata],
      confidence: 0.99
    };

    console.log(`  Decision: FLIGHT INSURANCE CLAIM`);
    console.log(`    Contract: FlightInsurance`);
    console.log(`    Action: processPayout(policyId=${policyId})`);
    console.log(`    Extracted from prompt: "${prompt}"`);
    console.log(`  Targets: ${response.targets.length} contract`);

  // =========================================================================
  // SCENARIO: DEFAULT SWAP (2-step)
  // =========================================================================
  } else {
    const swapAmount = BigInt("500000000"); // 500 USDC
    const swapAmountHex = swapAmount.toString(16).padStart(64, '0');

    // Step 1: Approve USDC for Uniswap V3 Router
    const approveCalldata = "0x095ea7b3" +
      "000000000000000000000000e592427a0aece92de3edee1f18e0157c05861564" +
      swapAmountHex;

    // Step 2: Swap USDC -> WETH on Uniswap V3
    const swapCalldata = "0x414bf389" +
      "000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" +
      "000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" +
      "00000000000000000000000000000000000000000000000000000000000001f4" +
      "000000000000000000000000" + VAULT_ADDRESS.slice(2).toLowerCase() +
      deadlineHex +
      swapAmountHex +
      "0000000000000000000000000000000000000000000000000000000000000000" +
      "0000000000000000000000000000000000000000000000000000000000000000";

    response = {
      agentId: agentId,
      targets: [ADDRESSES.USDC, ADDRESSES.UNISWAP_V3_ROUTER],
      values: ["0", "0"],
      calldatas: [approveCalldata, swapCalldata],
      confidence: 0.95 - (agentId * 0.01) // Slight variation in confidence
    };

    console.log(`  Decision: APPROVE + SWAP ${Number(swapAmount) / 1e6} USDC -> WETH`);
    console.log(`  Targets: ${response.targets.length} contracts`);
  }

  console.log(`  Confidence: ${(response.confidence * 100).toFixed(1)}%`);
  console.log(`${'='.repeat(60)}\n`);

  res.json(response);
});

// =============================================================================
// Legacy endpoints (backward compatibility)
// =============================================================================
app.post('/agent/:agentId/vote', (req, res) => {
  const agentId = parseInt(req.params.agentId);
  const { jobId, strategyType, amount } = req.body;

  console.log(`[Legacy] Agent ${agentId} vote request for Job ${jobId}`);

  if (!AGENT_CONFIG[agentId]) {
    return res.status(404).json({ error: `Agent ${agentId} not found` });
  }

  const decision = generateAgentDecision(
    agentId,
    parseInt(jobId) || 1,
    parseInt(strategyType) || 0,
    amount || '1000000000000000000000'
  );

  res.json(decision);
});

app.get('/agent/:agentId/vote', (req, res) => {
  const agentId = parseInt(req.params.agentId);
  const jobId = parseInt(req.query.jobId) || 1;
  const strategyType = parseInt(req.query.strategyType) || 0;
  const amount = req.query.amount || '1000000000000000000000';

  if (!AGENT_CONFIG[agentId]) {
    return res.status(404).json({ error: `Agent ${agentId} not found` });
  }

  const decision = generateAgentDecision(agentId, jobId, strategyType, amount);
  res.json(decision);
});

// List all agents with their metadata URIs
app.get('/agents', (req, res) => {
  const agents = Object.entries(AGENT_CONFIG).map(([id, config]) => ({
    agentId: parseInt(id),
    name: config.name,
    description: config.description,
    malicious: config.malicious,
    metadataURI: `${BASE_URL}/metadata/${id}`,
  }));
  res.json(agents);
});

// =============================================================================
// Start server
// =============================================================================
app.listen(PORT, () => {
  console.log('='.repeat(70));
  console.log('AEGIS Mock Agent Server (ERC-8004 Pattern)');
  console.log('='.repeat(70));
  console.log(`Server running on ${BASE_URL}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  GET  /health              - Health check`);
  console.log(`  GET  /agents              - List all agents with metadata URIs`);
  console.log(`  GET  /metadata/:id        - Get agent metadata (ERC-8004 format)`);
  console.log(`  POST /cre/decide          - CRE agent decision endpoint`);
  console.log('');
  console.log('Agent Configuration:');
  Object.entries(AGENT_CONFIG).forEach(([id, config]) => {
    const status = config.malicious ? '⚠️  MALICIOUS' : '✓ Good';
    console.log(`  Agent ${id}: ${config.name} [${status}]`);
    console.log(`           Metadata: ${BASE_URL}/metadata/${id}`);
  });
  console.log('');
  console.log('Workflow:');
  console.log('  1. CRE reads metadataURI from TrustedAgentRegistry via callContract');
  console.log('  2. CRE fetches metadata JSON from GET /metadata/:agentId');
  console.log('  3. CRE parses services array to find cre-agent endpoint');
  console.log('  4. CRE calls POST /cre/decide with voting context');
  console.log('='.repeat(70));
});
