// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReceiverTemplate} from "./ReceiverTemplate.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ITrustedAgentRegistry
 * @notice Interface for TrustedAgentRegistry verification checks
 */
interface ITrustedAgentRegistry {
    function isAgentVerified(uint256 agentId) external view returns (bool);
    function getAgentMetadataURI(uint256 agentId) external view returns (string memory);
}

/**
 * @title StrategyVaultV2
 * @notice Universal AI DeFi Executor with CRE-powered multi-agent quorum execution
 * @dev V2 Features:
 *   - ERC-4626 style deposit/withdraw for pooled assets
 *   - Universal execution via generalized (targets[], values[], calldatas[])
 *   - Atomic execution: all calls must succeed or entire TX reverts
 *   - ReentrancyGuard on all state-changing functions
 *   - CRE-only execution path via _processReport
 *
 * Architecture:
 *   1. Users deposit assets (e.g., USDC) and receive vault shares
 *   2. Users request strategy jobs with verified AI agents
 *   3. Off-chain AI Quorum generates execution instructions
 *   4. CRE delivers instructions via Chainlink Forwarder
 *   5. Vault executes atomic DeFi operations with pooled funds
 *
 * Security:
 *   - Only CRE Forwarder can trigger execution (_processReport)
 *   - ACE Policy Engine validates target whitelist before execution
 *   - ReentrancyGuard prevents reentrancy attacks during .call() loop
 *   - Atomic execution protects against partial route failures
 */
