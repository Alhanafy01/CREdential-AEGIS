// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FlightInsurance
 * @notice A flight delay/cancellation insurance protocol that integrates with the AEGIS Universal Executor
 * @dev Only the AI Universal Executor (StrategyVault) can approve and process claims
 *
 * This demonstrates how third-party protocols can delegate claim verification
 * to AI agents coordinated by Chainlink CRE, with execution through our Universal Executor.
 */
contract FlightInsurance is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Structs ============
    struct Policy {
        address user;
        string flightNumber;
        uint256 payoutAmount;
        uint256 premium;
        uint256 purchaseTime;
        bool isActive;
    }

    // ============ State Variables ============

    /// @notice The Universal Executor (StrategyVault) that can process claims
    address public immutable universalExecutor;

    /// @notice The USDC token used for premiums and payouts
    IERC20 public immutable usdcToken;

    /// @notice Premium rate as percentage (e.g., 10 = 10%)
    uint256 public constant PREMIUM_RATE = 10;

    /// @notice Mapping of policy ID to Policy struct
    mapping(uint256 => Policy) public policies;

    /// @notice Counter for policy IDs (starts at 1)
    uint256 public policyCount;

    /// @notice Total premiums collected
    uint256 public totalPremiumsCollected;

    /// @notice Total payouts made
    uint256 public totalPayoutsMade;

    // ============ Events ============

    event PolicyPurchased(
        uint256 indexed policyId,
        address indexed user,
        string flightNumber,
        uint256 premium,
        uint256 payoutAmount
    );

    event ClaimProcessed(
        uint256 indexed policyId,
        address indexed user,
        uint256 payoutAmount,
        string flightNumber
    );

    event PolicyCancelled(
        uint256 indexed policyId,
        address indexed user,
        uint256 refundAmount
    );

    // ============ Errors ============

    error OnlyUniversalExecutor();
    error PolicyNotActive();
    error PolicyNotFound();
    error InsufficientPremium();
    error InsufficientContractBalance();
    error TransferFailed();

    // ============ Constructor ============

    /**
     * @notice Initialize the FlightInsurance contract
     * @param _universalExecutor Address of the StrategyVault (Universal Executor)
     * @param _usdcToken Address of the USDC token
     */
    constructor(address _universalExecutor, address _usdcToken) {
        require(_universalExecutor != address(0), "Invalid executor");
        require(_usdcToken != address(0), "Invalid USDC");

        universalExecutor = _universalExecutor;
        usdcToken = IERC20(_usdcToken);
    }

    // ============ External Functions ============

    /**
     * @notice Purchase a flight insurance policy
     * @param flightNumber The flight number to insure (e.g., "AA667")
     * @param payoutAmount The desired payout amount if claim is approved (in USDC, 6 decimals)
     * @return policyId The ID of the newly created policy
     *
     * @dev User must approve this contract to spend premium amount before calling
     * Premium is calculated as PREMIUM_RATE% of payoutAmount
     */
    function buyPolicy(
        string calldata flightNumber,
        uint256 payoutAmount
    ) external nonReentrant returns (uint256 policyId) {
        require(bytes(flightNumber).length > 0, "Invalid flight number");
        require(payoutAmount > 0, "Invalid payout amount");

        // Calculate premium (10% of payout)
        uint256 premium = (payoutAmount * PREMIUM_RATE) / 100;
        require(premium > 0, "Premium too small");

        // Transfer premium from user to this contract
        usdcToken.safeTransferFrom(msg.sender, address(this), premium);

        // Create the policy
        policyCount++;
        policyId = policyCount;

        policies[policyId] = Policy({
            user: msg.sender,
            flightNumber: flightNumber,
            payoutAmount: payoutAmount,
            premium: premium,
            purchaseTime: block.timestamp,
            isActive: true
        });

        totalPremiumsCollected += premium;

        emit PolicyPurchased(policyId, msg.sender, flightNumber, premium, payoutAmount);

        return policyId;
    }

    /**
     * @notice Process a claim payout - ONLY callable by Universal Executor
     * @param policyId The ID of the policy to process
     *
     * @dev This function is called by the StrategyVault after AI agents verify
     * the flight was delayed/cancelled via off-chain data sources (e.g., FlightAware API)
     *
     * Security: Only the Universal Executor (controlled by verified AI agents through
     * Chainlink CRE consensus) can trigger payouts. This prevents fraudulent claims.
     */
    function processPayout(uint256 policyId) external nonReentrant {
        // CRITICAL SECURITY: Only the AI Universal Executor can approve claims
        if (msg.sender != universalExecutor) {
            revert OnlyUniversalExecutor();
        }

        Policy storage policy = policies[policyId];

        // Verify policy exists and is active
        if (policy.user == address(0)) {
            revert PolicyNotFound();
        }
        if (!policy.isActive) {
            revert PolicyNotActive();
        }

        // Mark policy as inactive (claimed)
        policy.isActive = false;

        // Check contract has sufficient balance
        uint256 contractBalance = usdcToken.balanceOf(address(this));
        if (contractBalance < policy.payoutAmount) {
            revert InsufficientContractBalance();
        }

        // Transfer payout to the policy holder
        totalPayoutsMade += policy.payoutAmount;
        usdcToken.safeTransfer(policy.user, policy.payoutAmount);

        emit ClaimProcessed(policyId, policy.user, policy.payoutAmount, policy.flightNumber);
    }

    /**
     * @notice Allow policy holder to cancel their policy within 24 hours for 50% refund
     * @param policyId The ID of the policy to cancel
     */
    function cancelPolicy(uint256 policyId) external nonReentrant {
        Policy storage policy = policies[policyId];

        require(policy.user == msg.sender, "Not policy owner");
        require(policy.isActive, "Policy not active");
        require(block.timestamp <= policy.purchaseTime + 24 hours, "Cancellation period expired");

        policy.isActive = false;

        // Refund 50% of premium
        uint256 refund = policy.premium / 2;
        if (refund > 0) {
            usdcToken.safeTransfer(msg.sender, refund);
        }

        emit PolicyCancelled(policyId, msg.sender, refund);
    }

    // ============ View Functions ============

    /**
     * @notice Get policy details
     * @param policyId The ID of the policy
     * @return user The policy holder address
     * @return flightNumber The insured flight number
     * @return payoutAmount The payout amount if claimed
     * @return premium The premium paid
     * @return purchaseTime When the policy was purchased
     * @return isActive Whether the policy is still active
     */
    function getPolicy(uint256 policyId) external view returns (
        address user,
        string memory flightNumber,
        uint256 payoutAmount,
        uint256 premium,
        uint256 purchaseTime,
        bool isActive
    ) {
        Policy storage policy = policies[policyId];
        return (
            policy.user,
            policy.flightNumber,
            policy.payoutAmount,
            policy.premium,
            policy.purchaseTime,
            policy.isActive
        );
    }

    /**
     * @notice Calculate premium for a given payout amount
     * @param payoutAmount The desired payout amount
     * @return premium The premium required
     */
    function calculatePremium(uint256 payoutAmount) external pure returns (uint256 premium) {
        return (payoutAmount * PREMIUM_RATE) / 100;
    }

    /**
     * @notice Get contract statistics
     * @return _policyCount Total policies created
     * @return _totalPremiums Total premiums collected
     * @return _totalPayouts Total payouts made
     * @return _contractBalance Current USDC balance
     */
    function getStats() external view returns (
        uint256 _policyCount,
        uint256 _totalPremiums,
        uint256 _totalPayouts,
        uint256 _contractBalance
    ) {
        return (
            policyCount,
            totalPremiumsCollected,
            totalPayoutsMade,
            usdcToken.balanceOf(address(this))
        );
    }
}
