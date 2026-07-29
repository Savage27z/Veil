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

