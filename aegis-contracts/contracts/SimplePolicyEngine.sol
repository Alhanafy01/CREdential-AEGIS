// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SimplePolicyEngine
 * @notice ACE Policy Engine that enforces blacklist and volume rules
 * @dev Uses UnifiedExtractor to parse incoming call data and applies policies
 */
contract SimplePolicyEngine {
    // ============ State Variables ============

    address public owner;
    address public unifiedExtractor;

    // Blacklist: addresses that cannot participate
    mapping(address => bool) public blacklisted;

    // Volume limits: max amount per transaction and per 24h window
    uint256 public maxTransactionAmount;
    uint256 public maxDailyVolume;

    // Volume tracking per address (resets daily)
    mapping(address => uint256) public dailyVolume;
    mapping(address => uint256) public lastVolumeReset;

    // ============ Events ============

    event AddressBlacklisted(address indexed account, bool status);
    event VolumeLimitsUpdated(uint256 maxTransaction, uint256 maxDaily);
    event PolicyCheckPassed(address indexed caller, uint256 amount);
    event PolicyCheckFailed(address indexed caller, string reason);

    // ============ Errors ============

    error Blacklisted(address account);
    error ExceedsTransactionLimit(uint256 amount, uint256 limit);
    error ExceedsDailyVolume(uint256 currentVolume, uint256 limit);
    error Unauthorized();

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ============ Constructor ============

    constructor(
        address _unifiedExtractor,
        uint256 _maxTransactionAmount,
        uint256 _maxDailyVolume
    ) {
        owner = msg.sender;
        unifiedExtractor = _unifiedExtractor;
        maxTransactionAmount = _maxTransactionAmount;
        maxDailyVolume = _maxDailyVolume;
    }

    // ============ Policy Check Functions ============

    /**
     * @notice Main policy check function called by CRE before executing strategies
     * @param caller The address initiating the action
     * @param amount The amount involved in the transaction
     * @return approved Whether the transaction is approved
     * @return reason Reason if rejected (empty if approved)
     */
    function checkPolicy(
        address caller,
        uint256 amount
    ) external returns (bool approved, string memory reason) {
        // Check 1: Blacklist
        if (blacklisted[caller]) {
            emit PolicyCheckFailed(caller, "Address is blacklisted");
            return (false, "Address is blacklisted");
        }

        // Check 2: Transaction amount limit
        if (amount > maxTransactionAmount) {
            emit PolicyCheckFailed(caller, "Exceeds transaction limit");
            return (false, "Exceeds transaction limit");
        }

        // Check 3: Daily volume limit
        _resetDailyVolumeIfNeeded(caller);
        if (dailyVolume[caller] + amount > maxDailyVolume) {
            emit PolicyCheckFailed(caller, "Exceeds daily volume limit");
            return (false, "Exceeds daily volume limit");
        }

        // Update volume tracking
        dailyVolume[caller] += amount;

        emit PolicyCheckPassed(caller, amount);
        return (true, "");
    }

    /**
     * @notice View-only policy check (doesn't update state)
     * @param caller The address to check
     * @param amount The amount to check
     * @return approved Whether the transaction would be approved
     * @return reason Rejection reason (empty if approved)
     */
    function checkPolicyView(
        address caller,
        uint256 amount
    ) external view returns (bool approved, string memory reason) {
        if (blacklisted[caller]) return (false, "Address is blacklisted");
        if (amount > maxTransactionAmount) return (false, "Exceeds transaction limit");

        uint256 currentVolume = dailyVolume[caller];
        if (block.timestamp >= lastVolumeReset[caller] + 1 days) {
            currentVolume = 0;
        }
        if (currentVolume + amount > maxDailyVolume) return (false, "Exceeds daily volume limit");

        return (true, "");
    }

    /**
     * @notice Check if an address is allowed (not blacklisted)
     * @param account The address to check
     * @return Whether the address is allowed
     */
    function isAllowed(address account) external view returns (bool) {
        return !blacklisted[account];
    }

    // ============ Admin Functions ============

    /**
     * @notice Add or remove an address from the blacklist
     * @param account The address to update
     * @param status True to blacklist, false to remove from blacklist
     */
    function setBlacklisted(address account, bool status) external onlyOwner {
        blacklisted[account] = status;
        emit AddressBlacklisted(account, status);
    }

    /**
     * @notice Batch update blacklist
     * @param accounts Array of addresses to update
     * @param status True to blacklist all, false to remove all
     */
    function setBlacklistedBatch(address[] calldata accounts, bool status) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            blacklisted[accounts[i]] = status;
            emit AddressBlacklisted(accounts[i], status);
        }
    }

    /**
     * @notice Update volume limits
     * @param _maxTransactionAmount New max per-transaction amount
     * @param _maxDailyVolume New max daily volume
     */
    function setVolumeLimits(
        uint256 _maxTransactionAmount,
        uint256 _maxDailyVolume
    ) external onlyOwner {
        maxTransactionAmount = _maxTransactionAmount;
        maxDailyVolume = _maxDailyVolume;
        emit VolumeLimitsUpdated(_maxTransactionAmount, _maxDailyVolume);
    }

    /**
     * @notice Update the unified extractor address
     * @param _unifiedExtractor New extractor address
     */
    function setUnifiedExtractor(address _unifiedExtractor) external onlyOwner {
        unifiedExtractor = _unifiedExtractor;
    }

    /**
     * @notice Transfer ownership
     * @param newOwner The new owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }

    // ============ Internal Functions ============

    /**
     * @notice Reset daily volume if 24 hours have passed
     * @param account The account to check/reset
     */
    function _resetDailyVolumeIfNeeded(address account) internal {
        if (block.timestamp >= lastVolumeReset[account] + 1 days) {
            dailyVolume[account] = 0;
            lastVolumeReset[account] = block.timestamp;
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get the remaining daily volume for an account
     * @param account The account to check
     * @return remaining The remaining volume available
     */
    function getRemainingDailyVolume(address account) external view returns (uint256 remaining) {
        uint256 currentVolume = dailyVolume[account];
        if (block.timestamp >= lastVolumeReset[account] + 1 days) {
            currentVolume = 0;
        }
        if (currentVolume >= maxDailyVolume) return 0;
        return maxDailyVolume - currentVolume;
    }
}
