# Brand — VEIL

VEIL — Sablier-style payment streams where the deposit and rate are encrypted
end to end through the iExec Nox TEE.

**Category:** defi · **Mood:** minimal · premium · **Reference:** Stripe

---

## Palette — Slate Mist

Muted blue-gray, almost no chroma. Chosen deliberately: a product whose thesis
is restraint should not shout in its own interface. Colour is spent almost
entirely on one thing — the moment an encrypted value resolves into a readable
number.

**Seeds (dark)**

| Role | OKLCH |
|---|---|
| bg-base | `oklch(0.150 0.012 210)` |
| bg-elevated | `oklch(0.200 0.015 210)` |
| primary | `oklch(0.720 0.080 200)` |
| primary-soft | `oklch(0.840 0.060 200)` |
| fg-base | `oklch(0.950 0.010 210)` |

**Seeds (light)**

| Role | OKLCH |
|---|---|
| bg-base | `oklch(0.980 0.005 210)` |
| bg-elevated | `oklch(1 0 0)` |
| primary | `oklch(0.460 0.070 200)` |
| primary-soft | `oklch(0.680 0.050 200)` |
| fg-base | `oklch(0.190 0.012 210)` |

Both themes derive from the same seeds, so they read as one brand at different
times of day. The full token set lives in `frontend/src/index.css` under
`:root` and `.dark`.

### Contrast (verified, not assumed)

Every foreground/background pair was checked by converting OKLCH → linear sRGB →
relative luminance and computing WCAG ratios, with lightness auto-corrected
where a pair fell short.

| Pair | Dark | Light |
|---|---|---|
| body on background | 17.03:1 | 17.42:1 |
| primary-foreground on primary | 8.58:1 | 6.51:1 |
| muted-foreground on background | 6.10:1 | 7.00:1 |

All clear WCAG AA (4.5:1) with substantial headroom.

## Typography — Instrument Serif + Inter + JetBrains Mono

- **Display:** Instrument Serif — H1/hero only
- **Body/UI:** Inter
- **Mono:** JetBrains Mono — every amount, address, and handle

The serif exists to solve a specific problem: a palette this quiet risks reading
as *timid* rather than *restrained*. A serif headline gives the page a spine
without spending a single drop of colour.

Loaded via Google Fonts in `frontend/index.html`, exposed as `--font-sans`,
`--font-serif`, `--font-mono`.

**Numbers always use `font-mono` + `.tabular`** (`font-variant-numeric:
tabular-nums`). A stream ticks up in real time; without tabular figures the
digits jitter as they change width.

## Gradients

- `--gradient-bg` — radial, top-centre, near-invisible. On a minimal palette a
  gradient should read as a change in air pressure, not decoration.
- `--gradient-accent` — linear primary ramp, reserved for rare emphasis.

## Motion

Motion carries the core idea rather than decorating it. The signature is the
**decrypt reveal**: a value churns as hex ciphertext, then resolves
left-to-right into a readable amount — encryption made legible in one gesture.

- Spring-first (`SPRING.stiff/smooth/bouncy` in `src/lib/motion.tsx`)
- Stage-driven page entrances, `stage >= n` so sections stay once shown
- The static shell (nav, primary CTA) is never held blank behind an animation
- Everything degrades through `prefers-reduced-motion` in one place

## Tone / voice

**Plain and declarative.** "Nobody sees your salary." Not "Revolutionising
confidential payroll infrastructure." The product is unusual enough that plain
description is the strongest available claim.

**Concrete over abstract.** Name the real failure: a contributor's comp is
public, permanent, and attached to their wallet. Specific beats sweeping.

**Never oversell the privacy.** Nox provides confidentiality, not anonymity —
addresses and timing stay public by design. Say so. A privacy product that
overstates its guarantees deserves the distrust it earns.

## Dos and don'ts

- **Do** put every amount, address, and handle in mono with tabular figures
- **Do** show the encrypted handle next to the decrypted value — the contrast
  *is* the product
- **Do** keep timing public in the UI; it is not the secret
- **Don't** add a second accent colour. One is the whole point
- **Don't** use green/red for value changes — this is payroll, not a trading UI
- **Don't** animate content the user is trying to read
