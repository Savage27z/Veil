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

**Privacy model.** Stream timing is public by design (it's not the secret and it
lets vesting branch on `block.timestamp` in plaintext). Amount handles carry a
Nox ACL: contract + sender + recipient. `withdrawable()` is intentionally not an
on-chain view — Nox ops are TEE-computed and non-view — so the frontend decrypts
`deposit/rate/withdrawn` (allowed wallets only) and renders the live vested
amount client-side.

## Repo layout

- `contracts/` — `MockUSDC.sol`, `HiddenVault.sol`, `VEILStream.sol`
- `test/veil.test.ts` — end-to-end against the real local Nox stack (Docker)
- `scripts/deploy.ts` — deployment
- `frontend/` — minimal Vite/React dApp (connect, wrap, create, decrypt, withdraw)
- `feedback.md` — Nox DX log, written during the build

## Run it

```bash
npm install
npx hardhat test                 # needs Docker running (local Nox TEE stack)
npx hardhat run scripts/deploy.ts --network sepolia
cd frontend && npm install && npm run dev
```

The Sepolia RPC is a public endpoint hardcoded in `hardhat.config.ts`; only the
deployer key is a secret (`npx hardhat keystore set --dev SEPOLIA_PRIVATE_KEY`).

After deploying, paste the printed addresses into `frontend/src/config.ts`.

## Live deployment (Ethereum Sepolia, chainId 11155111)

| Contract | Address | Source |
| --- | --- | --- |
| MockUSDC | `0xc0d600daeb699f468ac5b15ddf3b5171d1bb1f28` | [verified](https://eth-sepolia.blockscout.com/address/0xc0d600daeb699f468ac5b15ddf3b5171d1bb1f28#code) |
| HiddenVault (cUSDC) | `0xfd18862b9802695376ca7fb50a58a3fff7a04db2` | [verified](https://eth-sepolia.blockscout.com/address/0xfd18862b9802695376ca7fb50a58a3fff7a04db2#code) |
| VEILStream | `0xb8b7f8a1b422b7514cee822528f0d8aefecbaaff` | [verified](https://eth-sepolia.blockscout.com/address/0xb8b7f8a1b422b7514cee822528f0d8aefecbaaff#code) |

All three are source-verified on Blockscout and Sourcify. Note what the
explorer shows for a funded `HiddenVault` holder: a `confidentialBalanceOf`
that returns a 32-byte handle, and no amount anywhere.

## Test status

`npx hardhat test` — **5 passing** against the real local Nox stack (real
encrypted handles, real TEE compute, no mocks):

```
✔ wraps USDC into cUSDC with an encrypted balance
✔ creates a stream with encrypted deposit and derived rate
✔ lets the recipient withdraw the vested amount mid-stream
✔ pays out the full deposit after the stream ends and marks it depleted
✔ cancel refunds the unstreamed remainder to the sender
```
