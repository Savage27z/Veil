// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {ERC20ToERC7984Wrapper} from "@iexec-nox/nox-confidential-contracts/contracts/token/extensions/ERC20ToERC7984Wrapper.sol";

/// @title HiddenVault
/// @notice ERC-7984 confidential wrapper around an ERC-20 (USDC). Deposit the
/// public token, receive cUSDC whose balance exists only as a Nox encrypted
/// handle. The block explorer sees that you hold cUSDC, never how much.
///
/// Inherited surface (ERC20ToERC7984Wrapper):
///  - wrap(to, amount)                          ERC-20 -> confidential, 1:1
///  - unwrap(from, to, encAmount, proof)        burn confidential, returns unwrapRequestId
///  - finalizeUnwrap(requestId, proofBundle)    release the ERC-20 after TEE decryption
///  - confidentialTransfer / confidentialTransferFrom / setOperator (ERC-7984)
contract HiddenVault is ERC20ToERC7984Wrapper {
    constructor(
        IERC20 underlying
    ) ERC20ToERC7984Wrapper("Veiled USDC", "cUSDC", "", underlying) {}
}
