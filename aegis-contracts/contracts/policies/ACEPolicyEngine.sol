// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./TargetWhitelistPolicy.sol";
import "./TargetBlacklistPolicy.sol";
import "./VolumeLimitPolicy.sol";

/**
 * @title ACEPolicyEngine
 * @notice Chainlink ACE (Automated Compliance Engine) - Orchestrates all policy checks
 * @dev This contract serves as the central firewall before any AI-generated execution
 *
 * Architecture:
 *   1. CRE workflow calls validateExecution() with decoded payload
 *   2. ACEPolicyEngine runs all registered policies sequentially
 *   3. If ALL policies pass, execution is allowed to proceed
 *   4. If ANY policy fails, execution is blocked with specific error
 *
 * Execution Flow:
 *   User Request → CRE → AI Agents → Consensus → UnifiedExtractor → ACEPolicyEngine → StrategyVault
 *
 * Security Model:
 *   - Whitelist: Only approved DeFi protocols can be called
 *   - Blacklist: OFAC/sanctioned addresses are blocked
 *   - Volume: Transaction size limits prevent catastrophic losses
 *   - All policies are modular and can be upgraded independently
 */
contract ACEPolicyEngine is Ownable {
    // ============ Policy Contracts ============

    /// @notice Target whitelist policy contract
    TargetWhitelistPolicy public whitelistPolicy;

    /// @notice Target blacklist policy contract
    TargetBlacklistPolicy public blacklistPolicy;

    /// @notice Volume limit policy contract
    VolumeLimitPolicy public volumePolicy;

    // ============ Configuration ============

    /// @notice Whether whitelist policy is enabled
    bool public whitelistEnabled;

    /// @notice Whether blacklist policy is enabled
    bool public blacklistEnabled;

    /// @notice Whether volume policy is enabled
    bool public volumeEnabled;

    /// @notice Emergency pause - blocks ALL executions
    bool public paused;

    // ============ Events ============

    event PolicyEngineValidation(
        uint256 indexed jobId,
        bool passed,
        bool whitelistPassed,
        bool blacklistPassed,
        bool volumePassed
    );
    event PolicyUpdated(string policyName, address newAddress);
    event PolicyToggled(string policyName, bool enabled);
    event EmergencyPause(bool paused);

    // ============ Errors ============

    error ExecutionPaused();
    error WhitelistValidationFailed(address[] invalidTargets);
    error BlacklistValidationFailed(address[] blockedTargets);
    error VolumeValidationFailed(uint256 requested, uint256 limit);
    error NoPoliciesEnabled();

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        // All policies disabled by default until configured
        whitelistEnabled = false;
        blacklistEnabled = false;
        volumeEnabled = false;
        paused = false;
    }

    // ============ Main Validation Functions ============

    /**
     * @notice Validate execution payload against all enabled policies
     * @param targets Array of target addresses from AI response
     * @param values Array of values (ETH amounts) from AI response
     * @return valid True if all enabled policies pass
     * @dev Called by StrategyVault or CRE before execution
     */
    function validateExecution(
        address[] calldata targets,
        uint256[] calldata values
    ) external view returns (bool valid) {
        if (paused) revert ExecutionPaused();

        // Whitelist check
        if (whitelistEnabled && address(whitelistPolicy) != address(0)) {
            whitelistPolicy.validate(targets);
        }

        // Blacklist check
        if (blacklistEnabled && address(blacklistPolicy) != address(0)) {
            blacklistPolicy.validate(targets);
        }

        // Volume check
        if (volumeEnabled && address(volumePolicy) != address(0)) {
            volumePolicy.validate(values);
        }

        return true;
    }

    /**
     * @notice Validate with job context and emit detailed events
     * @param jobId The job ID for tracking
     * @param targets Array of target addresses
     * @param values Array of values
     * @return valid True if all enabled policies pass
     */
    function validateExecutionWithContext(
        uint256 jobId,
        address[] calldata targets,
        uint256[] calldata values
    ) external returns (bool valid) {
        if (paused) revert ExecutionPaused();

        bool whitelistPassed = true;
        bool blacklistPassed = true;
        bool volumePassed = true;

        // Whitelist check
        if (whitelistEnabled && address(whitelistPolicy) != address(0)) {
            try whitelistPolicy.validateWithContext(jobId, targets) {
                whitelistPassed = true;
            } catch {
                whitelistPassed = false;
            }
        }

        // Blacklist check
        if (blacklistEnabled && address(blacklistPolicy) != address(0)) {
            try blacklistPolicy.validateWithContext(jobId, targets) {
                blacklistPassed = true;
            } catch {
                blacklistPassed = false;
            }
        }

        // Volume check
        if (volumeEnabled && address(volumePolicy) != address(0)) {
            try volumePolicy.validateWithContext(jobId, values) {
                volumePassed = true;
            } catch {
                volumePassed = false;
            }
        }

        bool allPassed = whitelistPassed && blacklistPassed && volumePassed;

        emit PolicyEngineValidation(
            jobId,
            allPassed,
            whitelistPassed,
            blacklistPassed,
            volumePassed
        );

        return allPassed;
    }

    /**
     * @notice Check policies without reverting - returns detailed results
     * @param targets Array of target addresses
     * @param values Array of values
     * @return allValid True if all enabled policies would pass
     * @return whitelistResult Whitelist check result
     * @return blacklistResult Blacklist check result
     * @return volumeResult Volume check result
     * @return invalidWhitelist Addresses not in whitelist
     * @return blockedBlacklist Addresses in blacklist
     */
    function checkExecution(
        address[] calldata targets,
        uint256[] calldata values
    ) external view returns (
        bool allValid,
        bool whitelistResult,
        bool blacklistResult,
        bool volumeResult,
        address[] memory invalidWhitelist,
        address[] memory blockedBlacklist
    ) {
        if (paused) {
            return (false, false, false, false, new address[](0), new address[](0));
        }

        whitelistResult = true;
        blacklistResult = true;
        volumeResult = true;

        // Whitelist check
        if (whitelistEnabled && address(whitelistPolicy) != address(0)) {
            (whitelistResult, invalidWhitelist) = whitelistPolicy.checkTargets(targets);
        }

        // Blacklist check
        if (blacklistEnabled && address(blacklistPolicy) != address(0)) {
            (blacklistResult, blockedBlacklist) = blacklistPolicy.checkTargets(targets);
        }

        // Volume check
        if (volumeEnabled && address(volumePolicy) != address(0)) {
            (volumeResult, , , ) = volumePolicy.checkVolume(values);
        }

        allValid = whitelistResult && blacklistResult && volumeResult;
    }

    // ============ Policy Management ============

    /**
     * @notice Set the whitelist policy contract
     * @param _policy Address of TargetWhitelistPolicy
     */
    function setWhitelistPolicy(address _policy) external onlyOwner {
        whitelistPolicy = TargetWhitelistPolicy(_policy);
        emit PolicyUpdated("whitelist", _policy);
    }

    /**
     * @notice Set the blacklist policy contract
     * @param _policy Address of TargetBlacklistPolicy
     */
    function setBlacklistPolicy(address _policy) external onlyOwner {
        blacklistPolicy = TargetBlacklistPolicy(_policy);
        emit PolicyUpdated("blacklist", _policy);
    }

    /**
     * @notice Set the volume policy contract
     * @param _policy Address of VolumeLimitPolicy
     */
    function setVolumePolicy(address _policy) external onlyOwner {
        volumePolicy = VolumeLimitPolicy(_policy);
        emit PolicyUpdated("volume", _policy);
    }

    /**
     * @notice Enable or disable whitelist policy
     * @param _enabled Whether to enable
     */
    function setWhitelistEnabled(bool _enabled) external onlyOwner {
        whitelistEnabled = _enabled;
        emit PolicyToggled("whitelist", _enabled);
    }

    /**
     * @notice Enable or disable blacklist policy
     * @param _enabled Whether to enable
     */
    function setBlacklistEnabled(bool _enabled) external onlyOwner {
        blacklistEnabled = _enabled;
        emit PolicyToggled("blacklist", _enabled);
    }

    /**
     * @notice Enable or disable volume policy
     * @param _enabled Whether to enable
     */
    function setVolumeEnabled(bool _enabled) external onlyOwner {
        volumeEnabled = _enabled;
        emit PolicyToggled("volume", _enabled);
    }

    /**
     * @notice Configure all policies at once
     * @param _whitelistPolicy Whitelist policy address
     * @param _blacklistPolicy Blacklist policy address
     * @param _volumePolicy Volume policy address
     * @param _enableWhitelist Whether to enable whitelist
     * @param _enableBlacklist Whether to enable blacklist
     * @param _enableVolume Whether to enable volume
     */
    function configureAll(
        address _whitelistPolicy,
        address _blacklistPolicy,
        address _volumePolicy,
        bool _enableWhitelist,
        bool _enableBlacklist,
        bool _enableVolume
    ) external onlyOwner {
        if (_whitelistPolicy != address(0)) {
            whitelistPolicy = TargetWhitelistPolicy(_whitelistPolicy);
            emit PolicyUpdated("whitelist", _whitelistPolicy);
        }
        if (_blacklistPolicy != address(0)) {
            blacklistPolicy = TargetBlacklistPolicy(_blacklistPolicy);
            emit PolicyUpdated("blacklist", _blacklistPolicy);
        }
        if (_volumePolicy != address(0)) {
            volumePolicy = VolumeLimitPolicy(_volumePolicy);
            emit PolicyUpdated("volume", _volumePolicy);
        }

        whitelistEnabled = _enableWhitelist;
        blacklistEnabled = _enableBlacklist;
        volumeEnabled = _enableVolume;

        emit PolicyToggled("whitelist", _enableWhitelist);
        emit PolicyToggled("blacklist", _enableBlacklist);
        emit PolicyToggled("volume", _enableVolume);
    }

    // ============ Emergency Functions ============

    /**
     * @notice Emergency pause - blocks all executions
     * @param _paused Whether to pause
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit EmergencyPause(_paused);
    }

    // ============ View Functions ============

    /**
     * @notice Get all policy addresses and statuses
     * @return whitelist Whitelist policy address
     * @return blacklist Blacklist policy address
     * @return volume Volume policy address
     * @return whitelistOn Whether whitelist is enabled
     * @return blacklistOn Whether blacklist is enabled
     * @return volumeOn Whether volume is enabled
     * @return isPaused Whether engine is paused
     */
    function getPolicyStatus() external view returns (
        address whitelist,
        address blacklist,
        address volume,
        bool whitelistOn,
        bool blacklistOn,
        bool volumeOn,
        bool isPaused
    ) {
        return (
            address(whitelistPolicy),
            address(blacklistPolicy),
            address(volumePolicy),
            whitelistEnabled,
            blacklistEnabled,
            volumeEnabled,
            paused
        );
    }

    /**
     * @notice Check if any policies are enabled
     * @return True if at least one policy is active
     */
    function hasActivePolicies() external view returns (bool) {
        return (whitelistEnabled && address(whitelistPolicy) != address(0)) ||
               (blacklistEnabled && address(blacklistPolicy) != address(0)) ||
               (volumeEnabled && address(volumePolicy) != address(0));
    }
}
