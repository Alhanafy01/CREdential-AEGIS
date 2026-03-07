// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TargetBlacklistPolicy
 * @notice ACE Policy that blocks interactions with known malicious or sanctioned addresses
 * @dev Part of the Chainlink ACE (Automated Compliance Engine) firewall
 *
 * Architecture:
 *   1. UnifiedExtractorV3 extracts targets[] from CRE report
 *   2. ACEPolicyEngine calls validate() with extracted targets
 *   3. This policy verifies NONE of the targets are blacklisted
 *   4. If valid, execution proceeds to StrategyVaultV2
 *
 * Security Model:
 *   - Blocks interactions with OFAC-sanctioned addresses
 *   - Prevents AI from routing funds through known hacker wallets
 *   - Addresses can be dynamically added/removed via admin functions
 *   - Compatible with compliance oracle feeds for automated updates
 */
contract TargetBlacklistPolicy is Ownable {
    // ============ State Variables ============

    /// @notice Mapping of blacklisted target addresses
    mapping(address => bool) public isBlacklisted;

    /// @notice Array of all blacklisted addresses for enumeration
    address[] public blacklistedAddresses;

    /// @notice Index mapping for efficient removal
    mapping(address => uint256) private addressIndex;

    /// @notice Optional reason for blacklisting (for compliance records)
    mapping(address => string) public blacklistReason;

    // ============ Events ============

    event AddressBlacklisted(address indexed target, bool status, string reason);
    event BatchBlacklistUpdated(address[] targets, bool status);
    event PolicyValidationResult(uint256 indexed jobId, bool passed, uint256 targetCount);

    // ============ Errors ============

    error TargetIsBlacklisted(address target);
    error EmptyTargetsArray();
    error ZeroAddress();

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ Validation Functions ============

    /**
     * @notice Validate that no targets in the array are blacklisted
     * @param targets Array of target addresses from the AI agent's response
     * @return valid True if NONE of the targets are blacklisted
     * @dev Called by ACEPolicyEngine before execution
     */
    function validate(address[] calldata targets) external view returns (bool valid) {
        if (targets.length == 0) revert EmptyTargetsArray();

        for (uint256 i = 0; i < targets.length; i++) {
            if (isBlacklisted[targets[i]]) {
                revert TargetIsBlacklisted(targets[i]);
            }
        }

        return true;
    }

    /**
     * @notice Validate with job context for logging
     * @param jobId The job ID for event emission
     * @param targets Array of target addresses
     * @return valid True if NONE of the targets are blacklisted
     */
    function validateWithContext(
        uint256 jobId,
        address[] calldata targets
    ) external returns (bool valid) {
        if (targets.length == 0) revert EmptyTargetsArray();

        for (uint256 i = 0; i < targets.length; i++) {
            if (isBlacklisted[targets[i]]) {
                emit PolicyValidationResult(jobId, false, targets.length);
                revert TargetIsBlacklisted(targets[i]);
            }
        }

        emit PolicyValidationResult(jobId, true, targets.length);
        return true;
    }

    /**
     * @notice Check if a single target is blacklisted (view only)
     * @param target The address to check
     * @return Whether the address is blacklisted
     */
    function isTargetBlacklisted(address target) external view returns (bool) {
        return isBlacklisted[target];
    }

    /**
     * @notice Check multiple targets and return which ones are blacklisted
     * @param targets Array of addresses to check
     * @return allValid True if none are blacklisted
     * @return blockedTargets Array of blacklisted addresses found
     */
    function checkTargets(
        address[] calldata targets
    ) external view returns (bool allValid, address[] memory blockedTargets) {
        uint256 blockedCount = 0;

        // First pass: count blocked
        for (uint256 i = 0; i < targets.length; i++) {
            if (isBlacklisted[targets[i]]) {
                blockedCount++;
            }
        }

        if (blockedCount == 0) {
            return (true, new address[](0));
        }

        // Second pass: collect blocked
        blockedTargets = new address[](blockedCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < targets.length; i++) {
            if (isBlacklisted[targets[i]]) {
                blockedTargets[idx] = targets[i];
                idx++;
            }
        }

        return (false, blockedTargets);
    }

    // ============ Admin Functions ============

    /**
     * @notice Add a single address to the blacklist
     * @param target The address to blacklist
     * @param reason The reason for blacklisting (e.g., "OFAC SDN List")
     */
    function addBlacklistedAddress(address target, string calldata reason) external onlyOwner {
        if (target == address(0)) revert ZeroAddress();
        if (!isBlacklisted[target]) {
            isBlacklisted[target] = true;
            addressIndex[target] = blacklistedAddresses.length;
            blacklistedAddresses.push(target);
            blacklistReason[target] = reason;
            emit AddressBlacklisted(target, true, reason);
        }
    }

    /**
     * @notice Add a single address to the blacklist (without reason)
     * @param target The address to blacklist
     */
    function addBlacklistedAddress(address target) external onlyOwner {
        if (target == address(0)) revert ZeroAddress();
        if (!isBlacklisted[target]) {
            isBlacklisted[target] = true;
            addressIndex[target] = blacklistedAddresses.length;
            blacklistedAddresses.push(target);
            emit AddressBlacklisted(target, true, "");
        }
    }

    /**
     * @notice Add multiple addresses to the blacklist in a single transaction
     * @param targets Array of addresses to blacklist
     */
    function addBlacklistedAddresses(address[] calldata targets) external onlyOwner {
        for (uint256 i = 0; i < targets.length; i++) {
            address target = targets[i];
            if (target == address(0)) revert ZeroAddress();
            if (!isBlacklisted[target]) {
                isBlacklisted[target] = true;
                addressIndex[target] = blacklistedAddresses.length;
                blacklistedAddresses.push(target);
            }
        }
        emit BatchBlacklistUpdated(targets, true);
    }

    /**
     * @notice Remove an address from the blacklist
     * @param target The address to remove
     */
    function removeBlacklistedAddress(address target) external onlyOwner {
        if (isBlacklisted[target]) {
            isBlacklisted[target] = false;

            // Swap and pop for efficient removal
            uint256 idx = addressIndex[target];
            uint256 lastIdx = blacklistedAddresses.length - 1;

            if (idx != lastIdx) {
                address lastAddr = blacklistedAddresses[lastIdx];
                blacklistedAddresses[idx] = lastAddr;
                addressIndex[lastAddr] = idx;
            }

            blacklistedAddresses.pop();
            delete addressIndex[target];
            delete blacklistReason[target];

            emit AddressBlacklisted(target, false, "");
        }
    }

    /**
     * @notice Remove multiple addresses from the blacklist
     * @param targets Array of addresses to remove
     */
    function removeBlacklistedAddresses(address[] calldata targets) external onlyOwner {
        for (uint256 i = 0; i < targets.length; i++) {
            address target = targets[i];
            if (isBlacklisted[target]) {
                isBlacklisted[target] = false;

                uint256 idx = addressIndex[target];
                uint256 lastIdx = blacklistedAddresses.length - 1;

                if (idx != lastIdx) {
                    address lastAddr = blacklistedAddresses[lastIdx];
                    blacklistedAddresses[idx] = lastAddr;
                    addressIndex[lastAddr] = idx;
                }

                blacklistedAddresses.pop();
                delete addressIndex[target];
                delete blacklistReason[target];
            }
        }
        emit BatchBlacklistUpdated(targets, false);
    }

    // ============ View Functions ============

    /**
     * @notice Get all blacklisted addresses
     * @return Array of all blacklisted addresses
     */
    function getBlacklistedAddresses() external view returns (address[] memory) {
        return blacklistedAddresses;
    }

    /**
     * @notice Get the count of blacklisted addresses
     * @return The number of blacklisted addresses
     */
    function getBlacklistCount() external view returns (uint256) {
        return blacklistedAddresses.length;
    }

    /**
     * @notice Get the reason why an address was blacklisted
     * @param target The address to query
     * @return The blacklist reason
     */
    function getBlacklistReason(address target) external view returns (string memory) {
        return blacklistReason[target];
    }
}
