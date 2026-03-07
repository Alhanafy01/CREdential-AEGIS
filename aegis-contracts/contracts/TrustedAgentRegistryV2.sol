// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReceiverTemplate} from "./ReceiverTemplate.sol";

/**
 * @title IRouterClient - Chainlink CCIP Router Interface
 * @dev Interface for cross-chain messaging via CCIP
 */
interface IRouterClient {
    struct EVM2AnyMessage {
        bytes receiver;
        bytes data;
        EVMTokenAmount[] tokenAmounts;
        address feeToken;
        bytes extraArgs;
    }

    struct EVMTokenAmount {
        address token;
        uint256 amount;
    }

    function ccipSend(uint64 destinationChainSelector, EVM2AnyMessage calldata message) external payable returns (bytes32);
    function getFee(uint64 destinationChainSelector, EVM2AnyMessage calldata message) external view returns (uint256);
}

/**
 * @title TrustedAgentRegistryV2
 * @notice Institutional-Grade Registry for World ID verified AI agents
 * @dev V2 Features:
 *   - Dual-Token Model: LINK staking + AEGIS rewards
 *   - Strict CRE Access Control via ReceiverTemplate
 *   - Dynamic ACE reputation export
 *   - CCIP Cross-Chain Identity Hub (auto-broadcast on verification)
 *
 * Report Types (CRE Payload Multiplexing):
 *   - Type 1 (VERIFY): World ID verification + auto CCIP broadcast
 *   - Type 2 (REPUTATION): Reputation delta update (+/-)
 *   - Type 3 (SLASH): Stake slashing for malicious behavior
 *   - Type 4 (REWARD): AEGIS reward distribution for correct quorum
 *
 * Workflow Assignment:
 *   - Workflow 1 (CRE Onboarding): VERIFY only
 *   - Workflow 2 (CRE Council): REPUTATION, SLASH, REWARD
 */
