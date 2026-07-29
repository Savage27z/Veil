// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Nox, euint256, ebool, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {IERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984.sol";

/// @title VEILStream
/// @notice Sablier-style linear payment streams over an ERC-7984 confidential
/// token (HiddenVault cUSDC). Stream timing (start/end) is public; the deposit,
/// rate-per-second and running withdrawn amount exist only as Nox encrypted
/// handles. Only the stream's sender and recipient can decrypt them.
///
/// Privacy model:
///  - Third parties / the DAO treasury watcher: see that a stream exists
///    between two addresses and its time window. Nothing else.
///  - Recipient: can decrypt deposit, rate and withdrawn (their salary).
///  - Sender: can decrypt the same (they funded it; the values are theirs).
///
/// The vesting math runs on ciphertext inside the Nox TEE:
///    streamed  = ratePerSecond * elapsed
///    vested    = t >= end ? deposit : min(streamed, deposit)
///    payable   = vested - withdrawn
contract VEILStream {
    // ============ Types ============

    struct Stream {
        address sender;
        address recipient;
        uint40 startTime;
        uint40 endTime;
        bool cancelled;
        bool depleted;
        euint256 deposit; // encrypted total deposit
        euint256 ratePerSecond; // encrypted streaming rate (deposit / duration)
        euint256 withdrawn; // encrypted amount already withdrawn
    }

    // ============ State ============

    IERC7984 public immutable token;
    uint256 public nextStreamId = 1;
    mapping(uint256 => Stream) private _streams;
    mapping(address => uint256[]) private _sent;
    mapping(address => uint256[]) private _received;

    // ============ Events ============
    // Deliberately amount-free: the chain learns only that a stream exists.

    event StreamCreated(
        uint256 indexed streamId,
        address indexed sender,
        address indexed recipient,
        uint40 startTime,
        uint40 endTime
    );
    event StreamWithdrawn(uint256 indexed streamId, address indexed recipient);
    event StreamCancelled(uint256 indexed streamId, address indexed sender);

    // ============ Errors ============

    error InvalidTimeRange();
    error InvalidRecipient();
    error StreamNotFound(uint256 streamId);
    error NotRecipient(uint256 streamId);
    error NotSender(uint256 streamId);
    error StreamInactive(uint256 streamId);
    error StreamNotStarted(uint256 streamId);

    constructor(IERC7984 token_) {
        token = token_;
    }

}
