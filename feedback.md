# Nox Developer Experience Feedback — VEIL build log

Notes taken *during* the build of VEIL (private payment streams on Nox), in
chronological order. Raw friction log, not a polished retrospective.

## Day 1 — Discovery & scaffolding

### Docs / onboarding

- **The Hardhat starter repo referenced around the hackathon
  (`github.com/iExec-Nox/nox-hardhat-starter`) does not exist.** `git ls-remote`
  returns "Repository not found". The org has `nox-hardhat-plugin` but no
  starter template — we had to assemble a Hardhat 3 project by hand from the
  docs. A `create-nox-app` or a template repo would remove ~an hour of setup
  guesswork for every team.
- `docs.iex.ec/nox-protocol/*` 308-redirects to `docs.noxprotocol.io`. Fine for
  browsers, but some tools (and cached links in hackathon briefs) still point at
  the old host.
- **Great touch:** every docs page is fetchable as raw markdown by appending
  `.md` (`/getting-started/hello-world.md`), and there's an `llms.txt` index.
  Made it trivial to load the whole doc set into an AI assistant.
- **The Networks page is useless when read as markdown/scraped** — the actual
  chain data (NoxCompute address, RPC, faucets) is rendered client-side by a
  Vue component, so the `.md` export contains only the "Add to wallet" prose.
  Please put the addresses in a plain markdown table too.
- The `@iexec-nox/handle` SDK is published as `0.1.0-beta.x` — fine for a
  hackathon, but worth flagging: pin exact versions, betas move.

### Ecosystem naming

- Searching npm for "nox" surfaces a dozen unrelated packages (`@noxfed/nox-pro`,
  `nox-mem`, a mixnet SDK...). The `@iexec-nox` scope is the only reliable
  filter; docs should always show scoped install commands (they do — good).

## Day 1 — Contracts

### Docs vs. published code mismatches

- **The ERC-20→ERC-7984 wrapper docs show the wrong constructor.** The guide
  (`/guides/build-confidential-tokens/erc20-to-erc7984-wrapper`) shows
  `ERC20ToERC7984Wrapper(usdc)` + separate `ERC7984("name","symbol","")` call,
  but the published contract (`@iexec-nox/nox-confidential-contracts@0.2.2`)
  takes everything in one constructor:
  `ERC20ToERC7984Wrapper(name, symbol, contractURI, underlying)`. Copy-pasting
  the docs example does not compile.
- The Solidity library docs say `pragma ^0.8.0` is enough as a prerequisite,
  but `Nox.sol` in `nox-protocol-contracts@0.2.4` is `pragma ^0.8.35` — a
  compiler pinned in the last few months. Worth stating loudly since 0.8.35 is
  newer than what most tutorials/toolchains default to.

### Very good decisions worth calling out

- NoxCompute addresses are resolved **in-library by `block.chainid`**
  (`Nox.noxComputeContract()`), CREATE2-deterministic. Zero network config to
  deploy on Sepolia. This is how it should be everywhere.
- The all-or-nothing `Nox.transfer/mint/burn` semantics (never revert, encrypted
  `success` flag) elegantly kill the "insufficient balance" binary oracle — we
  leaned on it directly for stream creation.
- `.md`-suffixed docs URLs + `llms.txt` made AI-assisted development genuinely
  smooth.

### API gaps we worked around

- **No plaintext×ciphertext arithmetic.** `Nox.mul(euint256, euint256)` only —
  every public scalar (elapsed seconds) must be lifted with `Nox.toEuint256()`
  first. Fine, but an overload would save a handle per operation (and gateway
  round-trips).
- **`withdrawable()` can't be a `view`.** Nox ops emit events for the TEE, so
  computing "how much can I withdraw" on-chain requires a state-changing tx.
  Pattern we settled on: grant the recipient ACL access to `deposit`/`rate`/
  `withdrawn` and compute the display value client-side after `decrypt()`. Docs
  could document this pattern explicitly — every streaming/vesting app will hit
  it.

## Day 1 — Local Nox stack (Docker)

- The Nox Hardhat plugin's local stack requires Docker. On Windows this is a
  rougher dependency than the docs let on: our Docker Desktop install was
  wedged by stale `AF_UNIX` socket files (`run\dockerInference`,
  `docker-secrets-engine\engine.sock`) that Windows refuses to delete
  (Error 1920), and the backend crash-loops instead of cleaning them up. Fix
  was renaming the parent dirs so Docker recreates them. Not Nox's bug, but if
  the target audience is hackathon teams, a "Troubleshooting the local stack on
  Windows" docs section would save real hours — or better, an option to run
  tests against the hosted Sepolia stack directly (`skipTestOverride` +
  documented wiring) so Docker isn't a hard requirement.

### Plugin error reporting swallows the actual failure

- When the offchain stack fails to come up, the plugin reports literally:

  ```
  Error: [nox] Failed to start the offchain stack:
  [object Object]
  ```

  The cause is `offchain-services.ts` doing `` `...${String(error)}` `` on the
  error thrown by the `docker-compose` npm package, which rejects with a
  **result object** (`{ exitCode, out, err }`), not an `Error`. `String()` on it
  yields `[object Object]` and the real message is lost. A one-line fix
  (`error?.err ?? error?.message ?? JSON.stringify(error)`) would turn a
  dead-end into a diagnosis.
- The companion `offchain-services.log` was written **empty** (0 bytes) on that
  failure, because `docker compose logs` has nothing to report when the
  containers never got created — so both diagnostic channels came up blank at
  exactly the moment they were needed.
- Recovering the real error meant running the plugin's bundled compose file by
  hand:
  `docker compose --env-file dev.env up --wait` inside
  `node_modules/@iexec-nox/nox-hardhat-plugin/offchain-services/`. That's a
  useful escape hatch and deserves to be a documented debugging step.
- The actual failure turned out to be a transient registry error mid-pull
  (`failed to copy: httpReadSeeker: ... TLS handshake timeout`) while fetching
  the offchain images. The images are large and pulled on first `hardhat test`;
  a flaky network turns that into an opaque plugin crash. Suggestions: pull with
  retries, or expose a `hardhat nox:pull` / `nox:up` task so image fetching is a
  separate, resumable step from running tests.

## Day 1 — First green test run (the ACL gotcha that cost us the most time)

Once the stack was up, every stream test failed with a bare, undecodable revert:

```
reverted with an unrecognized custom error (return data: 0xb87a12a9…)
Unable to decode signature "0xb87a12a9" as it was not found on the provided ABI.
```

`0xb87a12a9` is `NotAllowed(bytes32 handle, address account)` from
`nox-protocol-contracts`. Two separate problems, both worth fixing:

**1. The error doesn't reach the developer.** It's defined in the Nox library,
not in the user's contract, so viem can't decode it against the deployed ABI —
you get a raw selector. Every Nox developer will hit `NotAllowed` (it's *the*
ACL failure), so it deserves either re-export in the ABIs the plugin surfaces,
or a decoder in the Hardhat plugin that recognizes protocol selectors and
prints `NotAllowed(handle 0x…, account 0x…)`. We had to hand-compute
`keccak256("NotAllowed(bytes32,address)")` to identify it.

**2. The actual rule is under-documented — and it is not intuitive.** Passing an
encrypted handle to *another contract* requires granting **that contract**
access, even though it's the callee and you are the authorized caller:

