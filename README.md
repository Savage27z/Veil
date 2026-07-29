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

