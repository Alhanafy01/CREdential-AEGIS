// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReceiverTemplate} from "./ReceiverTemplate.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IRUSD - Interface for RUSD stablecoin
 */
interface IRUSD {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title IRouterClient - Chainlink CCIP Router Interface
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
 * @title AggregatorV3Interface - Chainlink Price Feed Interface
 */
interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

/**
 * @title RWACollateralVault
 * @notice CDP vault for RWA-backed stablecoin with CCIP cross-chain capability
 * @dev Inherits ReceiverTemplate for CRE WriteReport reception
 *
 * Key Features:
 * - ETH collateral deposits for RUSD minting
 * - Health factor calculation using Chainlink price feeds (with mock override)
 * - CRE-triggered liquidation via _processReport
 * - CCIP cross-chain transfers for healthy positions
 * - 130% collateralization ratio requirement
 */
contract RWACollateralVault is ReceiverTemplate, ReentrancyGuard {
    // ============ Constants ============
    uint256 public constant COLLATERAL_RATIO = 130; // 130% = 1.3x
    uint256 public constant LIQUIDATION_BONUS = 10; // 10% bonus for liquidators
    uint256 public constant PRECISION = 1e18;

    // CCIP chain selectors (mainnet values)
    uint64 public constant ARBITRUM_SELECTOR = 4949039107694359620;
    uint64 public constant BASE_SELECTOR = 15971525489660198786;
    uint64 public constant OPTIMISM_SELECTOR = 3734403246176062136;

    // ============ State Variables ============
    IRUSD public immutable rusd;
    address public immutable ccipRouter;
    address public immutable linkToken;
    address public priceFeed; // ETH/USD Chainlink feed

    // Mock price for demo (Tenderly State Sync disabled)
    int256 public mockETHPrice; // 8 decimals like real feed
    bool public useMockPrice;

    // Position tracking
    struct Position {
        uint256 collateralETH;  // ETH deposited as collateral
        uint256 debtRUSD;       // RUSD borrowed
        uint256 lastUpdate;     // Timestamp of last position change
    }

    mapping(address => Position) public positions;
    address[] public positionHolders;
    mapping(address => bool) public hasPosition;

    // Total vault stats
    uint256 public totalCollateral;
    uint256 public totalDebt;

    // Guardian job tracking
    uint256 public nextGuardianJobId = 1;

    // ============ Events ============
    event Deposited(address indexed user, uint256 ethAmount);
    event Borrowed(address indexed user, uint256 rusdAmount);
    event Repaid(address indexed user, uint256 rusdAmount);
    event Withdrawn(address indexed user, uint256 ethAmount);
    event Liquidated(address indexed user, uint256 collateralSeized, uint256 debtRepaid, address liquidator);
    event CCIPTransferInitiated(address indexed user, uint64 destinationChain, uint256 amount, bytes32 messageId);
    event MockPriceSet(int256 price);
    event PriceFeedUpdated(address indexed newFeed);
    event RWAGuardianJobCreated(uint256 indexed jobId, address indexed user, bytes jobData);

    // ============ Errors ============
    error InsufficientCollateral();
    error HealthyPosition();
    error UnhealthyPosition();
    error ZeroAmount();
    error TransferFailed();
    error InvalidAction();
    error NoPosition();
    error InsufficientFee();

    // ============ Constructor ============
    /**
     * @notice Initialize the RWA Collateral Vault
     * @param _rusd RUSD stablecoin address
     * @param _forwarder CRE Forwarder address for WriteReport
     * @param _ccipRouter Chainlink CCIP Router address
     * @param _linkToken LINK token for CCIP fees
     * @param _priceFeed ETH/USD Chainlink price feed
     */
    constructor(
        address _rusd,
        address _forwarder,
        address _ccipRouter,
        address _linkToken,
        address _priceFeed
    ) ReceiverTemplate(_forwarder) {
        rusd = IRUSD(_rusd);
        ccipRouter = _ccipRouter;
        linkToken = _linkToken;
        priceFeed = _priceFeed;

        // Default mock price: $2000 USD (8 decimals)
        mockETHPrice = 2000 * 1e8;
        useMockPrice = true; // Enable mock by default for Tenderly
    }

    // ============ Core CDP Functions ============

    /**
     * @notice Deposit ETH as collateral
     */
    function deposit() external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();

        Position storage pos = positions[msg.sender];
        pos.collateralETH += msg.value;
        pos.lastUpdate = block.timestamp;
        totalCollateral += msg.value;

        if (!hasPosition[msg.sender]) {
            hasPosition[msg.sender] = true;
            positionHolders.push(msg.sender);
        }

        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Borrow RUSD against collateral
     * @param amount Amount of RUSD to borrow
     */
    function borrow(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage pos = positions[msg.sender];
        uint256 newDebt = pos.debtRUSD + amount;

        // Check health factor after borrow
        uint256 collateralValue = _getCollateralValueUSD(pos.collateralETH);
        uint256 maxBorrow = (collateralValue * 100) / COLLATERAL_RATIO;

        if (newDebt > maxBorrow) revert InsufficientCollateral();

        pos.debtRUSD = newDebt;
        pos.lastUpdate = block.timestamp;
        totalDebt += amount;

        rusd.mint(msg.sender, amount);
        emit Borrowed(msg.sender, amount);
    }

    /**
     * @notice Repay RUSD debt
     * @param amount Amount of RUSD to repay
     */
    function repay(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage pos = positions[msg.sender];
        if (amount > pos.debtRUSD) {
            amount = pos.debtRUSD;
        }

        rusd.burn(msg.sender, amount);
        pos.debtRUSD -= amount;
        pos.lastUpdate = block.timestamp;
        totalDebt -= amount;

        emit Repaid(msg.sender, amount);
    }

    /**
     * @notice Withdraw collateral (must maintain health factor)
     * @param amount Amount of ETH to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        Position storage pos = positions[msg.sender];
        if (amount > pos.collateralETH) revert InsufficientCollateral();

        uint256 newCollateral = pos.collateralETH - amount;

        // Check health factor after withdrawal
        if (pos.debtRUSD > 0) {
            uint256 collateralValue = _getCollateralValueUSD(newCollateral);
            uint256 minCollateral = (pos.debtRUSD * COLLATERAL_RATIO) / 100;
            if (collateralValue < minCollateral) revert UnhealthyPosition();
        }

        pos.collateralETH = newCollateral;
        pos.lastUpdate = block.timestamp;
        totalCollateral -= amount;

        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();

        emit Withdrawn(msg.sender, amount);
    }

    // ============ CRE Report Processing ============

    /**
     * @notice Process CRE WriteReport for liquidation or CCIP transfer
     * @param report ABI-encoded report with action type and parameters
     * @dev Report format: (uint8 action, address user, uint256 amount, bytes extraData)
     *   - action 1: LIQUIDATE - Liquidate unhealthy position
     *   - action 2: CCIP_TRANSFER - Cross-chain transfer for healthy position
     */
    function _processReport(bytes calldata report) internal override {
        (uint8 action, address user, uint256 amount, bytes memory extraData) =
            abi.decode(report, (uint8, address, uint256, bytes));

        if (action == 1) {
            // LIQUIDATE
            _executeLiquidation(user, amount);
        } else if (action == 2) {
            // CCIP_TRANSFER
            uint64 destinationChain = abi.decode(extraData, (uint64));
            _executeCCIPTransfer(user, amount, destinationChain);
        } else {
            revert InvalidAction();
        }
    }

    /**
     * @notice Execute liquidation of unhealthy position
     * @param user Position holder to liquidate
     * @param debtToRepay Amount of debt to liquidate
     */
    function _executeLiquidation(address user, uint256 debtToRepay) internal {
        Position storage pos = positions[user];
        if (pos.debtRUSD == 0) revert NoPosition();

        uint256 healthFactor = getHealthFactor(user);
        // Allow liquidation if health factor < 1.5 (150 in basis points / 100)
        if (healthFactor >= 150) revert HealthyPosition();

        // Cap debt to repay at actual debt
        if (debtToRepay > pos.debtRUSD) {
            debtToRepay = pos.debtRUSD;
        }

        // Calculate collateral to seize (with liquidation bonus)
        uint256 ethPrice = getETHPrice();
        uint256 collateralToSeize = (debtToRepay * PRECISION * (100 + LIQUIDATION_BONUS)) / (ethPrice * 100);

        if (collateralToSeize > pos.collateralETH) {
            collateralToSeize = pos.collateralETH;
        }

        // Update position
        pos.debtRUSD -= debtToRepay;
        pos.collateralETH -= collateralToSeize;
        pos.lastUpdate = block.timestamp;

        totalDebt -= debtToRepay;
        totalCollateral -= collateralToSeize;

        // Transfer seized collateral to treasury (owner)
        (bool success,) = owner().call{value: collateralToSeize}("");
        if (!success) revert TransferFailed();

        emit Liquidated(user, collateralToSeize, debtToRepay, address(this));
    }

    /**
     * @notice Execute CCIP cross-chain transfer
     * @param user Position holder
     * @param amount Amount of excess collateral to transfer
     * @param destinationChain CCIP chain selector
     * @dev For demo purposes, this simulates CCIP by emitting an event and adjusting position
     *      In production, this would call the actual CCIP router
     */
    function _executeCCIPTransfer(address user, uint256 amount, uint64 destinationChain) internal {
        Position storage pos = positions[user];

        // Only allow transfer for healthy positions
        uint256 healthFactor = getHealthFactor(user);
        if (healthFactor < 200) revert UnhealthyPosition(); // Require HF > 2.0 for CCIP

        // Calculate excess collateral that can be transferred
        // Excess = collateral - (debt * 1.3 * 2.0) to maintain HF >= 2.0 after transfer
        uint256 minCollateralValue = (pos.debtRUSD * COLLATERAL_RATIO * 2) / 100;
        uint256 currentCollateralValue = _getCollateralValueUSD(pos.collateralETH);

        if (currentCollateralValue <= minCollateralValue) {
            // No excess to transfer
            emit CCIPTransferInitiated(user, destinationChain, 0, bytes32(0));
            return;
        }

        uint256 excessValueUSD = currentCollateralValue - minCollateralValue;
        uint256 ethPrice = getETHPrice();
        uint256 excessETH = (excessValueUSD * 1e8) / ethPrice;

        // Cap at requested amount (convert amount from RUSD to ETH)
        uint256 requestedETH = (amount * 1e8) / ethPrice;
        if (excessETH > requestedETH) {
            excessETH = requestedETH;
        }

        // Cap at available collateral
        if (excessETH > pos.collateralETH) {
            excessETH = pos.collateralETH;
        }

        // For demo: Simulate CCIP by reducing collateral and emitting event
        // In production, this would send via actual CCIP router
        if (excessETH > 0) {
            pos.collateralETH -= excessETH;
            pos.lastUpdate = block.timestamp;
            totalCollateral -= excessETH;

            // Generate a pseudo message ID for the event
            bytes32 messageId = keccak256(abi.encodePacked(user, block.timestamp, excessETH, destinationChain));

            emit CCIPTransferInitiated(user, destinationChain, excessETH, messageId);
        }
    }

    // ============ View Functions ============

    /**
     * @notice Get current ETH price in USD (8 decimals)
     */
    function getETHPrice() public view returns (uint256) {
        if (useMockPrice) {
            return uint256(mockETHPrice);
        }

        (, int256 price,,,) = AggregatorV3Interface(priceFeed).latestRoundData();
        return uint256(price);
    }

    /**
     * @notice Calculate collateral value in USD (18 decimals)
     * @param ethAmount Amount of ETH
     */
    function _getCollateralValueUSD(uint256 ethAmount) internal view returns (uint256) {
        uint256 ethPrice = getETHPrice();
        // ETH amount is 18 decimals, price is 8 decimals
        // Result: (18 + 8 - 8) = 18 decimals
        return (ethAmount * ethPrice) / 1e8;
    }

    /**
     * @notice Get health factor for a position (100 = 1.0)
     * @param user Position holder address
     * @return healthFactor Health factor * 100 (e.g., 150 = 1.5)
     */
    function getHealthFactor(address user) public view returns (uint256) {
        Position memory pos = positions[user];
        if (pos.debtRUSD == 0) return type(uint256).max;

        uint256 collateralValue = _getCollateralValueUSD(pos.collateralETH);
        // healthFactor = (collateralValue / (debt * 1.3)) * 100
        // Simplified: (collateralValue * 100) / (debt * 130 / 100)
        // = (collateralValue * 100 * 100) / (debt * 130)
        return (collateralValue * 10000) / (pos.debtRUSD * COLLATERAL_RATIO);
    }

    /**
     * @notice Get position details for CRE to read
     * @param user Position holder
     */
    function getPosition(address user) external view returns (
        uint256 collateralETH,
        uint256 debtRUSD,
        uint256 healthFactor,
        uint256 ethPriceUSD
    ) {
        Position memory pos = positions[user];
        return (
            pos.collateralETH,
            pos.debtRUSD,
            getHealthFactor(user),
            getETHPrice()
        );
    }

    /**
     * @notice Get all position holders
     */
    function getPositionHolders() external view returns (address[] memory) {
        return positionHolders;
    }

    /**
     * @notice Get vault statistics
     */
    function getVaultStats() external view returns (
        uint256 _totalCollateral,
        uint256 _totalDebt,
        uint256 _ethPrice,
        uint256 _collateralRatio
    ) {
        return (totalCollateral, totalDebt, getETHPrice(), COLLATERAL_RATIO);
    }

    // ============ Admin Functions ============

    /**
     * @notice Set mock ETH price for demo purposes
     * @param _price Price in 8 decimals (e.g., 2000e8 for $2000)
     */
    function setMockETHPrice(int256 _price) external onlyOwner {
        mockETHPrice = _price;
        emit MockPriceSet(_price);
    }

    /**
     * @notice Toggle between mock and real price feed
     * @param _useMock True to use mock price
     */
    function setUseMockPrice(bool _useMock) external onlyOwner {
        useMockPrice = _useMock;
    }

    /**
     * @notice Update price feed address
     * @param _priceFeed New Chainlink price feed
     */
    function setPriceFeed(address _priceFeed) external onlyOwner {
        priceFeed = _priceFeed;
        emit PriceFeedUpdated(_priceFeed);
    }

    // ============ CRE Trigger Function ============

    /**
     * @notice Request a guardian job for position monitoring
     * @param agentIds Array of agent IDs to participate in the job
     * @return jobId The ID of the created job
     * @dev Emits RWAGuardianJobCreated event that CRE workflow listens for
     */
    function requestGuardianJob(uint256[] calldata agentIds) external returns (uint256) {
        Position memory pos = positions[msg.sender];
        if (pos.collateralETH == 0 && pos.debtRUSD == 0) revert NoPosition();

        uint256 jobId = nextGuardianJobId++;
        bytes memory jobData = abi.encode(agentIds, msg.sender);

        emit RWAGuardianJobCreated(jobId, msg.sender, jobData);

        return jobId;
    }

    // ============ Receive ETH ============
    receive() external payable {
        // Accept ETH for liquidation proceeds
    }
}