contract StrategyVaultV2 is ReceiverTemplate, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    /// @notice The base asset for this vault (e.g., USDC)
    IERC20 public immutable asset;

    /// @notice TrustedAgentRegistry for agent verification
    address public registry;

    /// @notice Total shares outstanding
    uint256 public totalShares;

    /// @notice Share balances per user
    mapping(address => uint256) public shareBalances;

    // ============ Job State ============

    struct StrategyJob {
        uint256[] agentIds;
        address proposer;
        uint256 createdAt;
        bool completed;
        bool success;
        bytes executionResult;
        string userPrompt;  // Raw natural language intent from user
    }

    mapping(uint256 => StrategyJob) public jobs;
    uint256 public nextJobId = 1;

    // ============ Events ============

    /// @notice Emitted when user deposits assets
    event Deposit(address indexed user, uint256 assets, uint256 shares);

    /// @notice Emitted when user withdraws assets
    event Withdraw(address indexed user, uint256 assets, uint256 shares);

    /// @notice Emitted when a strategy job is created
    /// @dev userPrompt is the raw natural language intent - immutable on-chain record
    event StrategyJobCreated(
        uint256 indexed jobId,
        address indexed proposer,
        uint256[] agentIds,
        string userPrompt
    );

    /// @notice Emitted when CRE executes universal strategy
    event UniversalStrategyExecuted(
        uint256 indexed jobId,
        address[] targets,
        bool success
    );

    /// @notice Emitted for each individual call in the execution loop
    event CallExecuted(
        uint256 indexed jobId,
        uint256 indexed callIndex,
        address target,
        uint256 value,
        bool success
    );

    // ============ Errors ============

    error NoAgentsProvided();
    error JobAlreadyCompleted();
    error JobNotFound();
    error AgentNotVerified(uint256 agentId);
    error RegistryNotSet();
    error ZeroAssets();
    error ZeroShares();
    error InsufficientShares(uint256 requested, uint256 available);
    error InsufficientVaultBalance(uint256 requested, uint256 available);
    error ArrayLengthMismatch(uint256 targets, uint256 values, uint256 calldatas);
    error CallFailed(uint256 callIndex, address target, bytes returnData);
    error EmptyTargets();

    // ============ Constructor ============

    /**
     * @notice Initialize the vault with forwarder and base asset
     * @param _forwarder Chainlink CRE Forwarder address
     * @param _asset Base asset address (e.g., USDC)
     */
    constructor(
        address _forwarder,
        address _asset
    ) ReceiverTemplate(_forwarder) {
        asset = IERC20(_asset);
    }

    // ============ ERC-4626 Style Deposit/Withdraw ============

    /**
     * @notice Deposit assets into the vault and receive shares
     * @param assets Amount of base asset to deposit
     * @return shares Amount of shares minted
     * @dev 1:1 ratio when vault is empty, proportional otherwise
     */
    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAssets();

        // Calculate shares to mint
        uint256 _totalAssets = asset.balanceOf(address(this));
        if (totalShares == 0 || _totalAssets == 0) {
            // First deposit: 1:1 ratio
            shares = assets;
        } else {
            // Proportional: shares = assets * totalShares / totalAssets
            shares = (assets * totalShares) / _totalAssets;
        }

        if (shares == 0) revert ZeroShares();

        // Transfer assets from user
        asset.safeTransferFrom(msg.sender, address(this), assets);

        // Mint shares
        shareBalances[msg.sender] += shares;
        totalShares += shares;

        emit Deposit(msg.sender, assets, shares);
    }

    /**
     * @notice Withdraw assets from the vault by burning shares
     * @param shares Amount of shares to burn
     * @return assets Amount of base asset returned
     */
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroShares();
        if (shareBalances[msg.sender] < shares) {
            revert InsufficientShares(shares, shareBalances[msg.sender]);
        }

        // Calculate assets to return
        uint256 _totalAssets = asset.balanceOf(address(this));
        assets = (shares * _totalAssets) / totalShares;

        if (assets == 0) revert ZeroAssets();
        if (_totalAssets < assets) {
            revert InsufficientVaultBalance(assets, _totalAssets);
        }

        // Burn shares
        shareBalances[msg.sender] -= shares;
        totalShares -= shares;

        // Transfer assets to user
        asset.safeTransfer(msg.sender, assets);

        emit Withdraw(msg.sender, assets, shares);
    }

    /**
     * @notice Preview assets for a given share amount
     * @param shares Share amount to convert
     * @return assets Equivalent asset amount
     */
    function previewRedeem(uint256 shares) external view returns (uint256 assets) {
        if (totalShares == 0) return shares;
        uint256 _totalAssets = asset.balanceOf(address(this));
        return (shares * _totalAssets) / totalShares;
    }

    /**
     * @notice Preview shares for a given asset amount
     * @param assets Asset amount to convert
     * @return shares Equivalent share amount
     */
    function previewDeposit(uint256 assets) external view returns (uint256 shares) {
        uint256 _totalAssets = asset.balanceOf(address(this));
        if (totalShares == 0 || _totalAssets == 0) return assets;
        return (assets * totalShares) / _totalAssets;
    }

    /**
     * @notice Get user's share balance
     * @param user Address to query
     * @return shares User's share balance
     */
    function balanceOf(address user) external view returns (uint256) {
        return shareBalances[user];
    }

    /**
     * @notice Get total assets in the vault
     * @return Total base asset balance
     */
    function totalAssets() external view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    // ============ Strategy Job Creation ============

    /**
     * @notice Request a strategy job with verified AI agents
     * @param agentIds Array of verified agent IDs from TrustedAgentRegistry
     * @param userPrompt Raw natural language intent (e.g., "Swap 500 USDC for WETH using Uniswap V3")
     * @return jobId The created job ID
     * @dev All agents must be World ID verified
     *      userPrompt is stored immutably on-chain as the user's intent record
     *      AI agents interpret this prompt and generate execution calldata
     */
    function requestStrategyJob(
        uint256[] calldata agentIds,
        string calldata userPrompt
    ) external returns (uint256 jobId) {
        if (agentIds.length == 0) revert NoAgentsProvided();
        if (registry == address(0)) revert RegistryNotSet();

        // Validate all agents are World ID verified
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
        job.userPrompt = userPrompt;

        emit StrategyJobCreated(jobId, msg.sender, agentIds, userPrompt);
    }

    // ============ CRE Execution (Universal Executor) ============

    /**
     * @notice Process execution instructions from CRE
     * @param report ABI-encoded (uint256 jobId, address[] targets, uint256[] values, bytes[] calldatas)
     * @dev CRITICAL: This is the ONLY entry point for executing DeFi operations
     *      - Called exclusively by Chainlink Forwarder via ReceiverTemplate
     *      - Executes atomic sequence of .call() operations
     *      - Reverts entire TX if any call fails (protects pooled funds)
     */
    function _processReport(bytes calldata report) internal override nonReentrant {
        // Decode generalized execution instructions
        (
            uint256 jobId,
            address[] memory targets,
            uint256[] memory values,
            bytes[] memory calldatas
        ) = abi.decode(report, (uint256, address[], uint256[], bytes[]));

        // Validate job exists
        StrategyJob storage job = jobs[jobId];
        if (job.proposer == address(0)) revert JobNotFound();
        if (job.completed) revert JobAlreadyCompleted();

        // Validate array lengths match
        if (targets.length != values.length || targets.length != calldatas.length) {
            revert ArrayLengthMismatch(targets.length, values.length, calldatas.length);
        }
        if (targets.length == 0) revert EmptyTargets();

        // Execute atomic call sequence
        _executeCallSequence(jobId, targets, values, calldatas);

        // Mark job as completed
        job.completed = true;
        job.success = true;

        emit UniversalStrategyExecuted(jobId, targets, true);
    }

    /**
     * @notice Execute atomic sequence of external calls
     * @param jobId Job ID for event emission
     * @param targets Array of target contract addresses
     * @param values Array of ETH values to send with each call
     * @param calldatas Array of encoded function calls
     * @dev Reverts entire transaction if ANY call fails (atomic execution)
     */
    function _executeCallSequence(
        uint256 jobId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas
    ) internal {
        for (uint256 i = 0; i < targets.length; i++) {
            address target = targets[i];
            uint256 value = values[i];
            bytes memory callData = calldatas[i];

            // Execute low-level call
            (bool success, bytes memory returnData) = target.call{value: value}(callData);

            // Emit individual call result
            emit CallExecuted(jobId, i, target, value, success);

            // ATOMIC: Revert entire TX if any call fails
            if (!success) {
                revert CallFailed(i, target, returnData);
            }
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get job details
     * @param jobId Job ID to query
     */
    function getJob(uint256 jobId) external view returns (
        uint256[] memory agentIds,
        address proposer,
        uint256 createdAt,
        bool completed,
        bool success,
        string memory userPrompt
    ) {
        StrategyJob storage job = jobs[jobId];
        return (
            job.agentIds,
            job.proposer,
            job.createdAt,
            job.completed,
            job.success,
            job.userPrompt
        );
    }

    /**
     * @notice Get job user prompt (for CRE to read)
     * @param jobId Job ID to query
     * @return userPrompt The raw natural language intent
     */
    function getJobUserPrompt(uint256 jobId) external view returns (string memory) {
        return jobs[jobId].userPrompt;
    }

    /**
     * @notice Check if job is completed
     * @param jobId Job ID to query
     */
    function isJobCompleted(uint256 jobId) external view returns (bool) {
        return jobs[jobId].completed;
    }

    // ============ Admin Functions ============

    /**
     * @notice Set the TrustedAgentRegistry address
     * @param _registry New registry address
     */
    function setRegistry(address _registry) external onlyOwner {
        registry = _registry;
    }

    /**
     * @notice Emergency withdrawal of stuck tokens
     * @param token Token address to withdraw
     * @param amount Amount to withdraw
     * @dev Only owner can call, for emergency recovery only
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    /**
     * @notice Emergency withdrawal of stuck ETH
     * @param amount Amount to withdraw
     */
    function emergencyWithdrawETH(uint256 amount) external onlyOwner {
        (bool success, ) = owner().call{value: amount}("");
        require(success, "ETH transfer failed");
    }

    /// @notice Receive ETH for strategies that return ETH
    receive() external payable {}
}
