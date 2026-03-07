// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IACEExtractor
 * @notice Interface for Chainlink ACE (Automation Condition Evaluation) extractors
 * @dev Extractors parse calldata to route to appropriate policy checks
 */
interface IACEExtractor {
    function extract(bytes calldata callData) external view returns (bytes memory);
}

/**
 * @title ITrustedAgentRegistry
 * @notice Interface to query agent reputation from the registry
 */
interface ITrustedAgentRegistry {
    function getAgentReputation(uint256 agentId) external view returns (int256);
    function getAgentStake(uint256 agentId) external view returns (uint256);
    function isAgentVerified(uint256 agentId) external view returns (bool);
    function getAgentIdByAddress(address agentAddress) external view returns (uint256);
}

/**
 * @title UnifiedExtractorV2
 * @notice ACE Extractor with dynamic agent reputation appending
 * @dev V2 Features:
 *   - Queries TrustedAgentRegistryV2 for agent reputation
 *   - Appends reputation scores to ACE payloads for contextual policy evaluation
 *   - Supports Professor Dawn Song's "contextual security policies"
 *
 * Routing Logic:
 * - registerAgent() -> Identity Policy (World ID verification)
 * - requestStrategyJob() -> Financial Policy with agent reputations
 * - executeStrategy() -> Financial Policy with caller reputation
 */
