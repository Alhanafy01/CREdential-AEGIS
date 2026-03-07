// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IACEExtractor
 * @notice Interface for Chainlink ACE (Automation Condition Evaluation) extractors
 * @dev Extractors parse calldata/reports to route to appropriate policy checks
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
 * @title IStrategyVault
 * @notice Interface to read job data from StrategyVaultV2
 */
interface IStrategyVault {
    function getJobUserPrompt(uint256 jobId) external view returns (string memory);
    function getJob(uint256 jobId) external view returns (
        uint256[] memory agentIds,
        address proposer,
        uint256 createdAt,
        bool completed,
        bool success,
        string memory userPrompt
    );
}

/**
 * @title UnifiedExtractorV3
 * @notice ACE Extractor with Universal Executor target whitelist support
 * @dev V3 Features:
 *   - Extracts targets[] from Universal Executor payloads
 *   - Returns target addresses for ACE whitelist validation
 *   - Prevents AI prompt injection attacks by validating all targets
 *   - Stateless router: whitelist enforcement is in ACE PolicyEngine
 *
 * Architecture:
 *   1. CRE prepares execution report with (jobId, targets[], values[], calldatas[])
 *   2. ACE calls extract() on this extractor
 *   3. Extractor decodes and returns targets[] for whitelist check
 *   4. ACE PolicyEngine validates all targets are whitelisted
 *   5. If valid, CRE delivers report to StrategyVaultV2._processReport()
 *
 * Policy Types:
 *   - IDENTITY: World ID verification (registerAgent)
 *   - FINANCIAL: Volume limits with reputation (requestStrategyJob)
 *   - TARGET_WHITELIST: Universal executor target validation (onReport)
 */
