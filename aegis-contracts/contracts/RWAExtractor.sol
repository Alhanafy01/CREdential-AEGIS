// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IACEExtractor
 * @notice Interface for Chainlink ACE extractors
 */
interface IACEExtractor {
    function extract(bytes calldata callData) external view returns (bytes memory);
}

/**
 * @title RWAExtractor
 * @notice ACE Extractor for RWA Collateral Vault actions
 * @dev Routes liquidate and ccipTransfer actions to appropriate policy checks
 *
 * Actions supported:
 * - LIQUIDATE (action=1): Partial or full liquidation of unhealthy positions
 * - CCIP_TRANSFER (action=2): Cross-chain transfer for healthy positions
 *
 * Policy checks:
 * - Liquidation: Verify health factor < 1.5, check liquidation limits
 * - CCIP Transfer: Verify health factor > 2.0, check destination whitelist
 */
contract RWAExtractor is IACEExtractor {
    // ============ Policy Types ============

    enum RWAPolicyType {
        NONE,
        LIQUIDATION,    // Health factor checks, liquidation limits
        CCIP_TRANSFER   // Cross-chain transfer checks
    }

    // ============ Action Constants ============

    uint8 constant ACTION_LIQUIDATE = 1;
    uint8 constant ACTION_CCIP_TRANSFER = 2;

    // Whitelisted CCIP destinations
    uint64 constant ARBITRUM_SELECTOR = 4949039107694359620;
    uint64 constant BASE_SELECTOR = 15971525489660198786;
    uint64 constant OPTIMISM_SELECTOR = 3734403246176062136;

    // ============ Events ============

    event RWAExtractionRouted(uint8 indexed action, RWAPolicyType policyType);

    // ============ Errors ============

    error InvalidAction(uint8 action);
    error InvalidCallData();
    error UnsupportedDestination(uint64 chainSelector);

    // ============ Main Extract Function ============

    /**
     * @notice Extract RWA vault action data for policy evaluation
     * @param callData The report data being sent to RWACollateralVault
     * @return Encoded policy type and extracted data for ACE evaluation
     *
     * Expected callData format:
     *   (uint8 action, address user, uint256 amount, bytes extraData)
     *
     * Returns for LIQUIDATE:
     *   (RWAPolicyType.LIQUIDATION, user, amount, healthFactorThreshold)
     *
     * Returns for CCIP_TRANSFER:
     *   (RWAPolicyType.CCIP_TRANSFER, user, amount, destinationChain, isWhitelisted)
     */
    function extract(bytes calldata callData) external pure override returns (bytes memory) {
        if (callData.length < 68) revert InvalidCallData(); // Minimum: action + user + amount

        // Decode the report format
        (uint8 action, address user, uint256 amount, bytes memory extraData) =
            abi.decode(callData, (uint8, address, uint256, bytes));

        if (action == ACTION_LIQUIDATE) {
            return _extractLiquidation(user, amount);
        } else if (action == ACTION_CCIP_TRANSFER) {
            return _extractCCIPTransfer(user, amount, extraData);
        } else {
            revert InvalidAction(action);
        }
    }

    // ============ Liquidation Extraction ============

    /**
     * @notice Extract liquidation action data
     * @param user Position holder to liquidate
     * @param amount Debt amount to repay
     * @return Encoded policy data for liquidation checks
     */
    function _extractLiquidation(
        address user,
        uint256 amount
    ) internal pure returns (bytes memory) {
        // Policy engine should verify:
        // 1. Position exists and has debt
        // 2. Health factor < 1.5 (150 basis points)
        // 3. Liquidation amount is within limits
        // 4. Caller is authorized (from trusted CRE workflow)

        return abi.encode(
            RWAPolicyType.LIQUIDATION,
            abi.encode(
                user,
                amount,
                uint256(150)  // Health factor threshold (1.5 * 100)
            )
        );
    }

    // ============ CCIP Transfer Extraction ============

    /**
     * @notice Extract CCIP transfer action data
     * @param user Position holder
     * @param amount Transfer amount
     * @param extraData Contains destination chain selector
     * @return Encoded policy data for CCIP checks
     */
    function _extractCCIPTransfer(
        address user,
        uint256 amount,
        bytes memory extraData
    ) internal pure returns (bytes memory) {
        // Decode destination chain from extraData
        uint64 destinationChain = abi.decode(extraData, (uint64));

        // Check if destination is whitelisted
        bool isWhitelisted = _isWhitelistedDestination(destinationChain);

        // Policy engine should verify:
        // 1. Position exists and is healthy (HF > 2.0)
        // 2. Destination chain is whitelisted
        // 3. Transfer amount doesn't compromise position health
        // 4. LINK balance sufficient for CCIP fees

        return abi.encode(
            RWAPolicyType.CCIP_TRANSFER,
            abi.encode(
                user,
                amount,
                destinationChain,
                isWhitelisted,
                uint256(200)  // Min health factor threshold (2.0 * 100)
            )
        );
    }

    // ============ Helper Functions ============

    /**
     * @notice Check if destination chain is whitelisted
     * @param chainSelector CCIP chain selector
     * @return Whether the chain is whitelisted for transfers
     */
    function _isWhitelistedDestination(uint64 chainSelector) internal pure returns (bool) {
        return (
            chainSelector == ARBITRUM_SELECTOR ||
            chainSelector == BASE_SELECTOR ||
            chainSelector == OPTIMISM_SELECTOR
        );
    }

    /**
     * @notice Get policy type for an action
     * @param action The action type
     * @return The corresponding policy type
     */
    function getPolicyType(uint8 action) external pure returns (RWAPolicyType) {
        if (action == ACTION_LIQUIDATE) {
            return RWAPolicyType.LIQUIDATION;
        } else if (action == ACTION_CCIP_TRANSFER) {
            return RWAPolicyType.CCIP_TRANSFER;
        } else {
            return RWAPolicyType.NONE;
        }
    }

    /**
     * @notice Get whitelisted chain selectors
     */
    function getWhitelistedChains() external pure returns (
        uint64 arbitrum,
        uint64 base,
        uint64 optimism
    ) {
        return (ARBITRUM_SELECTOR, BASE_SELECTOR, OPTIMISM_SELECTOR);
    }

    /**
     * @notice Get action constants
     */
    function getActionConstants() external pure returns (
        uint8 liquidate,
        uint8 ccipTransfer
    ) {
        return (ACTION_LIQUIDATE, ACTION_CCIP_TRANSFER);
    }

    /**
     * @notice Validate report data format
     * @param callData Report data to validate
     * @return isValid Whether the data is valid
     * @return action The action type if valid
     */
    function validateReportData(bytes calldata callData) external pure returns (
        bool isValid,
        uint8 action
    ) {
        if (callData.length < 68) {
            return (false, 0);
        }

        (action,,,) = abi.decode(callData, (uint8, address, uint256, bytes));

        isValid = (action == ACTION_LIQUIDATE || action == ACTION_CCIP_TRANSFER);
        return (isValid, action);
    }
}
