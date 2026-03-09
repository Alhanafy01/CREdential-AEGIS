# CREdential AEGIS

**Agent Execution, Governance & Identity System**

[![Author](https://img.shields.io/badge/Author-Mahmoud%20Alhanafy-purple)](https://github.com/Alhanafy01)
[![GitHub](https://img.shields.io/badge/GitHub-CREdential--AEGIS-black)](https://github.com/Alhanafy01/CREdential-AEGIS)

A decentralized marketplace for Trusted AI Agents built on Chainlink CRE (Chainlink Runtime Environment).

![AEGIS Architecture](https://img.shields.io/badge/Chainlink-CRE-blue) ![Solidity](https://img.shields.io/badge/Solidity-0.8.24-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

---

### 🎯 Problem Statement
**How do you trust an AI agent with your money?**

Current challenges in AI-powered DeFi:
*   **Sybil Attacks:** One malicious actor can spin up thousands of fake, unaccountable bot agents.
*   **Single Point of Failure:** Trusting a single AI model's judgment is highly risky and prone to hallucinations.
*   **No Accountability:** AI agents have no "skin in the game" if they make a disastrous trade.
*   **MEV Exploitation:** Public AI trading intent gets instantly front-run by MEV bots.
*   **Compliance:** No institutional-grade policy enforcement to stop hacks or interactions with sanctioned wallets.
*   **Hardcoded Limitations:** Traditional smart contracts are rigid and require hardcoded logic for every specific action, preventing true AI autonomy.

### 💡 Solution: AEGIS (Powered by CRE)
AEGIS creates a trustless, institutional-grade execution layer where every step of the agent lifecycle is strictly orchestrated by the **Chainlink Runtime Environment (CRE)**:

| Challenge | AEGIS Solution |
| :--- | :--- |
| **Sybil Attacks** | **World ID "Orb" Verification:** The **CRE `onboarding-workflow`** securely queries the World ID Cloud API off-chain to guarantee every AI agent is registered by a strict, biometric **Orb-verified** human. (One verified human can operate multiple agents, but no agent can exist without human accountability). |
| **Single Point of Failure** | **Multi-Agent Consensus:** The **CRE `council-workflow`** queries 3+ independent agents and runs a deterministic TypeScript callback algorithm to compare responses and enforce a strict majority agreement. |
| **No Accountability** | **LINK Staking & Slashing:** Through **CRE's `evm-write` capability**, AEGIS automatically enforces economic security by rewarding agreeing agents and instantly slashing the staked LINK of any agent that dissents or hallucinates. |
| **MEV Exploitation** | **Confidential Compute:** By utilizing **CRE's `confidential_http` capability**, the AI's complex routing logic is queried inside a secure Trusted Execution Environment (TEE). This creates a "Dark Pool" that prevents information leakage to MEV bots. |
| **Compliance** | **Chainlink ACE Firewall:** Before **CRE** executes the final payload, the data is routed through the Automated Compliance Engine (ACE) to physically block unwhitelisted targets and enforce volume limits. |
| **Hardcoded Limitations** | **Protocol-Agnostic Executor:** **CRE** seamlessly delivers the AI-generated raw execution arrays (`targets[]`, `values[]`, `calldatas[]`) to a Universal Vault, allowing the AI to interact with *any* external DeFi protocol trustlessly. |

***

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AEGIS PROTOCOL                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│  │   World ID  │────▶│  Registry   │────▶│    CRE      │          │
│  │ Verification│     │  (Staking)  │     │  Workflow   │          │
│  └─────────────┘     └─────────────┘     └─────────────┘          │
│                             │                    │                 │
│                             ▼                    ▼                 │
│                      ┌─────────────┐     ┌─────────────┐          │
│                      │   Strategy  │◀────│  AI Agent   │          │
│                      │    Vault    │     │  Consensus  │          │
│                      └─────────────┘     └─────────────┘          │
│                             │                    │                 │
│                             ▼                    ▼                 │
│                      ┌─────────────┐     ┌─────────────┐          │
│                      │   DeFi      │     │   Reward/   │          │
│                      │  Protocols  │     │   Slash     │          │
│                      └─────────────┘     └─────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Project Structure

```
aegis-protocol/
├── aegis-contracts/       # Solidity smart contracts
│   ├── contracts/
│   │   ├── TrustedAgentRegistryV2.sol  # Agent registry with staking
│   │   ├── StrategyVaultV2.sol         # Universal AI executor
│   │   ├── FlightInsurance.sol         # Insurance demo
│   │   └── ...
│   └── scripts/           # Deployment & funding scripts
│
├── aegis-cre/             # Chainlink CRE Workflows
│   ├── council-workflow/  # Multi-agent strategy execution
│   ├── onboarding-workflow/ # World ID verification
│   └── mock-agent-server/ # AI agent simulator
│
└── aegis-frontend/        # Next.js dashboard
    └── src/
        └── app/           # App router pages
```

---

## 🔗 CRE Capabilities Used

| Capability | Usage |
|------------|-------|
| `evmlog` | Trigger workflows on contract events |
| `evm-read` | Read agent verification status |
| `evm-write` | Execute strategies, rewards, slashes |
| `confidential_http` | MEV-protected AI queries |
| **CCIP** | Cross-chain identity broadcast |
| **Data Feeds** | ETH/USD price for calculations |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Tenderly account (for Virtual Testnet)

### 1. Clone & Install

```bash
git clone https://github.com/Alhanafy01/CREdential-AEGIS.git
cd CREdential-AEGIS

# Install contracts dependencies
cd aegis-contracts && npm install

# Install CRE dependencies
cd ../aegis-cre/council-workflow && npm install
cd ../onboarding-workflow && npm install
cd ../mock-agent-server && npm install

# Install frontend dependencies
cd ../../aegis-frontend && npm install
```

### 2. Configure Environment

```bash
# Copy example env files
cp aegis-contracts/.env.example aegis-contracts/.env
cp aegis-cre/.env.example aegis-cre/.env

# Edit with your Tenderly RPC URL and keys
```

### 3. Deploy Contracts

```bash
cd aegis-contracts
npx hardhat run scripts/deploy-all.js --network tenderly
```

### 4. Run Frontend

```bash
cd aegis-frontend
npm run dev
# Open http://localhost:3000
```

---

## 📋 Demo Scenarios

### Scenario 1: Agent Registration & Verification

1. User registers agent with World ID proof
2. CRE workflow verifies identity
3. Agent marked as verified + CCIP broadcast to Base

### Scenario 2: Strategy Execution (Arbitrage)

1. User creates strategy job
2. CRE queries 3 AI agents (confidential HTTP)
3. Agents reach consensus on strategy
4. Universal Executor executes atomically
5. Agreeing agents rewarded, dissenters slashed

### Scenario 3: Insurance Claims

1. User buys flight insurance policy
2. Flight delayed → user submits claim
3. AI agents verify claim validity
4. Consensus reached → automatic payout

---

## 📜 Smart Contracts

| Contract | Description |
|----------|-------------|
| `TrustedAgentRegistryV2` | Agent registration, LINK staking, reputation |
| `StrategyVaultV2` | Universal AI DeFi Executor |
| `FlightInsurance` | Insurance policy & claims |
| `MockKeystoneForwarder` | CRE report delivery (testnet) |
| `SimplePolicyEngine` | ACE compliance validation |

---

## 🛠️ CRE Workflows

### Onboarding Workflow
- **Trigger**: `AgentRegistered` event
- **Action**: Verify World ID, broadcast via CCIP
- **Output**: `AgentVerified` event

### Council Workflow
- **Trigger**: `StrategyJobCreated` event
- **Action**: Query AI agents, build consensus, execute
- **Output**: Strategy execution + reward/slash reports

---

## 🤖 AI Agent Integration Guide

### Required Response Format

AI agents must return a JSON response with `targets[]`, `values[]`, and `calldatas[]` for CRE to execute on-chain:

```json
{
  "targets": [
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "0xe592427a0aece92de3edee1f18e0157c05861564"
  ],
  "values": [
    "0",
    "0"
  ],
  "calldatas": [
    "0x095ea7b3000000000000000000000000e592427a0aece92de3edee1f18e0157c05861564000000000000000000000000000000000000000000000000000000001dcd6500",
    "0x414bf389000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000001f4..."
  ]
}
```

### Field Specifications

| Field | Type | Description |
|-------|------|-------------|
| `targets` | `address[]` | Contract addresses to call (e.g., USDC, Uniswap Router) |
| `values` | `uint256[]` | ETH values to send with each call (usually "0" for token ops) |
| `calldatas` | `bytes[]` | ABI-encoded function calls |

### Example: Uniswap V3 Swap Strategy

```javascript
// AI Agent generates this response for a USDC → WETH swap

const response = {
  // Step 1: Approve USDC, Step 2: Execute swap
  targets: [
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
    "0xe592427a0aece92de3edee1f18e0157c05861564"  // Uniswap V3 SwapRouter
  ],
  values: ["0", "0"],
  calldatas: [
    // approve(spender, amount)
    ethers.utils.defaultAbiCoder.encode(
      ["bytes4", "address", "uint256"],
      ["0x095ea7b3", SWAP_ROUTER, AMOUNT]
    ),
    // exactInputSingle((tokenIn, tokenOut, fee, recipient, deadline, amountIn, amountOutMin, sqrtPriceLimitX96))
    SWAP_ROUTER_INTERFACE.encodeFunctionData("exactInputSingle", [swapParams])
  ]
};
```

### Example: Cross-DEX Arbitrage

```javascript
// AI Agent detects price difference between Uniswap V3 and SushiSwap

const arbitrageResponse = {
  targets: [
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC (approve Uniswap)
    "0xe592427a0aece92de3edee1f18e0157c05861564", // Uniswap V3 (buy WETH)
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH (approve SushiSwap)
    "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f"  // SushiSwap (sell WETH)
  ],
  values: ["0", "0", "0", "0"],
  calldatas: [
    // 1. Approve USDC for Uniswap
    "0x095ea7b3...",
    // 2. Swap USDC → WETH on Uniswap V3 (cheaper)
    "0x414bf389...",
    // 3. Approve WETH for SushiSwap
    "0x095ea7b3...",
    // 4. Swap WETH → USDC on SushiSwap (more expensive)
    "0x38ed1739..."
  ]
};
```

### Example: Insurance Claim Payout

```javascript
// AI Agent verifies flight delay and triggers payout

const claimResponse = {
  targets: [
    "0x4E84d6394D95bE6d099e78DDD78F538149a02cdA"  // FlightInsurance contract
  ],
  values: ["0"],
  calldatas: [
    // processPayout(policyId)
    INSURANCE_INTERFACE.encodeFunctionData("processPayout", [policyId])
  ]
};
```

### CRE Workflow Processing

The CRE Council Workflow processes AI agent responses as follows:

```typescript
// 1. Query multiple agents via confidential_http
const agent1Response = await confidentialHttp(agent1Url, jobData);
const agent2Response = await confidentialHttp(agent2Url, jobData);
const agent3Response = await confidentialHttp(agent3Url, jobData);

// 2. Build consensus (majority agreement)
const consensus = buildConsensus([agent1Response, agent2Response, agent3Response]);

// 3. Encode for StrategyVaultV2
const payload = encodeAbiParameters(
  [
    { name: 'reportType', type: 'uint8' },
    { name: 'targets', type: 'address[]' },
    { name: 'values', type: 'uint256[]' },
    { name: 'calldatas', type: 'bytes[]' }
  ],
  [REPORT_TYPE.EXECUTE, consensus.targets, consensus.values, consensus.calldatas]
);

// 4. Deliver via evm-write to StrategyVaultV2
await evmWrite(STRATEGY_VAULT_ADDRESS, payload);
```

### StrategyVaultV2 Execution

The vault receives the payload and executes atomically:

```solidity
function _executeStrategy(
    address[] memory targets,
    uint256[] memory values,
    bytes[] memory calldatas
) internal {
    for (uint256 i = 0; i < targets.length; i++) {
        (bool success, ) = targets[i].call{value: values[i]}(calldatas[i]);
        require(success, "Strategy execution failed");
    }
    emit StrategyExecuted(currentJobId, targets, true);
}
```

### Protocols Used in Demo

| Protocol | Address | Common Functions |
|----------|---------|------------------|
| **USDC** | `0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48` | `approve`, `transfer` |
| **WETH** | `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2` | `approve`, `deposit`, `withdraw` |
| **Uniswap V3 Router** | `0xe592427a0aece92de3edee1f18e0157c05861564` | `exactInputSingle`, `exactInput` |
| **SushiSwap Router** | `0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f` | `swapExactTokensForTokens` |
| ** FlightInsurance Contract | '0x4E84d6394D95bE6d099e78DDD78F538149a02cdA' | 'FlightInsurance.processPayout(policyId)'|

Our AI Council dynamically generated calldata for the following protocols during our Tenderly Virtual Testnet simulation:
Uniswap (Arbitrage Routing)
SushiSwap (Arbitrage Routing)
Decentralized Flight Insurance (Cross-industry execution)

### Error Handling

AI agents should return error responses when unable to generate a valid strategy:

```json
{
  "error": true,
  "reason": "Insufficient liquidity for requested swap size",
  "targets": [],
  "values": [],
  "calldatas": []
}
```

---

## 🔐 Security Features

- **World ID**: Sybil-resistant identity verification
- **LINK Staking**: Economic security (agents have skin in the game)
- **Multi-Agent Consensus**: No single point of failure
- **Automatic Slashing**: Malicious agents lose stake
- **ACE Policy Engine**: Whitelist/blacklist enforcement
- **Confidential HTTP**: MEV protection for trading intent

---

## 📊 Report Types

| Type | Value | Purpose |
|------|-------|---------|
| VERIFY | 1 | World ID verification |
| REPUTATION | 2 | Reputation delta update |
| SLASH | 3 | Stake slashing |
| REWARD | 4 | AEGIS token distribution |

---

## 🧪 Testing

```bash
cd aegis-contracts
npx hardhat test
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Chainlink CRE](https://chain.link/) - Runtime Environment
- [World ID](https://worldcoin.org/) - Identity verification
- [Tenderly](https://tenderly.co/) - Virtual Testnet infrastructure
- [Uniswap](https://uniswap.org/) - DEX integration
- [SushiSwap](https://sushi.com/) - DEX integration

---

## 🏆 Hackathon Submission

Built for the **Chainlink CRE Hackathon 2025**

**Author**: [Mahmoud Alhanafy](https://github.com/Alhanafy01)

**Repository**: [CREdential-AEGIS](https://github.com/Alhanafy01/CREdential-AEGIS)

**Demo Video**: https://youtu.be/f33ThZqhzFE

**Tenderly logs**: https://virtual.mainnet.eu.rpc.tenderly.co/e88e58fa-94d3-4567-adb3-c018006ef561
** All Contract Addresses (Tenderly Virtual Mainnet)

  Core AEGIS Contracts

  | Contract               | Address                                    |
  |------------------------|--------------------------------------------|
  | TrustedAgentRegistryV2 | 0xDc8739F9f99b276858476B8D2BD15Fa67663B7c0 |
  | StrategyVaultV2        | 0xbE00a41bb943A58Cb17b70Ecc0570Bb02a84A407 |
  | FlightInsurance        | 0x4E84d6394D95bE6d099e78DDD78F538149a02cdA |
  | MockKeystoneForwarder  | 0xa3d1ad4ac559a6575a114998affb2fb2ec97a7d9 |
  | SimplePolicyEngine     | 0xCF2F38772b578A61681DD128EDd5c05cb3872634 |
  | UnifiedExtractor       | 0xe656743F4FdEB085b733bF56EF5777EF3061b150 |

  Tokens

  | Token       | Address                                    |
  |-------------|--------------------------------------------|
  | AEGIS Token | 0xBbbf2Db05746734b2Bad7F402b97c6A00d9d38EC |
  | LINK        | 0x514910771AF9Ca656af840dff83E8264EcF986CA |
  | USDC        | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 |
  | WETH        | 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2 |

  DeFi Protocols

  | Protocol                    | Address
   |
  |-----------------------------|-------------------------------------------
  -|
  | Uniswap V3 SwapRouter       | 0xE592427A0AEce92De3Edee1F18E0157C05861564
   |
  | SushiSwap Router            | 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F
   |
  | Uniswap V3 Pool (USDC/WETH) | 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640
   |
     | SushiSwap Pair (USDC/WETH)  | 0x397ff1542f962076d0bfe58ea045ffa2d347aca0


  Other

  | Name                   | Address                                    |
  |------------------------|--------------------------------------------|
  | Treasury               | 0x1bc3e53dd66BC15a01F14f9e4E43aC9876EEEE7a |
  | Chainlink ETH/USD Feed | 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419 |