contract UnifiedExtractorV3 is IACEExtractor {
    // ============ State Variables ============

    /// @notice The TrustedAgentRegistryV2 contract for reputation queries
    ITrustedAgentRegistry public immutable registry;

    /// @notice The StrategyVaultV2 contract for job queries
    IStrategyVault public strategyVault;

    // ============ Policy Types ============

    enum PolicyType {
        NONE,
        IDENTITY,           // World ID / identity verification
        FINANCIAL,          // Volume limits / blacklist checks + reputation
        TARGET_WHITELIST    // Universal executor target validation
    }

    // ============ Function Selectors ============

    // TrustedAgentRegistry functions -> Identity Policy
    bytes4 constant REGISTER_AGENT_SELECTOR = bytes4(keccak256("registerAgent(string,bytes)"));

    // StrategyVault functions -> Financial Policy (V2 with userPrompt)
    bytes4 constant REQUEST_STRATEGY_JOB_SELECTOR = bytes4(keccak256("requestStrategyJob(uint256[],string)"));
    // Legacy selector for backwards compatibility
    bytes4 constant REQUEST_STRATEGY_JOB_LEGACY_SELECTOR = bytes4(keccak256("requestStrategyJob(uint256[])"));

    // ReceiverTemplate onReport -> Target Whitelist Policy (for Universal Executor)
    bytes4 constant ON_REPORT_SELECTOR = bytes4(keccak256("onReport(bytes,bytes)"));

    // ============ Events ============

    event ExtractionRouted(bytes4 indexed selector, PolicyType policyType);
    event TargetsExtracted(uint256 indexed jobId, uint256 targetCount);

    // ============ Errors ============

    error UnsupportedSelector(bytes4 selector);
    error InvalidCallData();
    error InvalidReportFormat();

    // ============ Constructor ============

    /**
     * @notice Initialize the extractor with registry address
     * @param _registry The TrustedAgentRegistryV2 address
     */
    constructor(address _registry) {
        registry = ITrustedAgentRegistry(_registry);
    }

    /**
     * @notice Set the StrategyVaultV2 address (for reading job userPrompt)
     * @param _vault The StrategyVaultV2 address
     */
    function setStrategyVault(address _vault) external {
        strategyVault = IStrategyVault(_vault);
    }

    // ============ Main Extract Function ============

    /**
     * @notice Extract and route calldata based on function selector
     * @param callData The raw calldata from the transaction
     * @return Encoded data for the appropriate policy engine
     * @dev Routes to:
     *   - Identity Policy for registerAgent
     *   - Financial Policy for requestStrategyJob
     *   - Target Whitelist Policy for onReport (Universal Executor)
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
        } else if (selector == REQUEST_STRATEGY_JOB_SELECTOR || selector == REQUEST_STRATEGY_JOB_LEGACY_SELECTOR) {
            return _extractFinancialPolicyWithReputation(callData);
        } else if (selector == ON_REPORT_SELECTOR) {
            return _extractUniversalExecuteTargets(callData);
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

    // ============ Financial Policy Extraction ============

    /**
     * @notice Extract data for Financial Policy with agent reputations
     * @param callData The requestStrategyJob calldata
     * @return Encoded policy type, extracted data, and reputation scores
     */
    function _extractFinancialPolicyWithReputation(
        bytes calldata callData
    ) internal view returns (bytes memory) {
        // Decode: requestStrategyJob(uint256[] agentIds)
        uint256[] memory agentIds = abi.decode(callData[4:], (uint256[]));

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

        // Calculate average reputation
        int256 avgReputation = agentIds.length > 0
            ? totalReputation / int256(agentIds.length)
            : int256(0);

        return abi.encode(
            PolicyType.FINANCIAL,
            abi.encode(
                agentIds,
                reputations,
                stakes,
                avgReputation,
                totalStake
            )
        );
    }

    // ============ Universal Executor Target Extraction ============

    /**
     * @notice Extract targets from Universal Executor report for whitelist validation
     * @param callData The onReport calldata containing (metadata, report)
     * @return Encoded TARGET_WHITELIST policy with targets array
     * @dev This is the critical ACE firewall function that prevents prompt injection
     *      by extracting all target addresses for whitelist validation
     *
     * Expected report format: abi.encode(uint256 jobId, address[] targets, uint256[] values, bytes[] calldatas)
     */
    function _extractUniversalExecuteTargets(
        bytes calldata callData
    ) internal pure returns (bytes memory) {
        // onReport(bytes metadata, bytes report)
        // Skip selector (4 bytes), decode the two dynamic bytes parameters
        (, bytes memory report) = abi.decode(callData[4:], (bytes, bytes));

        // Decode the report to extract targets
        (
            uint256 jobId,
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas
        ) = abi.decode(report, (uint256, address[], uint256[], bytes[]));

        // Return TARGET_WHITELIST policy with all data ACE needs
        return abi.encode(
            PolicyType.TARGET_WHITELIST,
            abi.encode(
                jobId,
                targets,          // ACE will validate each target is whitelisted
                values,           // For volume limit checks
                calldatas.length  // Number of operations for gas estimation
            )
        );
    }

    /**
     * @notice Direct extraction from raw report bytes (alternative entry point)
     * @param report The raw report bytes from CRE
     * @return Encoded TARGET_WHITELIST policy with targets array
     * @dev Can be called directly when you have the report bytes
     */
    function extractFromReport(bytes calldata report) external pure returns (bytes memory) {
        // Decode the report
        (
            uint256 jobId,
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas
        ) = abi.decode(report, (uint256, address[], uint256[], bytes[]));

        return abi.encode(
            PolicyType.TARGET_WHITELIST,
            abi.encode(
                jobId,
                targets,
                values,
                calldatas.length
            )
        );
    }

    /**
     * @notice Extract just the targets array from a report (minimal gas)
     * @param report The raw report bytes
     * @return targets Array of target addresses for whitelist check
     */
    function extractTargetsOnly(bytes calldata report) external pure returns (address[] memory targets) {
        (, targets, , ) = abi.decode(report, (uint256, address[], uint256[], bytes[]));
        return targets;
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
        } else if (selector == REQUEST_STRATEGY_JOB_SELECTOR) {
            return PolicyType.FINANCIAL;
        } else if (selector == ON_REPORT_SELECTOR) {
            return PolicyType.TARGET_WHITELIST;
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
            selector == ON_REPORT_SELECTOR
        );
    }

    /**
     * @notice Get all selector constants
     */
    function getSelectors() external pure returns (
        bytes4 registerAgent,
        bytes4 requestStrategyJob,
        bytes4 onReport
    ) {
        return (
            REGISTER_AGENT_SELECTOR,
            REQUEST_STRATEGY_JOB_SELECTOR,
            ON_REPORT_SELECTOR
        );
    }

    /**
     * @notice Directly query an agent's reputation
     * @param agentId The agent ID to query
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

    // ============ CRE Job Data Extraction ============

    /**
     * @notice Get the raw natural language userPrompt for a job
     * @param jobId The job ID to query
     * @return userPrompt The user's natural language intent
     * @dev CRE calls this to get the prompt to send to AI agents
     */
    function getJobUserPrompt(uint256 jobId) external view returns (string memory) {
        require(address(strategyVault) != address(0), "StrategyVault not set");
        return strategyVault.getJobUserPrompt(jobId);
    }

    /**
     * @notice Get full job data for CRE workflow
     * @param jobId The job ID to query
     * @return agentIds Array of agent IDs assigned to this job
     * @return proposer Address that created the job
     * @return createdAt Timestamp when job was created
     * @return completed Whether job has been executed
     * @return userPrompt The raw natural language intent
     * @dev CRE calls this to get all job context for AI agents
     */
    function getJobData(uint256 jobId) external view returns (
        uint256[] memory agentIds,
        address proposer,
        uint256 createdAt,
        bool completed,
        string memory userPrompt
    ) {
        require(address(strategyVault) != address(0), "StrategyVault not set");
        (agentIds, proposer, createdAt, completed, , userPrompt) = strategyVault.getJob(jobId);
    }
}
