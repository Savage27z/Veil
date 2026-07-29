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

    // ============ Stream lifecycle ============

    /// @notice Create a stream. The deposit amount is supplied as an encrypted
    /// handle produced client-side by the Nox JS SDK — it never appears in
    /// calldata as plaintext. The rate is derived on ciphertext in the TEE, so
    /// deposit and rate can never disagree.
    /// @dev Caller must first `setOperator(address(this), until)` on the token
    /// so this contract can pull the confidential deposit.
    function createStream(
        address recipient,
        externalEuint256 encryptedDeposit,
        bytes calldata depositProof,
        uint40 startTime,
        uint40 endTime
    ) external returns (uint256 streamId) {
        if (recipient == address(0) || recipient == msg.sender) revert InvalidRecipient();
        if (endTime <= startTime || endTime <= block.timestamp) revert InvalidTimeRange();

        euint256 requested = Nox.fromExternal(encryptedDeposit, depositProof);

        // The token contract computes on this handle inside the TEE, so it needs
        // its own access — being the caller is not enough. Transient: scoped to
        // this transaction, no permanent grant.
        Nox.allowTransient(requested, address(token));

        // Pull the confidential deposit. All-or-nothing semantics: if the
        // sender's encrypted balance is insufficient, `deposit` is encrypted 0
        // and the stream simply vests nothing — balance adequacy is never
        // revealed on-chain.
        euint256 deposit = token.confidentialTransferFrom(msg.sender, address(this), requested);

        euint256 rate = Nox.div(deposit, Nox.toEuint256(endTime - startTime));
        euint256 withdrawn = Nox.toEuint256(0);

        // Persist contract access and grant decryption to both parties.
        Nox.allowThis(deposit);
        Nox.allowThis(rate);
        Nox.allowThis(withdrawn);
        Nox.allow(deposit, msg.sender);
        Nox.allow(deposit, recipient);
        Nox.allow(rate, msg.sender);
        Nox.allow(rate, recipient);
        Nox.allow(withdrawn, msg.sender);
        Nox.allow(withdrawn, recipient);

        streamId = nextStreamId++;
        _streams[streamId] = Stream({
            sender: msg.sender,
            recipient: recipient,
            startTime: startTime,
            endTime: endTime,
            cancelled: false,
            depleted: false,
            deposit: deposit,
            ratePerSecond: rate,
            withdrawn: withdrawn
        });
        _sent[msg.sender].push(streamId);
        _received[recipient].push(streamId);

        emit StreamCreated(streamId, msg.sender, recipient, startTime, endTime);
    }

    /// @notice Withdraw everything vested so far. Amount is computed on
    /// ciphertext in the TEE and transferred confidentially — no amount ever
    /// appears on-chain.
    function withdraw(uint256 streamId) external {
        Stream storage s = _streams[streamId];
        if (s.sender == address(0)) revert StreamNotFound(streamId);
        if (msg.sender != s.recipient) revert NotRecipient(streamId);
        if (s.cancelled || s.depleted) revert StreamInactive(streamId);
        if (block.timestamp <= s.startTime) revert StreamNotStarted(streamId);

        euint256 vested = _vestedAmount(s);
        euint256 payableNow = Nox.sub(vested, s.withdrawn);

        Nox.allowTransient(payableNow, address(token));
        token.confidentialTransfer(s.recipient, payableNow);

        s.withdrawn = vested;
        Nox.allowThis(vested);
        Nox.allow(vested, s.sender);
        Nox.allow(vested, s.recipient);

        if (block.timestamp >= s.endTime) {
            // Everything is vested and withdrawn; stream is finished.
            s.depleted = true;
        }

        emit StreamWithdrawn(streamId, s.recipient);
    }

    /// @notice Cancel a stream. The recipient is paid what has vested so far;
    /// the sender is refunded the rest. Both transfers are confidential.
    function cancel(uint256 streamId) external {
        Stream storage s = _streams[streamId];
        if (s.sender == address(0)) revert StreamNotFound(streamId);
        if (msg.sender != s.sender) revert NotSender(streamId);
        if (s.cancelled || s.depleted) revert StreamInactive(streamId);

        euint256 vested = _vestedAmount(s);
        euint256 dueRecipient = Nox.sub(vested, s.withdrawn);
        euint256 refund = Nox.sub(s.deposit, vested);

        Nox.allowTransient(dueRecipient, address(token));
        Nox.allowTransient(refund, address(token));
        token.confidentialTransfer(s.recipient, dueRecipient);
        token.confidentialTransfer(s.sender, refund);

        s.withdrawn = vested;
        s.cancelled = true;
        Nox.allowThis(vested);
        Nox.allow(vested, s.sender);
        Nox.allow(vested, s.recipient);

        emit StreamCancelled(streamId, s.sender);
    }

    // ============ Views ============

    function getStream(
        uint256 streamId
    )
        external
        view
        returns (
            address sender,
            address recipient,
            uint40 startTime,
            uint40 endTime,
            bool cancelled,
            bool depleted,
            euint256 deposit,
            euint256 ratePerSecond,
            euint256 withdrawn
        )
    {
        Stream storage s = _streams[streamId];
        if (s.sender == address(0)) revert StreamNotFound(streamId);
        return (
            s.sender,
            s.recipient,
            s.startTime,
            s.endTime,
            s.cancelled,
            s.depleted,
            s.deposit,
            s.ratePerSecond,
            s.withdrawn
        );
    }

    function streamsSentBy(address account) external view returns (uint256[] memory) {
        return _sent[account];
    }

    function streamsReceivedBy(address account) external view returns (uint256[] memory) {
        return _received[account];
    }

    // ============ Internal ============

    /// @dev Encrypted vested amount at the current timestamp. Branching on time
    /// is done in plaintext (timing is public by design); branching on amounts
    /// is done with Nox.select on ciphertext.
    function _vestedAmount(Stream storage s) internal returns (euint256) {
        if (block.timestamp >= s.endTime) {
            // Fully vested: pay the exact deposit, absorbing integer-division
            // dust from the rate computation.
            return s.deposit;
        }
        uint256 elapsed = block.timestamp > s.startTime ? block.timestamp - s.startTime : 0;
        euint256 streamed = Nox.mul(s.ratePerSecond, Nox.toEuint256(elapsed));
        // min(streamed, deposit) — guards rounding edge cases without leaking.
        ebool overDeposit = Nox.gt(streamed, s.deposit);
        return Nox.select(overDeposit, s.deposit, streamed);
    }
}