contract TrustedAgentRegistryV2 is ReceiverTemplate {
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct Agent {
        uint256 agentId;
        address agentAddress;
        address owner;
        bytes32 humanIdHash;      // From World ID nullifier
        bool verified;
        uint256 stake;            // LINK tokens staked
        int256 reputation;
        string metadataURI;
    }

    // ============ Enums ============

    /// @notice Report types for CRE payload multiplexing
    enum ReportType {
        NONE,           // 0 - Invalid
        VERIFY,         // 1 - World ID verification (Workflow 1)
        REPUTATION,     // 2 - Reputation update (Workflow 2)
        SLASH,          // 3 - Stake slashing (Workflow 2)
        REWARD          // 4 - AEGIS reward distribution (Workflow 2)
    }

    // ============ Events ============

    event AgentRegistered(uint256 indexed agentId, address indexed owner, address agentAddress, string metadataURI, bytes worldIdPayload);
    event AgentVerified(uint256 indexed agentId, bytes32 humanIdHash);
    event StakeChanged(uint256 indexed agentId, uint256 newStake, bool isIncrease);
    event ReputationChanged(uint256 indexed agentId, int256 newReputation, int256 delta);
    event AgentSlashed(uint256 indexed agentId, uint256 slashAmount, int256 reputationPenalty);
    event AgentRewarded(uint256 indexed agentId, uint256 aegisAmount);
    event RewardsDeposited(address indexed funder, uint256 amount);
    event CCIPIdentityBroadcast(uint256 indexed agentId, uint64 indexed destinationChain, bytes32 messageId);

    // ============ State Variables ============

    mapping(uint256 => Agent) public agents;
    mapping(address => uint256) public agentIdByAddress;
    uint256 public nextAgentId = 1;

    // Dual-Token Model
    address public immutable linkToken;     // LINK for staking (0x514910771AF9Ca656af840dff83E8264EcF986CA)
    address public immutable aegisToken;    // AEGIS for rewards

    // CCIP Configuration
    address public immutable ccipRouter;
    uint64 public constant BASE_CHAIN_SELECTOR = 15971525489660198786;  // Base Mainnet

    // Access Control
    address public controller;              // Emergency admin
    address public treasury;                // Receives slashed funds

    // Reward Pool Tracking
    uint256 public rewardPoolBalance;       // Available AEGIS for rewards

    // ============ Errors ============

    error AgentNotFound(uint256 agentId);
    error AgentAlreadyVerified(uint256 agentId);
    error NotAgentOwner(uint256 agentId, address caller);
    error InsufficientStake(uint256 agentId, uint256 required, uint256 available);
    error InsufficientRewardPool(uint256 required, uint256 available);
    error InvalidReportType(uint8 reportType);
    error ZeroAmount();
    error CCIPFeeExceedsBalance(uint256 fee, uint256 balance);

    // ============ Constructor ============

    /**
     * @notice Initialize the V2 registry with dual-token model and CCIP
     * @param _linkToken LINK token address for staking
     * @param _aegisToken AEGIS token address for rewards
     * @param _ccipRouter Chainlink CCIP Router address
     * @param _forwarder Chainlink CRE Forwarder address
     * @param _controller Emergency admin address
     * @param _treasury Treasury address for slashed funds
     */
    constructor(
        address _linkToken,
        address _aegisToken,
        address _ccipRouter,
        address _forwarder,
        address _controller,
        address _treasury
    ) ReceiverTemplate(_forwarder) {
        linkToken = _linkToken;
        aegisToken = _aegisToken;
        ccipRouter = _ccipRouter;
        controller = _controller;
        treasury = _treasury;
    }

    // ============ Modifiers ============

    modifier onlyController() {
        require(msg.sender == controller, "TrustedAgentRegistryV2: not controller");
        _;
    }

    // ============ Core Registration ============

    /**
     * @notice Register a new agent with World ID proof
     * @param metadataURI URI pointing to agent metadata (IPFS or data URI)
     * @param worldIdPayload ABI-encoded World ID proof
     * @return agentId The ID of the newly registered agent
     */
    function registerAgent(string calldata metadataURI, bytes calldata worldIdPayload) external returns (uint256 agentId) {
        agentId = nextAgentId++;
        Agent storage a = agents[agentId];
        a.agentId = agentId;
        a.agentAddress = msg.sender;
        a.owner = msg.sender;
        a.metadataURI = metadataURI;

        agentIdByAddress[msg.sender] = agentId;
        emit AgentRegistered(agentId, msg.sender, msg.sender, metadataURI, worldIdPayload);
    }

    // ============ Task 1: Dual-Tokenomics (LINK Staking) ============

    /**
     * @notice Stake LINK tokens for an agent
     * @param agentId The agent ID to stake for
     * @param amount Amount of LINK to stake
     */
    function stake(uint256 agentId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Agent storage a = agents[agentId];
        if (a.owner == address(0)) revert AgentNotFound(agentId);
        if (msg.sender != a.owner) revert NotAgentOwner(agentId, msg.sender);

        IERC20(linkToken).safeTransferFrom(msg.sender, address(this), amount);
        a.stake += amount;

        emit StakeChanged(agentId, a.stake, true);
    }

    /**
     * @notice Unstake LINK tokens from an agent
     * @param agentId The agent ID to unstake from
     * @param amount Amount of LINK to unstake
     */
    function unstake(uint256 agentId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Agent storage a = agents[agentId];
        if (a.owner == address(0)) revert AgentNotFound(agentId);
        if (msg.sender != a.owner) revert NotAgentOwner(agentId, msg.sender);
        if (a.stake < amount) revert InsufficientStake(agentId, amount, a.stake);

        a.stake -= amount;
        IERC20(linkToken).safeTransfer(msg.sender, amount);

        emit StakeChanged(agentId, a.stake, false);
    }

    /**
     * @notice Deposit AEGIS tokens into the reward pool
     * @param amount Amount of AEGIS to deposit
     * @dev Owner or any funder can call this to fund rewards
     */
    function depositRewards(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        IERC20(aegisToken).safeTransferFrom(msg.sender, address(this), amount);
        rewardPoolBalance += amount;

        emit RewardsDeposited(msg.sender, amount);
    }

    /**
     * @notice Internal function to reward an agent with AEGIS tokens
     * @param agentId The agent ID to reward
     * @param amount Amount of AEGIS to reward
     * @dev Called via CRE _processReport (REWARD type)
     */
    function _rewardAgent(uint256 agentId, uint256 amount) internal {
        Agent storage a = agents[agentId];
        if (a.owner == address(0)) revert AgentNotFound(agentId);
        if (rewardPoolBalance < amount) revert InsufficientRewardPool(amount, rewardPoolBalance);

        rewardPoolBalance -= amount;
        IERC20(aegisToken).safeTransfer(a.owner, amount);

        emit AgentRewarded(agentId, amount);
    }

    // ============ Task 2: CRE Access Control via _processReport ============

    /**
     * @notice Process reports from CRE workflow via Chainlink Forwarder
     * @param report ABI-encoded report with ReportType as first parameter
     * @dev Payload format: abi.encode(uint8 reportType, ...params)
     *
     * Report Formats:
     *   - VERIFY (1): (uint8, uint256 agentId, bytes32 humanIdHash) - 96 bytes
     *   - REPUTATION (2): (uint8, uint256 agentId, int256 delta) - 96 bytes
     *   - SLASH (3): (uint8, uint256 agentId, uint256 slashAmount, int256 reputationPenalty) - 128 bytes
     *   - REWARD (4): (uint8, uint256 agentId, uint256 aegisAmount) - 96 bytes
     *   - Legacy VERIFY: (uint256 agentId, bytes32 humanIdHash) - 64 bytes (backward compatible)
     */
    function _processReport(bytes calldata report) internal override {
        if (report.length < 64) revert InvalidReportType(0);

        // Legacy format detection: 64 bytes = (uint256 agentId, bytes32 humanIdHash)
        // V2 format: 96+ bytes = (uint8 reportType, uint256 agentId, ...)
        if (report.length == 64) {
            // Legacy V1 format: direct verification
            (uint256 agentId, bytes32 humanIdHash) = abi.decode(report, (uint256, bytes32));
            _processVerification(agentId, humanIdHash);
            return;
        }

        // V2 format: decode ReportType from first 32 bytes (uint8 padded to 32 bytes)
        uint8 reportTypeRaw = uint8(report[31]);
        ReportType reportType = ReportType(reportTypeRaw);

        if (reportType == ReportType.VERIFY) {
            // Workflow 1: World ID Verification + Auto CCIP Broadcast
            (, uint256 agentId, bytes32 humanIdHash) = abi.decode(report, (uint8, uint256, bytes32));
            _processVerification(agentId, humanIdHash);

        } else if (reportType == ReportType.REPUTATION) {
            // Workflow 2: Reputation Update
            (, uint256 agentId, int256 delta) = abi.decode(report, (uint8, uint256, int256));
            _processReputationUpdate(agentId, delta);

        } else if (reportType == ReportType.SLASH) {
            // Workflow 2: Stake Slashing
            (, uint256 agentId, uint256 slashAmount, int256 reputationPenalty) = abi.decode(report, (uint8, uint256, uint256, int256));
            _processSlash(agentId, slashAmount, reputationPenalty);

        } else if (reportType == ReportType.REWARD) {
            // Workflow 2: AEGIS Reward Distribution
            (, uint256 agentId, uint256 aegisAmount) = abi.decode(report, (uint8, uint256, uint256));
            _rewardAgent(agentId, aegisAmount);

        } else {
            revert InvalidReportType(reportTypeRaw);
        }
    }

    /**
     * @notice Process World ID verification + auto CCIP broadcast
     * @param agentId The agent ID being verified
     * @param humanIdHash The World ID nullifier hash
     */
    function _processVerification(uint256 agentId, bytes32 humanIdHash) internal {
        Agent storage a = agents[agentId];
        if (a.owner == address(0)) revert AgentNotFound(agentId);
        if (a.verified) revert AgentAlreadyVerified(agentId);

        a.humanIdHash = humanIdHash;
        a.verified = true;

        emit AgentVerified(agentId, humanIdHash);

        // Task 4: Auto-broadcast identity to Base via CCIP
        _broadcastAgentIdentity(agentId, BASE_CHAIN_SELECTOR);
    }

    /**
     * @notice Process reputation update from CRE Council
     * @param agentId The agent ID
     * @param delta Reputation change (+/-)
     */
    function _processReputationUpdate(uint256 agentId, int256 delta) internal {
        Agent storage a = agents[agentId];
        if (a.owner == address(0)) revert AgentNotFound(agentId);

        a.reputation += delta;
        emit ReputationChanged(agentId, a.reputation, delta);
    }

    /**
     * @notice Process stake slashing from CRE Council
     * @param agentId The agent ID to slash
     * @param slashAmount Amount of LINK to slash
     * @param reputationPenalty Reputation points to deduct
     */
    function _processSlash(uint256 agentId, uint256 slashAmount, int256 reputationPenalty) internal {
        Agent storage a = agents[agentId];
        if (a.owner == address(0)) revert AgentNotFound(agentId);
        if (a.stake < slashAmount) revert InsufficientStake(agentId, slashAmount, a.stake);

        // Slash LINK stake
        a.stake -= slashAmount;
        IERC20(linkToken).safeTransfer(treasury, slashAmount);

        // Apply reputation penalty
        if (reputationPenalty != 0) {
            a.reputation -= reputationPenalty;
            emit ReputationChanged(agentId, a.reputation, -reputationPenalty);
        }

        emit AgentSlashed(agentId, slashAmount, reputationPenalty);
        emit StakeChanged(agentId, a.stake, false);
    }

    // ============ Task 3: Dynamic ACE Export ============

    /**
     * @notice Get agent reputation for ACE policy evaluation
     * @param agentId The agent ID to query
     * @return The agent's current reputation score
     * @dev Used by UnifiedExtractor to append reputation to ACE payloads
     */
    function getAgentReputation(uint256 agentId) external view returns (int256) {
        return agents[agentId].reputation;
    }

    /**
     * @notice Get agent stake amount for ACE policy evaluation
     * @param agentId The agent ID to query
     * @return The agent's current LINK stake
     */
    function getAgentStake(uint256 agentId) external view returns (uint256) {
        return agents[agentId].stake;
    }

    // ============ Task 4: CCIP Identity Hub ============

    // CCIP simulation mode - emit event instead of calling real CCIP (for Tenderly)
    bool public ccipSimulationMode = true;

    /**
     * @notice Toggle CCIP simulation mode (for Tenderly testing)
     */
    function setCCIPSimulationMode(bool enabled) external onlyController {
        ccipSimulationMode = enabled;
    }

    /**
     * @notice Broadcast agent identity to destination chain via CCIP
     * @param agentId The agent ID to broadcast
     * @param destinationChainSelector The CCIP chain selector
     * @dev Called automatically on verification, can also be called manually
     */
    function _broadcastAgentIdentity(uint256 agentId, uint64 destinationChainSelector) internal {
        Agent storage a = agents[agentId];

        // Encode agent identity data
        bytes memory identityPayload = abi.encode(
            agentId,
            a.verified,
            a.reputation,
            a.stake,
            a.humanIdHash
        );

        // In simulation mode, just emit event (for Tenderly fork testing)
        if (ccipSimulationMode) {
            bytes32 simulatedMessageId = keccak256(abi.encodePacked(
                agentId,
                destinationChainSelector,
                block.timestamp,
                identityPayload
            ));
            emit CCIPIdentityBroadcast(agentId, destinationChainSelector, simulatedMessageId);
            return;
        }

        // Build CCIP message (no token transfer, just data)
        IRouterClient.EVMTokenAmount[] memory tokenAmounts = new IRouterClient.EVMTokenAmount[](0);

        IRouterClient.EVM2AnyMessage memory message = IRouterClient.EVM2AnyMessage({
            receiver: abi.encode(address(this)),  // Self on destination (or spoke registry)
            data: identityPayload,
            tokenAmounts: tokenAmounts,
            feeToken: linkToken,                  // Pay fees in LINK
            extraArgs: ""                         // Default gas limit
        });

        // Get fee quote
        uint256 fee = IRouterClient(ccipRouter).getFee(destinationChainSelector, message);

        // Check contract has enough LINK for fees
        uint256 linkBalance = IERC20(linkToken).balanceOf(address(this));
        if (linkBalance < fee) revert CCIPFeeExceedsBalance(fee, linkBalance);

        // Approve router to spend LINK for fees
        IERC20(linkToken).approve(ccipRouter, fee);

        // Send CCIP message
        bytes32 messageId = IRouterClient(ccipRouter).ccipSend(destinationChainSelector, message);

        emit CCIPIdentityBroadcast(agentId, destinationChainSelector, messageId);
    }

    /**
     * @notice Manually broadcast agent identity (for re-broadcast or other chains)
     * @param agentId The agent ID to broadcast
     * @param destinationChainSelector The target chain selector
     * @dev Only agent owner can trigger manual broadcast
     */
    function broadcastAgentIdentity(uint256 agentId, uint64 destinationChainSelector) external {
        Agent storage a = agents[agentId];
        if (a.owner == address(0)) revert AgentNotFound(agentId);
        if (msg.sender != a.owner) revert NotAgentOwner(agentId, msg.sender);

        _broadcastAgentIdentity(agentId, destinationChainSelector);
    }

    // ============ View Functions ============

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        return agents[agentId];
    }

    function getAgentIdByAddress(address agentAddress) external view returns (uint256) {
        return agentIdByAddress[agentAddress];
    }

    function isAgentVerified(uint256 agentId) external view returns (bool) {
        return agents[agentId].verified;
    }

    function getAgentMetadataURI(uint256 agentId) external view returns (string memory) {
        return agents[agentId].metadataURI;
    }

    /**
     * @notice Get the available AEGIS reward pool balance
     * @return The amount of AEGIS available for rewards
     */
    function getRewardPoolBalance() external view returns (uint256) {
        return rewardPoolBalance;
    }

    /**
     * @notice Get contract's LINK balance for CCIP fees
     * @return The amount of LINK available for CCIP operations
     */
    function getCCIPFeeBalance() external view returns (uint256) {
        return IERC20(linkToken).balanceOf(address(this));
    }

    // ============ Emergency Admin Functions ============

    /**
     * @notice Emergency slash function (controller only, bypasses CRE)
     * @dev Only for emergency situations when CRE is unavailable
     */
    function emergencySlash(uint256 agentId, uint256 amount, int256 reputationPenalty) external onlyController {
        _processSlash(agentId, amount, reputationPenalty);
    }

    function setController(address _controller) external onlyController {
        controller = _controller;
    }

    function setTreasury(address _treasury) external onlyController {
        treasury = _treasury;
    }

    /**
     * @notice Emergency withdrawal of stuck tokens
     * @param token Token address to withdraw
     * @param amount Amount to withdraw
     * @dev Only controller can call, for emergency recovery
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyController {
        IERC20(token).safeTransfer(controller, amount);
    }
}
