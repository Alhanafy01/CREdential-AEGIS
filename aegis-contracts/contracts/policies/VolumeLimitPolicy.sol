// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VolumeLimitPolicy
 * @notice ACE Policy that caps the amount of funds an AI can move in a single transaction
 * @dev Part of the Chainlink ACE (Automated Compliance Engine) firewall
 *
 * Architecture:
 *   1. UnifiedExtractorV3 extracts values[] from CRE report
 *   2. ACEPolicyEngine calls validate() with extracted values
 *   3. This policy verifies total volume <= maxTransactionVolume
 *   4. If valid, execution proceeds to StrategyVaultV2
 *
 * Security Model:
 *   - Prevents AI from accidentally dumping entire vault TVL at once
 *   - Configurable limits can be adjusted per risk tolerance
 *   - Set to type(uint256).max to effectively disable during testing
 *   - Supports both per-transaction and cumulative limits
 */
contract VolumeLimitPolicy is Ownable {
    // ============ State Variables ============

    /// @notice Maximum volume allowed in a single transaction (in wei for ETH, or base units for tokens)
    uint256 public maxTransactionVolume;

    /// @notice Maximum volume allowed per time window (optional rolling limit)
    uint256 public maxWindowVolume;

    /// @notice Time window for rolling volume limit (in seconds)
    uint256 public windowDuration;

    /// @notice Cumulative volume in current window
    uint256 public currentWindowVolume;

    /// @notice Start time of current window
    uint256 public windowStartTime;

    /// @notice Whether the rolling window limit is enabled
    bool public windowLimitEnabled;

    // ============ Events ============

    event MaxTransactionVolumeUpdated(uint256 oldLimit, uint256 newLimit);
    event WindowLimitUpdated(uint256 maxVolume, uint256 duration, bool enabled);
    event PolicyValidationResult(uint256 indexed jobId, bool passed, uint256 totalVolume);
    event VolumeRecorded(uint256 indexed jobId, uint256 volume, uint256 windowTotal);

    // ============ Errors ============

    error VolumeExceedsTransactionLimit(uint256 requested, uint256 limit);
    error VolumeExceedsWindowLimit(uint256 requested, uint256 remaining);
    error EmptyValuesArray();
    error InvalidWindowDuration();

    // ============ Constructor ============

    /**
     * @notice Initialize with maximum transaction volume
     * @dev Set to type(uint256).max to effectively disable the limit
     */
    constructor(uint256 _maxTransactionVolume) Ownable(msg.sender) {
        maxTransactionVolume = _maxTransactionVolume;
        windowStartTime = block.timestamp;
        emit MaxTransactionVolumeUpdated(0, _maxTransactionVolume);
    }

    // ============ Validation Functions ============

    /**
     * @notice Validate that total volume does not exceed limits
     * @param values Array of values (amounts) from the AI agent's response
     * @return valid True if total volume is within limits
     * @dev Called by ACEPolicyEngine before execution
     */
    function validate(uint256[] calldata values) external view returns (bool valid) {
        if (values.length == 0) revert EmptyValuesArray();

        uint256 totalVolume = _calculateTotalVolume(values);

        // Check per-transaction limit
        if (totalVolume > maxTransactionVolume) {
            revert VolumeExceedsTransactionLimit(totalVolume, maxTransactionVolume);
        }

        // Check window limit if enabled
        if (windowLimitEnabled) {
            uint256 windowVolume = _getCurrentWindowVolume();
            if (windowVolume + totalVolume > maxWindowVolume) {
                revert VolumeExceedsWindowLimit(totalVolume, maxWindowVolume - windowVolume);
            }
        }

        return true;
    }

    /**
     * @notice Validate with job context for logging and recording
     * @param jobId The job ID for event emission
     * @param values Array of values (amounts)
     * @return valid True if total volume is within limits
     * @dev This version records the volume for window tracking
     */
    function validateWithContext(
        uint256 jobId,
        uint256[] calldata values
    ) external returns (bool valid) {
        if (values.length == 0) revert EmptyValuesArray();

        uint256 totalVolume = _calculateTotalVolume(values);

        // Check per-transaction limit
        if (totalVolume > maxTransactionVolume) {
            emit PolicyValidationResult(jobId, false, totalVolume);
            revert VolumeExceedsTransactionLimit(totalVolume, maxTransactionVolume);
        }

        // Check and update window limit if enabled
        if (windowLimitEnabled) {
            _updateWindow();
            if (currentWindowVolume + totalVolume > maxWindowVolume) {
                emit PolicyValidationResult(jobId, false, totalVolume);
                revert VolumeExceedsWindowLimit(totalVolume, maxWindowVolume - currentWindowVolume);
            }
            currentWindowVolume += totalVolume;
            emit VolumeRecorded(jobId, totalVolume, currentWindowVolume);
        }

        emit PolicyValidationResult(jobId, true, totalVolume);
        return true;
    }

    /**
     * @notice Check if a volume would be valid without reverting
     * @param values Array of values to check
     * @return valid True if volume is within limits
     * @return totalVolume The calculated total volume
     * @return transactionRemaining How much more can be sent in one tx
     * @return windowRemaining How much more can be sent in current window (0 if disabled)
     */
    function checkVolume(
        uint256[] calldata values
    ) external view returns (
        bool valid,
        uint256 totalVolume,
        uint256 transactionRemaining,
        uint256 windowRemaining
    ) {
        totalVolume = _calculateTotalVolume(values);

        // Calculate transaction limit remaining
        transactionRemaining = totalVolume <= maxTransactionVolume
            ? maxTransactionVolume - totalVolume
            : 0;

        // Calculate window limit remaining
        if (windowLimitEnabled) {
            uint256 windowVolume = _getCurrentWindowVolume();
            windowRemaining = windowVolume + totalVolume <= maxWindowVolume
                ? maxWindowVolume - windowVolume - totalVolume
                : 0;
            valid = totalVolume <= maxTransactionVolume && windowVolume + totalVolume <= maxWindowVolume;
        } else {
            windowRemaining = 0;
            valid = totalVolume <= maxTransactionVolume;
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Set the maximum volume per transaction
     * @param _maxVolume The new maximum volume (set to type(uint256).max to disable)
     */
    function setMaxTransactionVolume(uint256 _maxVolume) external onlyOwner {
        uint256 oldLimit = maxTransactionVolume;
        maxTransactionVolume = _maxVolume;
        emit MaxTransactionVolumeUpdated(oldLimit, _maxVolume);
    }

    /**
     * @notice Configure the rolling window volume limit
     * @param _maxVolume Maximum volume allowed in the window
     * @param _duration Window duration in seconds
     * @param _enabled Whether to enable window limiting
     */
    function setWindowLimit(
        uint256 _maxVolume,
        uint256 _duration,
        bool _enabled
    ) external onlyOwner {
        if (_enabled && _duration == 0) revert InvalidWindowDuration();

        maxWindowVolume = _maxVolume;
        windowDuration = _duration;
        windowLimitEnabled = _enabled;

        // Reset window if enabling
        if (_enabled) {
            windowStartTime = block.timestamp;
            currentWindowVolume = 0;
        }

        emit WindowLimitUpdated(_maxVolume, _duration, _enabled);
    }

    /**
     * @notice Reset the current window (emergency function)
     */
    function resetWindow() external onlyOwner {
        windowStartTime = block.timestamp;
        currentWindowVolume = 0;
    }

    // ============ View Functions ============

    /**
     * @notice Get current limits and usage
     * @return txLimit Maximum per-transaction volume
     * @return windowLimit Maximum window volume (0 if disabled)
     * @return windowUsed Volume used in current window
     * @return windowTimeRemaining Seconds until window resets
     */
    function getLimits() external view returns (
        uint256 txLimit,
        uint256 windowLimit,
        uint256 windowUsed,
        uint256 windowTimeRemaining
    ) {
        txLimit = maxTransactionVolume;

        if (windowLimitEnabled) {
            windowLimit = maxWindowVolume;
            windowUsed = _getCurrentWindowVolume();
            uint256 elapsed = block.timestamp - windowStartTime;
            windowTimeRemaining = elapsed >= windowDuration ? 0 : windowDuration - elapsed;
        }
    }

    /**
     * @notice Check if limit is effectively disabled (set to max uint256)
     * @return True if transaction limit is disabled
     */
    function isTransactionLimitDisabled() external view returns (bool) {
        return maxTransactionVolume == type(uint256).max;
    }

    // ============ Internal Functions ============

    /**
     * @notice Calculate total volume from values array
     * @param values Array of values
     * @return total Sum of all values
     */
    function _calculateTotalVolume(uint256[] calldata values) internal pure returns (uint256 total) {
        for (uint256 i = 0; i < values.length; i++) {
            total += values[i];
        }
    }

    /**
     * @notice Get current window volume (accounts for window reset)
     * @return Current volume in the active window
     */
    function _getCurrentWindowVolume() internal view returns (uint256) {
        if (!windowLimitEnabled) return 0;

        uint256 elapsed = block.timestamp - windowStartTime;
        if (elapsed >= windowDuration) {
            return 0; // Window has expired, would be reset
        }
        return currentWindowVolume;
    }

    /**
     * @notice Update window state if expired
     */
    function _updateWindow() internal {
        if (!windowLimitEnabled) return;

        uint256 elapsed = block.timestamp - windowStartTime;
        if (elapsed >= windowDuration) {
            windowStartTime = block.timestamp;
            currentWindowVolume = 0;
        }
    }
}
