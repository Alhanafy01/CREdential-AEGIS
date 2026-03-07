// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RUSD - RWA-Backed Stablecoin
 * @notice ERC20 stablecoin backed by Real World Asset collateral
 * @dev Only the vault (minter) can mint/burn tokens
 */
contract RUSD is ERC20, Ownable {
    address public minter;

    event MinterUpdated(address indexed oldMinter, address indexed newMinter);

    error OnlyMinter();
    error ZeroAddress();

    modifier onlyMinter() {
        if (msg.sender != minter) revert OnlyMinter();
        _;
    }

    /**
     * @notice Constructor initializes the RUSD stablecoin
     * @param _minter The address authorized to mint/burn (typically RWACollateralVault)
     */
    constructor(address _minter) ERC20("RWA USD Stablecoin", "RUSD") Ownable(msg.sender) {
        if (_minter == address(0)) revert ZeroAddress();
        minter = _minter;
        emit MinterUpdated(address(0), _minter);
    }

    /**
     * @notice Mint new RUSD tokens
     * @param to Recipient address
     * @param amount Amount to mint
     * @dev Only callable by the minter (vault)
     */
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }

    /**
     * @notice Burn RUSD tokens
     * @param from Address to burn from
     * @param amount Amount to burn
     * @dev Only callable by the minter (vault)
     */
    function burn(address from, uint256 amount) external onlyMinter {
        _burn(from, amount);
    }

    /**
     * @notice Update the minter address
     * @param _newMinter New minter address
     * @dev Only callable by owner
     */
    function setMinter(address _newMinter) external onlyOwner {
        if (_newMinter == address(0)) revert ZeroAddress();
        address oldMinter = minter;
        minter = _newMinter;
        emit MinterUpdated(oldMinter, _newMinter);
    }

    /**
     * @notice Get the number of decimals (18 for compatibility)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
