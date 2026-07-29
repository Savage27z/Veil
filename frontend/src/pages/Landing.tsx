import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Reveal, RevealOnScroll, SPRING, useStage } from '../lib/motion';
import { Decrypt, LiveCounter } from '../components/Decrypt';
import { ADDRESSES } from '../config';

/* ─────────────────────────────────────────────────────────
 * LANDING STORYBOARD
 *
 * Nav is static — never held blank, never re-animates.
 *
 *    0ms   nav + hero copy present (no blocking on motion)
 *  120ms   eyebrow fades in
 *  260ms   headline slides up
 *  420ms   subhead slides up
 *  580ms   CTAs slide up
 *  760ms   proof card slides in from right
 *  900ms   ciphertext begins churning inside the card
 * 1800ms   the amount resolves — only then does it read as money
 *
 * Everything below the fold reveals on scroll, once.
 * ───────────────────────────────────────────────────────── */

const TIMING = [120, 260, 420, 580, 760];

const EXPLORER = 'https://eth-sepolia.blockscout.com/address';

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function Landing() {
  const stage = useStage(TIMING);
  const reduced = useReducedMotion();
  const [decrypted, setDecrypted] = useState(reduced ?? false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      {/* ── Hero ─────────────────────────────────────────── */}
      <header className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: 'var(--gradient-bg)' }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pt-16 pb-24 md:pt-24 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16">
          <div>
            <Reveal show={stage >= 1} offsetY={8} spring={SPRING.stiff}>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Live on Ethereum Sepolia
              </p>
            </Reveal>

            <Reveal show={stage >= 2} offsetY={18} spring={SPRING.bouncy}>
              <h1 className="font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                Nobody sees
                <br />
                your salary.
              </h1>
            </Reveal>

            <Reveal show={stage >= 3} offsetY={16}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                VEIL is Sablier-style token streaming where the deposit and rate
                are encrypted end to end through the{' '}
                <a
                  className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-primary"
                  href="https://docs.noxprotocol.io"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  iExec Nox
                </a>{' '}
                TEE. The chain shows that a stream exists. Only the two
                counterparties can read what it pays.
              </p>
            </Reveal>

            <Reveal show={stage >= 4} offsetY={14}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  to="/app"
                  className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Open the app
                </Link>
                <a
                  href={`${EXPLORER}/${ADDRESSES.stream}#code`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-11 items-center rounded-md border border-border px-5 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Verified contract
                </a>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Testnet demo · no real funds · contracts source-verified
              </p>
            </Reveal>
          </div>

          <Reveal show={stage >= 5} offsetX={24} offsetY={0} spring={SPRING.smooth}>
            <StreamCard decrypted={decrypted} onDecrypted={() => setDecrypted(true)} />
          </Reveal>
        </div>
      </header>

      <Problem />
      <HowItWorks />
      <LiveProof />
      <Footer />
    </div>
  );
}

/* ── Nav (static shell — present immediately) ───────────── */
function Nav() {
  return (
    <nav className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5 rounded-sm">
          <VeilMark />
          <span className="text-sm font-semibold tracking-[0.18em]">VEIL</span>
        </Link>
        <div className="flex items-center gap-1">
          <a
            href="https://github.com/Savage27z/Veil"
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-10 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            GitHub
          </a>
          <Link
            to="/app"
            className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Launch app
          </Link>
        </div>
      </div>
    </nav>
  );
}

function VeilMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none">
      <path
        d="M2 3.5h14M2 9h14M2 14.5h14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path d="M2 9h14" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ── The hero proof card ────────────────────────────────── */
function StreamCard({
  decrypted,
  onDecrypted,
}: {
  decrypted: boolean;
  onDecrypted: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Stream #3 · active
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {short('0xce380437A4BeA077e8bf6909d8A3a43feBB1A3AA')} →{' '}
            {short('0xd876C746A5fbFb26A202596900C969192dF846e0')}
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
          public
        </span>
      </div>

      <div className="my-6 h-px bg-border" />

      <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        Deposit
      </p>
      <p className="mt-2 font-mono text-2xl tabular break-all">
        {decrypted ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            864.00 <span className="text-base text-muted-foreground">cUSDC</span>
          </motion.span>
        ) : (
          <Decrypt
            value="864.00"
            hold={900}
            reveal={700}
            onDone={onDecrypted}
            className="text-primary"
          />
        )}
      </p>

      <p className="mt-6 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        Withdrawable now
      </p>
      <p className="mt-2 font-mono text-3xl tabular text-foreground">
        {decrypted ? (
          <>
            <LiveCounter startValue={37.66} ratePerSecond={0.01} />
            <span className="ml-2 text-base text-muted-foreground">cUSDC</span>
          </>
        ) : (
          <span className="text-muted-foreground">••••••</span>
        )}
      </p>

      <div className="mt-6 rounded-md border border-border bg-background p-3">
        <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          What the block explorer stores
        </p>
        <p className="mt-1.5 font-mono text-[11px] leading-relaxed break-all text-muted-foreground">
          0x0000aa36a72301563a43a85f1ffa007ac5d8d8895e2bbd0347089b62d721749f
        </p>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        {decrypted
          ? 'Decrypted in your browser. Nobody else can do this.'
          : 'Resolving through the Nox TEE…'}
      </p>
    </div>
  );
}

