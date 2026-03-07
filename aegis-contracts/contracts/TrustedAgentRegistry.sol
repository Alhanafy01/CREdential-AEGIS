// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReceiverTemplate} from "./ReceiverTemplate.sol";

/**
 * @title TrustedAgentRegistry
 * @notice Registry for World ID verified AI agents with staking and reputation
 * @dev Inherits ReceiverTemplate for secure CRE report reception via Chainlink Forwarder
 */
contract TrustedAgentRegistry is ReceiverTemplate {
    struct Agent {
        uint256 agentId;
        address agentAddress;
        address owner;
        bytes32 humanIdHash; // From World ID nullifier
        bool verified;
        uint256 stake;
        int256 reputation;
        string metadataURI;
    }

    event AgentRegistered(uint256 indexed agentId, address indexed owner, address agentAddress, string metadataURI, bytes worldIdPayload);
    event AgentVerified(uint256 indexed agentId, bytes32 humanIdHash);
    event StakeChanged(uint256 indexed agentId, uint256 newStake);
    event ReputationChanged(uint256 indexed agentId, int256 newReputation, int256 delta);
    event AgentSlashed(uint256 indexed agentId, uint256 amount, int256 reputationPenalty);

    mapping(uint256 => Agent) public agents;
    mapping(address => uint256) public agentIdByAddress;
    uint256 public nextAgentId = 1;

    address public immutable stakingToken;
    address public controller; // Governance/ACE
    address public treasury;

    /**
     * @notice Constructor initializes the registry with required addresses
     * @param _stakingToken Token used for agent staking
     * @param _forwarder Chainlink Simulation Forwarder address for CRE
     * @param _controller Address that can slash agents and update reputation
     * @param _treasury Address that receives slashed funds
     */
    constructor(
        address _stakingToken,
        address _forwarder,
        address _controller,
        address _treasury
    ) ReceiverTemplate(_forwarder) {
        stakingToken = _stakingToken;
        controller = _controller;
        treasury = _treasury;
    }

    modifier onlyController() {
        require(msg.sender == controller, "TrustedAgentRegistry: not controller");
        _;
    }

    // --- Core Actions ---

    /**
     * @notice Register a new agent with World ID proof
     * @param metadataURI URI pointing to agent metadata (IPFS or data URI)
     * @param worldIdPayload ABI-encoded World ID proof (merkleRoot, nullifierHash, proof[8])
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

    // Report types for CRE
    uint8 constant REPORT_TYPE_VERIFY = 1;      // World ID verification
    uint8 constant REPORT_TYPE_REPUTATION = 2;  // Reputation update (reward/penalty)

    /**
     * @notice Process reports from CRE workflow via Chainlink Forwarder
     * @param report ABI-encoded report with format based on type:
     *   - Type 1 (Verify): (uint8 reportType, uint256 agentId, bytes32 humanIdHash)
     *   - Type 2 (Reputation): (uint8 reportType, uint256 agentId, int256 delta)
     *   - Legacy format: (uint256 agentId, bytes32 humanIdHash) - for backward compatibility
     * @dev This function is called by the Forwarder after CRE processes the workflow
     */
    function _processReport(bytes calldata report) internal override {
        // ABI-encoded data pads uint8 to 32 bytes, so new format is 96 bytes (32 + 32 + 32)
        // Legacy format is 64 bytes (32 + 32)
        if (report.length >= 96) {
            // New format: first decode the reportType (uint8 padded to 32 bytes)
            // In ABI encoding, uint8 is padded with leading zeros, so byte[31] contains the value
            uint8 reportType = uint8(report[31]);

            if (reportType == REPORT_TYPE_VERIFY) {
                // Decode: (uint8 reportType, uint256 agentId, bytes32 humanIdHash)
                (, uint256 agentId, bytes32 humanIdHash) = abi.decode(report, (uint8, uint256, bytes32));
                _processVerification(agentId, humanIdHash);
            } else if (reportType == REPORT_TYPE_REPUTATION) {
                // Decode: (uint8 reportType, uint256 agentId, int256 delta)
                (, uint256 agentId, int256 delta) = abi.decode(report, (uint8, uint256, int256));
                _processReputationUpdate(agentId, delta);
            } else {
                revert("TrustedAgentRegistry: unknown report type");
            }
        } else {
            // Legacy format: (uint256 agentId, bytes32 humanIdHash)
            (uint256 agentId, bytes32 humanIdHash) = abi.decode(report, (uint256, bytes32));
            _processVerification(agentId, humanIdHash);
        }
    }

    /**
     * @notice Process World ID verification
     */
    function _processVerification(uint256 agentId, bytes32 humanIdHash) internal {
        Agent storage a = agents[agentId];
        require(a.owner != address(0), "TrustedAgentRegistry: agent not found");
        require(!a.verified, "TrustedAgentRegistry: already verified");

        a.humanIdHash = humanIdHash;
        a.verified = true;

        emit AgentVerified(agentId, humanIdHash);
    }

    /**
     * @notice Process reputation update from CRE (reward or penalty)
     */
    function _processReputationUpdate(uint256 agentId, int256 delta) internal {
        Agent storage a = agents[agentId];
        require(a.owner != address(0), "TrustedAgentRegistry: agent not found");

        a.reputation += delta;
        emit ReputationChanged(agentId, a.reputation, delta);
    }

    function stake(uint256 agentId, uint256 amount) external {
        Agent storage a = agents[agentId];
        require(msg.sender == a.owner, "Not owner");
        require(amount > 0, "Zero amount");
        IERC20(stakingToken).transferFrom(msg.sender, address(this), amount);
        a.stake += amount;
        emit StakeChanged(agentId, a.stake);
    }

    function unstake(uint256 agentId, uint256 amount) external {
        Agent storage a = agents[agentId];
        require(msg.sender == a.owner, "Not owner");
        require(a.stake >= amount, "Insufficient stake");
        a.stake -= amount;
        IERC20(stakingToken).transfer(msg.sender, amount);
        emit StakeChanged(agentId, a.stake);
    }

    function slash(uint256 agentId, uint256 amount, int256 reputationPenalty) external onlyController {
        Agent storage a = agents[agentId];
        require(a.stake >= amount, "Insufficient stake");
        a.stake -= amount;
        IERC20(stakingToken).transfer(treasury, amount);
        if (reputationPenalty != 0) {
            a.reputation -= reputationPenalty;
            emit ReputationChanged(agentId, a.reputation, -reputationPenalty);
        }
        emit AgentSlashed(agentId, amount, reputationPenalty);
        emit StakeChanged(agentId, a.stake);
    }

    function updateReputation(uint256 agentId, int256 delta) external onlyController {
        Agent storage a = agents[agentId];
        require(a.owner != address(0), "Agent not found");
        a.reputation += delta;
        emit ReputationChanged(agentId, a.reputation, delta);
    }

    // --- View Functions ---

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        return agents[agentId];
    }

    function getAgentIdByAddress(address agentAddress) external view returns (uint256) {
        return agentIdByAddress[agentAddress];
    }

    /**
     * @notice Check if an agent is verified (has passed World ID verification)
     * @param agentId The agent ID to check
     * @return True if agent exists and is verified
     */
    function isAgentVerified(uint256 agentId) external view returns (bool) {
        return agents[agentId].verified;
    }

    /**
     * @notice Get agent's metadata URI (for CRE to fetch endpoint)
     * @param agentId The agent ID
     * @return metadataURI The URI pointing to agent's JSON metadata
     */
    function getAgentMetadataURI(uint256 agentId) external view returns (string memory) {
        return agents[agentId].metadataURI;
    }

    // --- Admin Functions ---

    function setController(address _controller) external onlyController {
        controller = _controller;
    }

    function setTreasury(address _treasury) external onlyController {
        treasury = _treasury;
    }
}
