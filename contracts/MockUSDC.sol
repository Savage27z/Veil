// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Plain test-token stand-in for USDC on Sepolia. This mock is only the
/// underlying ERC-20; all Nox confidential functionality operates on real
/// encrypted handles end-to-end.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Open faucet so demo wallets can fund themselves.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