/* ── Problem ────────────────────────────────────────────── */
function Problem() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-6xl px-6">
        <RevealOnScroll>
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            The problem
          </p>
          <h2 className="mt-4 max-w-3xl font-serif text-3xl leading-tight sm:text-4xl">
            Every DAO that streams payroll on-chain publishes its
            contributors&rsquo; comp forever.
          </h2>
        </RevealOnScroll>

        <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
          {[
            {
              t: 'Today',
              d: 'Alice gets 5,000 USDC/month from a DAO. That number is public, permanent, and attached to her wallet.',
            },
            {
              t: 'Who reads it',
              d: 'Recruiters, wallet-watchers, scammers, and anyone who has ever wondered what she earns.',
            },
            {
              t: 'The fix',
              d: 'Keep the timing public — it is not the secret. Encrypt the amount. Nothing else has to change.',
            },
          ].map((c, i) => (
            <RevealOnScroll key={c.t} delay={i * 0.08} className="bg-background p-7">
              <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                {c.t}
              </p>
              <p className="mt-3 leading-relaxed">{c.d}</p>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How it works ───────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    {
      n: '01',
      t: 'Wrap',
      d: 'Deposit a plain ERC-20 into HiddenVault and receive cUSDC — an ERC-7984 confidential token whose balance exists only as a Nox handle.',
      code: 'confidentialBalanceOf(you) → 0x0000aa36…',
    },
    {
      n: '02',
      t: 'Stream',
      d: 'The deposit is encrypted in your browser before the transaction is signed, so the amount never appears in calldata. The rate is derived on ciphertext inside the TEE.',
      code: 'createStream(to, encDeposit, proof, start, end)',
    },
    {
      n: '03',
      t: 'Decrypt',
      d: 'The recipient signs an EIP-712 authorization — no gas — and the gateway returns their balance in plaintext. To everyone else it stays a handle.',
      code: 'handleClient.decrypt(handle) → 864.00',
    },
  ];

  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-6xl px-6">
        <RevealOnScroll>
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            How it works
          </p>
          <h2 className="mt-4 font-serif text-3xl leading-tight sm:text-4xl">
            Three moves. The streaming maths never changes.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            Elapsed time × rate is the same calculation Sablier runs. It just
            operates on ciphertext inside a TEE instead of on plaintext in the
            open.
          </p>
        </RevealOnScroll>

        {/* min-w-0 at both levels below: grid children default to
            min-width:auto, which lets the nowrap code line force the track
            wider than the viewport instead of scrolling inside its own box. */}
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <RevealOnScroll key={s.n} delay={i * 0.1} className="min-w-0">
              <div className="flex h-full min-w-0 flex-col rounded-xl border border-border bg-card p-6">
                <p className="font-mono text-xs text-primary">{s.n}</p>
                <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {s.d}
                </p>
                <p className="mt-5 max-w-full overflow-x-auto rounded-md border border-border bg-background px-3 py-2 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                  {s.code}
                </p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Live proof ─────────────────────────────────────────── */
function LiveProof() {
  const rows = [
    { label: 'MockUSDC', addr: ADDRESSES.usdc },
    { label: 'HiddenVault (cUSDC)', addr: ADDRESSES.vault },
    { label: 'VEILStream', addr: ADDRESSES.stream },
  ];

  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <RevealOnScroll>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              Not a mockup
            </p>
            <h2 className="mt-4 font-serif text-3xl leading-tight sm:text-4xl">
              Deployed, verified, and tested against a real TEE.
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              No stubbed calls and no fake data — encrypted handles and TEE
              compute end to end, including in the test suite.
            </p>

            <ul className="mt-8 space-y-2.5">
              {[
                '5/5 end-to-end tests passing against a live Nox stack',
                'Source-verified on Blockscout and Sourcify',
                'Amounts never appear in calldata — encrypted before signing',
              ].map((t) => (
                <li key={t} className="flex gap-3 text-sm">
                  <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{t}</span>
                </li>
              ))}
            </ul>
          </RevealOnScroll>

          <RevealOnScroll delay={0.1}>
            <div className="overflow-hidden rounded-xl border border-border">
              {rows.map((r, i) => (
                <a
                  key={r.addr}
                  href={`${EXPLORER}/${r.addr}#code`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`flex items-center justify-between gap-4 bg-card px-5 py-4 transition-colors hover:bg-accent ${
                    i !== 0 ? 'border-t border-border' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{r.label}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {r.addr}
                    </p>
                  </div>
                  <span aria-hidden="true" className="shrink-0 text-muted-foreground">
                    ↗
                  </span>
                </a>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Sepolia · chainId 11155111 · click any contract to read its source
            </p>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ─────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-border py-20">
      <div className="mx-auto max-w-6xl px-6">
        <RevealOnScroll>
          <blockquote className="max-w-3xl font-serif text-2xl leading-snug sm:text-3xl">
            Aave shows your position. Sablier shows your salary.
            <br />
            <span className="text-primary">
              VEIL shows nothing but the fact that you&rsquo;re getting paid.
            </span>
          </blockquote>
        </RevealOnScroll>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
          <div className="flex items-center gap-2.5">
            <VeilMark />
            <span className="text-xs tracking-[0.18em] text-muted-foreground">
              VEIL
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
            <a
              className="transition-colors hover:text-foreground"
              href="https://github.com/Savage27z/Veil"
              target="_blank"
              rel="noreferrer noopener"
            >
              GitHub
            </a>
            <a
              className="transition-colors hover:text-foreground"
              href="https://docs.noxprotocol.io"
              target="_blank"
              rel="noreferrer noopener"
            >
              Nox docs
            </a>
            <Link className="transition-colors hover:text-foreground" to="/app">
              Launch app
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
