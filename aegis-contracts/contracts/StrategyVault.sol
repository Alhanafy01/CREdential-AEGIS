// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReceiverTemplate} from "./ReceiverTemplate.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ITrustedAgentRegistry
 * @notice Interface for TrustedAgentRegistry verification checks
 */
interface ITrustedAgentRegistry {
    function isAgentVerified(uint256 agentId) external view returns (bool);
    function getAgentMetadataURI(uint256 agentId) external view returns (string memory);
}

/**
 * @title StrategyVault
 * @notice DeFi strategy vault with CRE-powered multi-agent council execution
 * @dev Inherits ReceiverTemplate for secure CRE report reception via Chainlink Forwarder
 *
 * CRITICAL: For Simulation Forwarder testing, do NOT set s_expectedAuthor,
 * s_expectedWorkflowName, or s_expectedWorkflowId - MockKeystoneForwarder
 * does not supply workflow metadata during local testing.
 *
 * AGENT VERIFICATION: Only World ID verified agents from TrustedAgentRegistry
 * can participate in strategy jobs. This ensures human-backed AI agents.
 */
contract StrategyVault is ReceiverTemplate {
    // ============ State Variables ============

    IERC20 public immutable asset;
    address public registry;

    // Strategy types
    uint8 constant STRATEGY_SWAP = 0;
    uint8 constant STRATEGY_PROVIDE_LIQUIDITY = 1;
    uint8 constant STRATEGY_REMOVE_LIQUIDITY = 2;
    uint8 constant STRATEGY_STAKE = 3;
    uint8 constant STRATEGY_UNSTAKE = 4;
    uint8 constant STRATEGY_LEND = 5;
    uint8 constant STRATEGY_BORROW = 6;
    uint8 constant STRATEGY_REPAY = 7;

    struct StrategyJob {
        uint256[] agentIds;
        uint8 strategyType;
        address targetProtocol;
        uint256 amount;
        bytes params;
        address proposer;
        uint256 createdAt;
        bool completed;
        bool approved;
        int256 pnlDelta;
    }

    mapping(uint256 => StrategyJob) public jobs;
    uint256 public nextJobId = 1;

    // ============ Events ============

    // CRE LogTrigger picks this up - simplified to avoid stack issues
    event StrategyJobCreated(
        uint256 indexed jobId,
        address indexed proposer,
        bytes jobData  // ABI-encoded (uint8 strategyType, address targetProtocol, uint256 amount, bytes params, uint256[] agentIds)
    );

    event StrategyJobCompleted(
        uint256 indexed jobId,
        bool approved,
        uint256 totalVotes,
        uint256 approvalCount,
        int256 pnlDelta
    );

    // ============ Errors ============

    error NoAgentsProvided();
    error JobAlreadyCompleted();
    error JobNotFound();
    error AgentNotVerified(uint256 agentId);
    error RegistryNotSet();

    // ============ Constructor ============

    constructor(
        address _forwarder,
        address _asset
    ) ReceiverTemplate(_forwarder) {
        asset = IERC20(_asset);
    }

    // ============ Core Functions ============

    /**
     * @notice Request a strategy job for the AI council
     * @param agentIds Array of verified agent IDs (must be World ID verified)
     * @param strategyType Type of DeFi strategy (0-7)
     * @param targetProtocol Target DeFi protocol address
     * @param amount Amount involved in strategy
     * @param params Additional strategy parameters
     * @dev Validates all agents are verified via TrustedAgentRegistry before creating job
     */
    function requestStrategyJob(
        uint256[] calldata agentIds,
        uint8 strategyType,
        address targetProtocol,
        uint256 amount,
        bytes calldata params
    ) external returns (uint256 jobId) {
        if (agentIds.length == 0) revert NoAgentsProvided();
        if (registry == address(0)) revert RegistryNotSet();

        // Validate ALL agents are World ID verified
        ITrustedAgentRegistry agentRegistry = ITrustedAgentRegistry(registry);
        for (uint256 i = 0; i < agentIds.length; i++) {
            if (!agentRegistry.isAgentVerified(agentIds[i])) {
                revert AgentNotVerified(agentIds[i]);
            }
        }

        jobId = nextJobId++;

        StrategyJob storage job = jobs[jobId];
        job.agentIds = agentIds;
        job.strategyType = strategyType;
        job.targetProtocol = targetProtocol;
        job.amount = amount;
        job.params = params;
        job.proposer = msg.sender;
        job.createdAt = block.timestamp;

        // Encode all data into bytes to avoid stack issues
        bytes memory jobData = abi.encode(
            strategyType,
            targetProtocol,
            amount,
            params,
            agentIds
        );

        emit StrategyJobCreated(jobId, msg.sender, jobData);
    }

    /**
     * @notice Simplified requestStrategyJob (backward compatible)
     * @dev Also validates all agents are verified via TrustedAgentRegistry
     */
    function requestStrategyJob(
        uint256[] calldata agentIds
    ) external returns (uint256 jobId) {
        if (agentIds.length == 0) revert NoAgentsProvided();
        if (registry == address(0)) revert RegistryNotSet();

        // Validate ALL agents are World ID verified
        ITrustedAgentRegistry agentRegistry = ITrustedAgentRegistry(registry);
        for (uint256 i = 0; i < agentIds.length; i++) {
            if (!agentRegistry.isAgentVerified(agentIds[i])) {
                revert AgentNotVerified(agentIds[i]);
            }
        }

        jobId = nextJobId++;

        StrategyJob storage job = jobs[jobId];
        job.agentIds = agentIds;
        job.proposer = msg.sender;
        job.createdAt = block.timestamp;

        bytes memory jobData = abi.encode(
            uint8(0),
            address(0),
            uint256(0),
            bytes(""),
            agentIds
        );

        emit StrategyJobCreated(jobId, msg.sender, jobData);
    }

    /**
     * @notice Process council decision from CRE
     * @param report ABI-encoded (uint256 jobId, bool approved, uint256 totalVotes, uint256 approvalCount)
     */
    function _processReport(bytes calldata report) internal override {
        (
            uint256 jobId,
            bool approved,
            uint256 totalVotes,
            uint256 approvalCount
        ) = abi.decode(report, (uint256, bool, uint256, uint256));

        StrategyJob storage job = jobs[jobId];
        if (job.proposer == address(0)) revert JobNotFound();
        if (job.completed) revert JobAlreadyCompleted();

        job.completed = true;
        job.approved = approved;

        int256 pnlDelta = 0;
        if (approved && job.amount > 0) {
            // Simulate execution results
            pnlDelta = _simulatePnL(job.strategyType, job.amount);
        }
        job.pnlDelta = pnlDelta;

        emit StrategyJobCompleted(jobId, approved, totalVotes, approvalCount, pnlDelta);
    }

    function _simulatePnL(uint8 strategyType, uint256 amount) internal pure returns (int256) {
        if (strategyType == STRATEGY_SWAP) return int256(amount / 100);
        if (strategyType == STRATEGY_PROVIDE_LIQUIDITY) return int256(amount / 200);
        if (strategyType == STRATEGY_STAKE) return int256(amount / 50);
        return 0;
    }

    // ============ View Functions ============

    function getJob(uint256 jobId) external view returns (
        uint256[] memory agentIds,
        uint8 strategyType,
        address targetProtocol,
        uint256 amount,
        address proposer,
        bool completed,
        bool approved,
        int256 pnlDelta
    ) {
        StrategyJob storage job = jobs[jobId];
        return (
            job.agentIds,
            job.strategyType,
            job.targetProtocol,
            job.amount,
            job.proposer,
            job.completed,
            job.approved,
            job.pnlDelta
        );
    }

    function isJobCompleted(uint256 jobId) external view returns (bool) {
        return jobs[jobId].completed;
    }

    // ============ Admin ============

    function setRegistry(address _registry) external onlyOwner {
        registry = _registry;
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }
}
