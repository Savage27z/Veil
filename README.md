# VEIL — Private Payment Streams on Nox

> Aave shows your position. Sablier shows your salary. **VEIL shows nothing but
> the fact that you're getting paid.**

Sablier-style linear token streaming where the deposit, rate-per-second and
running balance are **encrypted end-to-end** with
[iExec Nox](https://docs.noxprotocol.io) confidential handles (ERC-7984). The
chain — and the DAO treasury watcher — sees that a stream exists between two
addresses and its time window. Only the stream's sender and recipient can
decrypt the amounts.

Built for the iExec WTF Hackathon. Deployed on **Ethereum Sepolia**. No mock
data: real encrypted handles, real TEE compute, everywhere including tests.

## Architecture

```
MockUSDC (plain ERC-20, 6 decimals, open faucet — the test token only)
   │  wrap / unwrap (1:1)
   ▼
HiddenVault (cUSDC) — ERC-7984 confidential wrapper
   │  confidentialTransferFrom (encrypted amounts, all-or-nothing TEE semantics)
   ▼
VEILStream — linear streams over cUSDC
     • createStream(recipient, encryptedDeposit, proof, start, end)
         deposit arrives as a Nox handle — plaintext never touches calldata
         ratePerSecond = deposit / duration, derived on ciphertext in the TEE
     • withdraw(streamId)   — vested = min(rate·elapsed, deposit), paid confidentially
     • cancel(streamId)     — vested part to recipient, encrypted refund to sender
```

