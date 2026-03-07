// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockDeFiProtocol
 * @notice Mock DeFi protocol for testing Universal Executor
 * @dev Simulates a simple swap/deposit protocol
 */
contract MockDeFiProtocol {
    using SafeERC20 for IERC20;

    // ============ Events ============

    event Swapped(address indexed from, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event Deposited(address indexed from, address token, uint256 amount);
    event Withdrawn(address indexed to, address token, uint256 amount);

    // ============ State ============

    mapping(address => mapping(address => uint256)) public deposits; // user => token => amount

    // ============ Mock Functions ============

    /**
     * @notice Mock swap function (1:1 ratio for simplicity)
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param recipient Address to receive output tokens
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address recipient
    ) external returns (uint256 amountOut) {
        // Transfer in
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        // 1:1 swap (mock)
        amountOut = amountIn;

        // Transfer out
        IERC20(tokenOut).safeTransfer(recipient, amountOut);

        emit Swapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    /**
     * @notice Mock deposit function
     * @param token Token to deposit
     * @param amount Amount to deposit
     */
    function deposit(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        deposits[msg.sender][token] += amount;

        emit Deposited(msg.sender, token, amount);
    }

    /**
     * @notice Mock withdraw function
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     */
    function withdraw(address token, uint256 amount) external {
        require(deposits[msg.sender][token] >= amount, "Insufficient deposit");
        deposits[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, token, amount);
    }

    /**
     * @notice Simple function that always succeeds (for basic testing)
     */
    function ping() external pure returns (bool) {
        return true;
    }

    /**
     * @notice Function that always reverts (for failure testing)
     */
    function alwaysFails() external pure {
        revert("MockDeFiProtocol: intentional failure");
    }
}
