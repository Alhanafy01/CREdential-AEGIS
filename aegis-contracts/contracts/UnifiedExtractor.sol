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
 * @title UnifiedExtractor
 * @notice ACE Extractor that dynamically routes requests based on function selector
 * @dev Implements IACEExtractor for Chainlink ACE integration
 *
 * Routing Logic:
 * - registerAgent() -> Identity Policy (World ID verification)
 * - requestStrategyJob() -> Financial Policy (volume/blacklist checks)
 * - executeStrategy() -> Financial Policy (volume/blacklist checks)
 *
 * The extractor inspects msg.data's functionSelector to determine which
 * policy engine should evaluate the request.
 */
contract UnifiedExtractor is IACEExtractor {
    // ============ Policy Types ============

    enum PolicyType {
        NONE,
        IDENTITY,   // World ID / identity verification
        FINANCIAL   // Volume limits / blacklist checks
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
    event ExtractionFailed(bytes4 indexed selector, string reason);

    // ============ Errors ============

    error UnsupportedSelector(bytes4 selector);
    error InvalidCallData();

    // ============ Main Extract Function ============

    /**
     * @notice Extract and route calldata based on function selector
     * @param callData The raw calldata from the transaction
     * @return Encoded data for the appropriate policy engine
     * @dev Routes to Identity Policy for registerAgent, Financial Policy for strategy functions
     */
    function extract(bytes calldata callData) external pure override returns (bytes memory) {
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
            return _extractFinancialPolicy(callData, selector);
        } else if (selector == EXECUTE_STRATEGY_SELECTOR) {
            return _extractExecuteStrategy(callData);
        } else {
            // For unknown selectors, return empty with policy type NONE
            // This allows passthrough for functions that don't need policy checks
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

        // Return policy type + extracted data for Identity checks
        // The policy engine will verify the World ID proof
        return abi.encode(
            PolicyType.IDENTITY,
            abi.encode(metadataURI, worldIdPayload)
        );
    }

    // ============ Financial Policy Extraction ============

    /**
     * @notice Extract data for Financial Policy (requestStrategyJob)
     * @param callData The requestStrategyJob calldata
     * @param selector The function selector (simple or full version)
     * @return Encoded policy type and extracted data
     */
    function _extractFinancialPolicy(
        bytes calldata callData,
        bytes4 selector
    ) internal pure returns (bytes memory) {
        if (selector == REQUEST_STRATEGY_JOB_SELECTOR) {
            // Simple version: requestStrategyJob(uint256[] agentIds)
            uint256[] memory agentIds = abi.decode(callData[4:], (uint256[]));

            return abi.encode(
                PolicyType.FINANCIAL,
                abi.encode(
                    agentIds,
                    uint8(0),      // Default strategy type
                    address(0),    // No target protocol
                    uint256(0),    // No amount
                    bytes("")      // No params
                )
            );
        } else {
            // Full version: requestStrategyJob(uint256[] agentIds, uint8 strategyType, address targetProtocol, uint256 amount, bytes params)
            (
                uint256[] memory agentIds,
                uint8 strategyType,
                address targetProtocol,
                uint256 amount,
                bytes memory params
            ) = abi.decode(callData[4:], (uint256[], uint8, address, uint256, bytes));

            return abi.encode(
                PolicyType.FINANCIAL,
                abi.encode(agentIds, strategyType, targetProtocol, amount, params)
            );
        }
    }

    /**
     * @notice Extract data for executeStrategy calls
     * @param callData The executeStrategy calldata
     * @return Encoded policy type and extracted data
     */
    function _extractExecuteStrategy(bytes calldata callData) internal pure returns (bytes memory) {
        // executeStrategy(address vault, uint256 amount, bytes extra)
        (address vault, uint256 amount, bytes memory extra) = abi.decode(
            callData[4:],
            (address, uint256, bytes)
        );

        return abi.encode(
            PolicyType.FINANCIAL,
            abi.encode(
                new uint256[](0),  // No agent IDs for direct execution
                uint8(0),          // Unknown strategy type
                vault,             // Target is the vault
                amount,
                extra
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
}
