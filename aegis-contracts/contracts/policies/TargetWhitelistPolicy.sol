// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TargetWhitelistPolicy
 * @notice ACE Policy that ensures AI agents can only interact with approved DeFi protocols
 * @dev Part of the Chainlink ACE (Automated Compliance Engine) firewall
 *
 * Architecture:
 *   1. UnifiedExtractorV3 extracts targets[] from CRE report
 *   2. ACEPolicyEngine calls validate() with extracted targets
 *   3. This policy verifies ALL targets are whitelisted
 *   4. If valid, execution proceeds to StrategyVaultV2
 *
 * Security Model:
 *   - Prevents prompt injection attacks where malicious AI outputs target unauthorized contracts
 *   - All protocol addresses must be explicitly whitelisted via admin functions
 *   - No hardcoded addresses - fully configurable at runtime
 */
contract TargetWhitelistPolicy is Ownable {
    // ============ State Variables ============

    /// @notice Mapping of whitelisted target addresses
    mapping(address => bool) public isWhitelisted;

    /// @notice Array of all whitelisted addresses for enumeration
    address[] public whitelistedAddresses;

    /// @notice Index mapping for efficient removal
    mapping(address => uint256) private addressIndex;

    // ============ Events ============

    event AddressWhitelisted(address indexed target, bool status);
    event BatchWhitelistUpdated(address[] targets, bool status);
    event PolicyValidationResult(uint256 indexed jobId, bool passed, uint256 targetCount);

    // ============ Errors ============

    error TargetNotWhitelisted(address target);
    error EmptyTargetsArray();
    error ZeroAddress();

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ Validation Functions ============

    /**
     * @notice Validate that all targets in the array are whitelisted
     * @param targets Array of target addresses from the AI agent's response
     * @return valid True if ALL targets are whitelisted
     * @dev Called by ACEPolicyEngine before execution
     */
    function validate(address[] calldata targets) external view returns (bool valid) {
        if (targets.length == 0) revert EmptyTargetsArray();

        for (uint256 i = 0; i < targets.length; i++) {
            if (!isWhitelisted[targets[i]]) {
                revert TargetNotWhitelisted(targets[i]);
            }
        }

        return true;
    }

    /**
     * @notice Validate with job context for logging
     * @param jobId The job ID for event emission
     * @param targets Array of target addresses
     * @return valid True if ALL targets are whitelisted
     */
    function validateWithContext(
        uint256 jobId,
        address[] calldata targets
    ) external returns (bool valid) {
        if (targets.length == 0) revert EmptyTargetsArray();

        for (uint256 i = 0; i < targets.length; i++) {
            if (!isWhitelisted[targets[i]]) {
                emit PolicyValidationResult(jobId, false, targets.length);
                revert TargetNotWhitelisted(targets[i]);
            }
        }

        emit PolicyValidationResult(jobId, true, targets.length);
        return true;
    }

    /**
     * @notice Check if a single target is whitelisted (view only)
     * @param target The address to check
     * @return Whether the address is whitelisted
     */
    function isTargetWhitelisted(address target) external view returns (bool) {
        return isWhitelisted[target];
    }

    /**
     * @notice Check multiple targets and return which ones are not whitelisted
     * @param targets Array of addresses to check
     * @return allValid True if all are whitelisted
     * @return invalidTargets Array of non-whitelisted addresses
     */
    function checkTargets(
        address[] calldata targets
    ) external view returns (bool allValid, address[] memory invalidTargets) {
        uint256 invalidCount = 0;

        // First pass: count invalid
        for (uint256 i = 0; i < targets.length; i++) {
            if (!isWhitelisted[targets[i]]) {
                invalidCount++;
            }
        }

        if (invalidCount == 0) {
            return (true, new address[](0));
        }

        // Second pass: collect invalid
        invalidTargets = new address[](invalidCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < targets.length; i++) {
            if (!isWhitelisted[targets[i]]) {
                invalidTargets[idx] = targets[i];
                idx++;
            }
        }

        return (false, invalidTargets);
    }

    // ============ Admin Functions ============

    /**
     * @notice Add a single address to the whitelist
     * @param target The address to whitelist
     */
    function addWhitelistedAddress(address target) external onlyOwner {
        if (target == address(0)) revert ZeroAddress();
        if (!isWhitelisted[target]) {
            isWhitelisted[target] = true;
            addressIndex[target] = whitelistedAddresses.length;
            whitelistedAddresses.push(target);
            emit AddressWhitelisted(target, true);
        }
    }

    /**
     * @notice Add multiple addresses to the whitelist in a single transaction
     * @param targets Array of addresses to whitelist
     */
    function addWhitelistedAddresses(address[] calldata targets) external onlyOwner {
        for (uint256 i = 0; i < targets.length; i++) {
            address target = targets[i];
            if (target == address(0)) revert ZeroAddress();
            if (!isWhitelisted[target]) {
                isWhitelisted[target] = true;
                addressIndex[target] = whitelistedAddresses.length;
                whitelistedAddresses.push(target);
            }
        }
        emit BatchWhitelistUpdated(targets, true);
    }

    /**
     * @notice Remove an address from the whitelist
     * @param target The address to remove
     */
    function removeWhitelistedAddress(address target) external onlyOwner {
        if (isWhitelisted[target]) {
            isWhitelisted[target] = false;

            // Swap and pop for efficient removal
            uint256 idx = addressIndex[target];
            uint256 lastIdx = whitelistedAddresses.length - 1;

            if (idx != lastIdx) {
                address lastAddr = whitelistedAddresses[lastIdx];
                whitelistedAddresses[idx] = lastAddr;
                addressIndex[lastAddr] = idx;
            }

            whitelistedAddresses.pop();
            delete addressIndex[target];

            emit AddressWhitelisted(target, false);
        }
    }

    /**
     * @notice Remove multiple addresses from the whitelist
     * @param targets Array of addresses to remove
     */
    function removeWhitelistedAddresses(address[] calldata targets) external onlyOwner {
        for (uint256 i = 0; i < targets.length; i++) {
            address target = targets[i];
            if (isWhitelisted[target]) {
                isWhitelisted[target] = false;

                uint256 idx = addressIndex[target];
                uint256 lastIdx = whitelistedAddresses.length - 1;

                if (idx != lastIdx) {
                    address lastAddr = whitelistedAddresses[lastIdx];
                    whitelistedAddresses[idx] = lastAddr;
                    addressIndex[lastAddr] = idx;
                }

                whitelistedAddresses.pop();
                delete addressIndex[target];
            }
        }
        emit BatchWhitelistUpdated(targets, false);
    }

    // ============ View Functions ============

    /**
     * @notice Get all whitelisted addresses
     * @return Array of all whitelisted addresses
     */
    function getWhitelistedAddresses() external view returns (address[] memory) {
        return whitelistedAddresses;
    }

    /**
     * @notice Get the count of whitelisted addresses
     * @return The number of whitelisted addresses
     */
    function getWhitelistCount() external view returns (uint256) {
        return whitelistedAddresses.length;
    }
}