contract UnifiedExtractorV2 is IACEExtractor {
    // ============ State Variables ============

    /// @notice The TrustedAgentRegistryV2 contract for reputation queries
    ITrustedAgentRegistry public immutable registry;

    // ============ Policy Types ============

    enum PolicyType {
        NONE,
        IDENTITY,   // World ID / identity verification
        FINANCIAL   // Volume limits / blacklist checks + reputation
    }

    // ============ Function Selectors ============

    // TrustedAgentRegistry functions -> Identity Policy
    bytes4 constant REGISTER_AGENT_SELECTOR = bytes4(keccak256("registerAgent(string,bytes)"));

    // StrategyVault functions -> Financial Policy
    bytes4 constant REQUEST_STRATEGY_JOB_SELECTOR = bytes4(keccak256("requestStrategyJob(uint256[])"));
    bytes4 constant REQUEST_STRATEGY_JOB_FULL_SELECTOR = bytes4(keccak256("requestStrategyJob(uint256[],uint8,address,uint256,bytes)"));
    bytes4 constant EXECUTE_STRATEGY_SELECTOR = bytes4(keccak256("executeStrategy(address,uint256,bytes)"));

    // ============ Events ============

    event ExtractionRouted(bytes4 indexed selector, PolicyType policyType);
    event ReputationAppended(uint256 indexed agentId, int256 reputation);

    // ============ Errors ============

    error UnsupportedSelector(bytes4 selector);
    error InvalidCallData();

    // ============ Constructor ============

    /**
     * @notice Initialize the extractor with registry address
     * @param _registry The TrustedAgentRegistryV2 address
     */
    constructor(address _registry) {
        registry = ITrustedAgentRegistry(_registry);
    }

    // ============ Main Extract Function ============

    /**
     * @notice Extract and route calldata based on function selector
     * @param callData The raw calldata from the transaction
     * @return Encoded data for the appropriate policy engine
     * @dev Routes to Identity Policy for registerAgent, Financial Policy for strategy functions
     *      V2: Appends agent reputations to Financial Policy payloads
     */
    function extract(bytes calldata callData) external view override returns (bytes memory) {
        if (callData.length < 4) revert InvalidCallData();

        bytes4 selector;
        assembly {
            selector := calldataload(callData.offset)
        }

        // Route based on selector
        if (selector == REGISTER_AGENT_SELECTOR) {
            return _extractIdentityPolicy(callData);
        } else if (
            selector == REQUEST_STRATEGY_JOB_SELECTOR ||
            selector == REQUEST_STRATEGY_JOB_FULL_SELECTOR
        ) {
            return _extractFinancialPolicyWithReputation(callData, selector);
        } else if (selector == EXECUTE_STRATEGY_SELECTOR) {
            return _extractExecuteStrategyWithReputation(callData);
        } else {
            // For unknown selectors, return empty with policy type NONE
            return abi.encode(PolicyType.NONE, bytes(""));
        }
    }

    // ============ Identity Policy Extraction ============

    /**
     * @notice Extract data for Identity Policy (registerAgent)
     * @param callData The registerAgent calldata
     * @return Encoded policy type and extracted data
     */
    function _extractIdentityPolicy(bytes calldata callData) internal pure returns (bytes memory) {
        // Decode: registerAgent(string metadataURI, bytes worldIdPayload)
        (string memory metadataURI, bytes memory worldIdPayload) = abi.decode(
            callData[4:],
            (string, bytes)
        );

        return abi.encode(
            PolicyType.IDENTITY,
            abi.encode(metadataURI, worldIdPayload)
        );
    }

    // ============ Financial Policy Extraction with Reputation ============

    /**
     * @notice Extract data for Financial Policy with agent reputations appended
     * @param callData The requestStrategyJob calldata
     * @param selector The function selector (simple or full version)
     * @return Encoded policy type, extracted data, and reputation scores
     */
    function _extractFinancialPolicyWithReputation(
        bytes calldata callData,
        bytes4 selector
    ) internal view returns (bytes memory) {
        uint256[] memory agentIds;
        uint8 strategyType;
        address targetProtocol;
        uint256 amount;
        bytes memory params;

        if (selector == REQUEST_STRATEGY_JOB_SELECTOR) {
            // Simple version: requestStrategyJob(uint256[] agentIds)
            agentIds = abi.decode(callData[4:], (uint256[]));
            strategyType = 0;
            targetProtocol = address(0);
            amount = 0;
            params = "";
        } else {
            // Full version: requestStrategyJob(uint256[] agentIds, uint8 strategyType, address targetProtocol, uint256 amount, bytes params)
            (agentIds, strategyType, targetProtocol, amount, params) = abi.decode(
                callData[4:],
                (uint256[], uint8, address, uint256, bytes)
            );
        }

        // Query reputations for all agents
        int256[] memory reputations = new int256[](agentIds.length);
        uint256[] memory stakes = new uint256[](agentIds.length);
        int256 totalReputation = 0;
        uint256 totalStake = 0;

        for (uint256 i = 0; i < agentIds.length; i++) {
            reputations[i] = registry.getAgentReputation(agentIds[i]);
            stakes[i] = registry.getAgentStake(agentIds[i]);
            totalReputation += reputations[i];
            totalStake += stakes[i];
        }

        // Calculate average reputation (for policy decisions)
        int256 avgReputation = agentIds.length > 0 ? totalReputation / int256(agentIds.length) : int256(0);

        // Return enhanced payload with reputation data
        return abi.encode(
            PolicyType.FINANCIAL,
            abi.encode(
                agentIds,
                strategyType,
                targetProtocol,
                amount,
                params,
                // V2: Reputation data appended
                reputations,      // Individual reputations
                stakes,           // Individual stakes
                avgReputation,    // Average reputation for quick policy checks
                totalStake        // Total stake for volume limit adjustments
            )
        );
    }

    /**
     * @notice Extract data for executeStrategy with caller reputation
     * @param callData The executeStrategy calldata
     * @return Encoded policy type, extracted data, and caller reputation
     */
    function _extractExecuteStrategyWithReputation(bytes calldata callData) internal view returns (bytes memory) {
        // executeStrategy(address vault, uint256 amount, bytes extra)
        (address vault, uint256 amount, bytes memory extra) = abi.decode(
            callData[4:],
            (address, uint256, bytes)
        );

        // Try to get caller's agent ID and reputation
        // Note: In actual execution, we'd need the caller address from context
        // For now, we decode agentId from extra if provided
        uint256 callerAgentId = 0;
        int256 callerReputation = 0;
        uint256 callerStake = 0;

        if (extra.length >= 32) {
            // Assume extra contains agentId as first parameter
            callerAgentId = abi.decode(extra, (uint256));
            if (callerAgentId > 0) {
                callerReputation = registry.getAgentReputation(callerAgentId);
                callerStake = registry.getAgentStake(callerAgentId);
            }
        }

        return abi.encode(
            PolicyType.FINANCIAL,
            abi.encode(
                new uint256[](0),  // No agent IDs array for direct execution
                uint8(0),          // Unknown strategy type
                vault,             // Target is the vault
                amount,
                extra,
                // V2: Caller reputation data
                callerAgentId,
                callerReputation,
                callerStake
            )
        );
    }

    // ============ Helper Functions ============

    /**
     * @notice Get the policy type for a given selector
     * @param selector The function selector to check
     * @return The policy type that handles this selector
     */
    function getPolicyType(bytes4 selector) external pure returns (PolicyType) {
        if (selector == REGISTER_AGENT_SELECTOR) {
            return PolicyType.IDENTITY;
        } else if (
            selector == REQUEST_STRATEGY_JOB_SELECTOR ||
            selector == REQUEST_STRATEGY_JOB_FULL_SELECTOR ||
            selector == EXECUTE_STRATEGY_SELECTOR
        ) {
            return PolicyType.FINANCIAL;
        } else {
            return PolicyType.NONE;
        }
    }

    /**
     * @notice Check if a selector is supported
     * @param selector The function selector to check
     * @return Whether the selector has a defined policy route
     */
    function isSupported(bytes4 selector) external pure returns (bool) {
        return (
            selector == REGISTER_AGENT_SELECTOR ||
            selector == REQUEST_STRATEGY_JOB_SELECTOR ||
            selector == REQUEST_STRATEGY_JOB_FULL_SELECTOR ||
            selector == EXECUTE_STRATEGY_SELECTOR
        );
    }

    /**
     * @notice Get the selector constants for external reference
     */
    function getSelectors() external pure returns (
        bytes4 registerAgent,
        bytes4 requestStrategyJob,
        bytes4 requestStrategyJobFull,
        bytes4 executeStrategy
    ) {
        return (
            REGISTER_AGENT_SELECTOR,
            REQUEST_STRATEGY_JOB_SELECTOR,
            REQUEST_STRATEGY_JOB_FULL_SELECTOR,
            EXECUTE_STRATEGY_SELECTOR
        );
    }

    /**
     * @notice Directly query an agent's reputation
     * @param agentId The agent ID to query
     * @return reputation The agent's current reputation
     * @return stake The agent's current stake
     * @return verified Whether the agent is verified
     */
    function getAgentDetails(uint256 agentId) external view returns (
        int256 reputation,
        uint256 stake,
        bool verified
    ) {
        return (
            registry.getAgentReputation(agentId),
            registry.getAgentStake(agentId),
            registry.isAgentVerified(agentId)
        );
    }
}
