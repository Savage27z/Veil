import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPublicClient, createWalletClient, custom, http, formatUnits, parseUnits } from 'viem';
import { sepolia } from 'viem/chains';
import { createViemHandleClient, type HandleClient } from '@iexec-nox/handle';
import { AnimatePresence, motion } from 'motion/react';
import { Reveal, SPRING, useStage } from '../lib/motion';
import { ADDRESSES, SEPOLIA_CHAIN_ID, STREAM_ABI, USDC_ABI, VAULT_ABI } from '../config';

/* ─────────────────────────────────────────────────────────
 * DASHBOARD STORYBOARD
 *
 * Header + connect button are static — the first actionable
 * element is never held blank behind an animation.
 *
 *   100ms   balances row slides down
 *   250ms   actions panel slides in from left
 *   400ms   streams panel slides in from right
 * ───────────────────────────────────────────────────────── */
const TIMING = [100, 250, 400];

const EXPLORER = 'https://eth-sepolia.blockscout.com';
const ZERO_HANDLE = `0x${'0'.repeat(64)}`;

type StreamView = {
  id: bigint;
  sender: `0x${string}`;
  recipient: `0x${string}`;
  startTime: number;
  endTime: number;
  cancelled: boolean;
  depleted: boolean;
  deposit: `0x${string}`;
  ratePerSecond: `0x${string}`;
  withdrawn: `0x${string}`;
  depositClear: bigint | null;
  rateClear: bigint | null;
  withdrawnClear: bigint | null;
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const usdc = (v: bigint | null) => (v === null ? null : formatUnits(v, 6));
const hasWallet = () => typeof window !== 'undefined' && !!(window as any).ethereum;

export default function Dashboard() {
  const stage = useStage(TIMING);

  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [handleClient, setHandleClient] = useState<HandleClient | null>(null);
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'err'; msg: string }>({
    kind: 'idle',
    msg: '',
  });
  const [loading, setLoading] = useState(false);
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [cusdcBal, setCusdcBal] = useState<bigint | null>(null);
  const [streams, setStreams] = useState<StreamView[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reads fall back to a public RPC so the page still works — and still
  // renders — for anyone browsing without a wallet extension installed.
  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: sepolia,
        transport: hasWallet()
          ? custom((window as any).ethereum)
          : http('https://ethereum-sepolia-rpc.publicnode.com'),
      }),
    [],
  );
  const walletClient = useMemo(
    () =>
      account && hasWallet()
        ? createWalletClient({
            chain: sepolia,
            transport: custom((window as any).ethereum),
            account,
          })
        : null,
    [account],
  );

  /* ── wallet ─────────────────────────────────────────── */
  const connect = async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      setStatus({ kind: 'err', msg: 'No wallet detected. Install MetaMask to continue.' });
      return;
    }
    try {
      const [addr] = await eth.request({ method: 'eth_requestAccounts' });
      const chainId = await eth.request({ method: 'eth_chainId' });
      if (parseInt(chainId, 16) !== SEPOLIA_CHAIN_ID) {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }],
        });
      }
      setAccount(addr);
      setStatus({ kind: 'idle', msg: '' });
    } catch (e: any) {
      setStatus({ kind: 'err', msg: e.shortMessage ?? e.message });
    }
  };

  useEffect(() => {
    if (!walletClient) return;
    createViemHandleClient(walletClient)
      .then(setHandleClient)
      .catch((e) => setStatus({ kind: 'err', msg: `Nox SDK failed to start: ${e.message}` }));
  }, [walletClient]);

  /* ── reads ──────────────────────────────────────────── */
  const tryDecrypt = useCallback(
    async (handle: `0x${string}`): Promise<bigint | null> => {
      if (!handleClient || handle === ZERO_HANDLE) return null;
      try {
        const { value } = await handleClient.decrypt(handle);
        return value as bigint;
      } catch {
        // Not authorized for this handle — which is the entire point of VEIL.
        return null;
      }
    },
    [handleClient],
  );

  const refresh = useCallback(async () => {
    if (!account || !handleClient) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [uBal, cHandle, sentIds, recvIds] = await Promise.all([
        publicClient.readContract({
          address: ADDRESSES.usdc, abi: USDC_ABI, functionName: 'balanceOf', args: [account],
        }),
        publicClient.readContract({
          address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'confidentialBalanceOf', args: [account],
        }),
        publicClient.readContract({
          address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'streamsSentBy', args: [account],
        }),
        publicClient.readContract({
          address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'streamsReceivedBy', args: [account],
        }),
      ]);
      setUsdcBal(uBal as bigint);
      setCusdcBal(await tryDecrypt(cHandle as `0x${string}`));

      const ids = [...new Set([...(sentIds as bigint[]), ...(recvIds as bigint[])])];
      const views: StreamView[] = [];
      for (const id of ids) {
        const s = (await publicClient.readContract({
          address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'getStream', args: [id],
        })) as readonly any[];
        views.push({
          id,
          sender: s[0], recipient: s[1],
          startTime: Number(s[2]), endTime: Number(s[3]),
          cancelled: s[4], depleted: s[5],
          deposit: s[6], ratePerSecond: s[7], withdrawn: s[8],
          depositClear: await tryDecrypt(s[6]),
          rateClear: await tryDecrypt(s[7]),
          withdrawnClear: await tryDecrypt(s[8]),
        });
      }
      setStreams(views.sort((a, b) => Number(b.id - a.id)));
    } catch (e: any) {
      setLoadError(e.shortMessage ?? e.message ?? 'Could not read from Sepolia.');
    } finally {
      setLoading(false);
    }
  }, [account, handleClient, publicClient, tryDecrypt]);

  useEffect(() => {
    if (handleClient) refresh();
  }, [handleClient, refresh]);

  /* ── writes ─────────────────────────────────────────── */
  const tx = async (label: string, fn: () => Promise<`0x${string}`>) => {
    try {
      setStatus({ kind: 'busy', msg: `${label}…` });
      const hash = await fn();
      setStatus({ kind: 'busy', msg: `${label} — waiting for confirmation` });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus({ kind: 'ok', msg: `${label} confirmed.` });
      await refresh();
      return true;
    } catch (e: any) {
      setStatus({ kind: 'err', msg: `${label} failed: ${e.shortMessage ?? e.message}` });
      return false;
    }
  };

  const [wrapAmount, setWrapAmount] = useState('100');
  const [recipient, setRecipient] = useState('');
  const [streamAmount, setStreamAmount] = useState('100');
  const [durationMin, setDurationMin] = useState('60');

  const faucet = () =>
    tx('Minting 1,000 test USDC', () =>
      walletClient!.writeContract({
        address: ADDRESSES.usdc, abi: USDC_ABI, functionName: 'mint',
        args: [account!, parseUnits('1000', 6)],
      }),
    );

  const wrap = async () => {
    const amount = parseUnits(wrapAmount || '0', 6);
    if (amount <= 0n) return setStatus({ kind: 'err', msg: 'Enter an amount above zero.' });
    const approved = await tx('Approving', () =>
      walletClient!.writeContract({
        address: ADDRESSES.usdc, abi: USDC_ABI, functionName: 'approve',
        args: [ADDRESSES.vault, amount],
      }),
    );
    if (approved) {
      await tx(`Wrapping ${wrapAmount} USDC`, () =>
        walletClient!.writeContract({
          address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'wrap',
          args: [account!, amount],
        }),
      );
    }
  };

  const createStream = async () => {
    if (!handleClient) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      return setStatus({ kind: 'err', msg: 'Enter a valid recipient address.' });
    }
    const amount = parseUnits(streamAmount || '0', 6);
    if (amount <= 0n) return setStatus({ kind: 'err', msg: 'Enter an amount above zero.' });

    const isOp = await publicClient.readContract({
      address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'isOperator',
      args: [account!, ADDRESSES.stream],
    });
    if (!isOp) {
      const okOp = await tx('Authorizing VEILStream', () =>
        walletClient!.writeContract({
          address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'setOperator',
          args: [ADDRESSES.stream, Math.floor(Date.now() / 1000) + 365 * 24 * 3600],
        }),
      );
      if (!okOp) return;
    }

    setStatus({ kind: 'busy', msg: 'Encrypting the deposit before it leaves your browser…' });
    let handle: string, handleProof: string;
    try {
      ({ handle, handleProof } = await handleClient.encryptInput(
        amount, 'uint256', ADDRESSES.stream,
      ));
    } catch (e: any) {
      return setStatus({ kind: 'err', msg: `Encryption failed: ${e.message}` });
    }

    const start = BigInt(Math.floor(Date.now() / 1000) + 60);
    const end = start + BigInt(Math.max(1, Number(durationMin)) * 60);
    await tx('Creating stream', () =>
      walletClient!.writeContract({
        address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'createStream',
        args: [
          recipient as `0x${string}`,
          handle as `0x${string}`,
          handleProof as `0x${string}`,
          Number(start),
          Number(end),
        ],
      }),
    );
  };

  const withdraw = (id: bigint) =>
    tx(`Withdrawing from #${id}`, () =>
      walletClient!.writeContract({
        address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'withdraw', args: [id],
      }),
    );

  const cancel = (id: bigint) =>
    tx(`Cancelling #${id}`, () =>
      walletClient!.writeContract({
        address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'cancel', args: [id],
      }),
    );

  /* ── render ─────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNav account={account} onConnect={connect} onRefresh={refresh} busy={loading} />

      <main className="mx-auto max-w-6xl px-6 py-10">
        {!account ? (
          <ConnectPrompt onConnect={connect} />
        ) : (
          <>
            <Reveal show={stage >= 1} offsetY={-10} spring={SPRING.stiff}>
              <div className="grid gap-4 sm:grid-cols-2">
                <BalanceCard
                  label="USDC (public)"
                  value={usdcBal === null ? null : formatUnits(usdcBal, 6)}
                  loading={loading && usdcBal === null}
                  hint="Everyone can read this balance."
                />
                <BalanceCard
                  label="cUSDC (encrypted)"
                  value={usdc(cusdcBal)}
                  loading={loading && cusdcBal === null}
                  hint="Decrypted locally. On-chain it is a handle."
                  accent
                />
              </div>
            </Reveal>

            <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
              <Reveal show={stage >= 2} offsetX={-16} offsetY={0} spring={SPRING.smooth}>
                <div className="space-y-6">
                  <Panel title="Vault" step="01">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={faucet} className="btn-ghost">
                        Get 1,000 test USDC
                      </button>
                    </div>
                    <Field
                      id="wrap-amount"
                      label="Amount to wrap"
                      suffix="USDC"
                      value={wrapAmount}
                      onChange={setWrapAmount}
                      inputMode="decimal"
                    />
                    <button onClick={wrap} className="btn-primary w-full">
                      Wrap into cUSDC
                    </button>
                  </Panel>

                  <Panel title="New stream" step="02">
                    <Field
                      id="recipient"
                      label="Recipient address"
                      value={recipient}
                      onChange={setRecipient}
                      placeholder="0x…"
                      mono
                      error={
                        recipient && !/^0x[a-fA-F0-9]{40}$/.test(recipient)
                          ? 'That is not a valid address.'
                          : undefined
                      }
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        id="stream-amount"
                        label="Amount"
                        suffix="cUSDC"
                        value={streamAmount}
                        onChange={setStreamAmount}
                        inputMode="decimal"
                      />
                      <Field
                        id="duration"
                        label="Duration"
                        suffix="min"
                        value={durationMin}
                        onChange={setDurationMin}
                        inputMode="numeric"
                      />
                    </div>
                    <button onClick={createStream} className="btn-primary w-full">
                      Create stream
                    </button>
                    <p className="text-xs text-muted-foreground">
                      The amount is encrypted in your browser before the
                      transaction is signed. It never appears in calldata.
                    </p>
                  </Panel>
                </div>
              </Reveal>

              <Reveal show={stage >= 3} offsetX={16} offsetY={0} spring={SPRING.smooth}>
                <StreamList
                  streams={streams}
                  account={account}
                  loading={loading}
                  error={loadError}
                  onRetry={refresh}
                  onWithdraw={withdraw}
                  onCancel={cancel}
                />
              </Reveal>
            </div>
          </>
        )}
      </main>

      <StatusToast status={status} onDismiss={() => setStatus({ kind: 'idle', msg: '' })} />
    </div>
  );
}

/* ── nav ────────────────────────────────────────────────── */
function AppNav({
  account, onConnect, onRefresh, busy,
}: {
  account: string | null;
  onConnect: () => void;
  onRefresh: () => void;
  busy: boolean;
}) {
  return (
    <nav className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link to="/" className="flex items-center gap-2.5 rounded-sm">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" fill="none">
            <path d="M2 3.5h14M2 9h14M2 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.35" />
            <path d="M2 9h14" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="text-sm font-semibold tracking-[0.18em]">VEIL</span>
        </Link>

        <div className="flex items-center gap-2">
          {account && (
            <button onClick={onRefresh} className="btn-ghost" disabled={busy}>
              {busy ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
          {account ? (
            <span className="rounded-md border border-border bg-card px-3 py-2 font-mono text-xs">
              {short(account)}
            </span>
          ) : (
            <button onClick={onConnect} className="btn-primary">
              Connect wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

function ConnectPrompt({ onConnect }: { onConnect: () => void }) {
  const wallet = hasWallet();
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="font-serif text-3xl">
        {wallet ? 'Connect to continue' : 'A wallet is required'}
      </h1>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        {wallet
          ? 'VEIL decrypts balances locally using a signature from your wallet. Nothing is readable without it.'
          : 'No browser wallet detected. Install MetaMask, then reload this page to connect to Sepolia.'}
      </p>
      {wallet ? (
        <button onClick={onConnect} className="btn-primary mt-7">
          Connect wallet
        </button>
      ) : (
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noreferrer noopener"
          className="btn-primary mt-7"
        >
          Get MetaMask
        </a>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Ethereum Sepolia · testnet only
      </p>
    </div>
  );
}

/* ── primitives ─────────────────────────────────────────── */
function Panel({ title, step, children }: { title: string; step: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-baseline gap-2.5">
        <span className="font-mono text-xs text-primary">{step}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function BalanceCard({
  label, value, hint, loading, accent,
}: {
  label: string; value: string | null; hint: string; loading: boolean; accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      {loading ? (
        <div className="mt-2 h-9 w-32 animate-pulse rounded bg-muted" />
      ) : (
        <p className={`mt-2 font-mono text-3xl tabular ${accent ? 'text-primary' : ''}`}>
          {value ?? '••••••'}
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Field({
  id, label, value, onChange, suffix, placeholder, mono, error, inputMode,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  suffix?: string; placeholder?: string; mono?: boolean; error?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className={`min-h-11 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors ${
            mono ? 'font-mono text-xs' : ''
          } ${error ? 'border-destructive' : 'border-border focus-visible:border-ring'} ${
            suffix ? 'pr-16' : ''
          }`}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/* ── streams ────────────────────────────────────────────── */
function StreamList({
  streams, account, loading, error, onRetry, onWithdraw, onCancel,
}: {
  streams: StreamView[]; account: string; loading: boolean; error: string | null;
  onRetry: () => void; onWithdraw: (id: bigint) => void; onCancel: (id: bigint) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">Your streams</h2>
        {streams.length > 0 && (
          <span className="text-xs text-muted-foreground">{streams.length} total</span>
        )}
      </div>

      {error ? (
        <div className="px-5 py-14 text-center">
          <p className="text-sm">Could not load your streams.</p>
          <p className="mx-auto mt-2 max-w-sm text-xs text-muted-foreground">{error}</p>
          <button onClick={onRetry} className="btn-ghost mt-5">Try again</button>
        </div>
      ) : loading && streams.length === 0 ? (
        <div className="space-y-3 p-5">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : streams.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <p className="text-sm">No streams yet.</p>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
            Wrap some USDC, then create a stream to another address. It will
            appear here for both of you — and nobody else.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          <AnimatePresence initial={false}>
            {streams.map((s, i) => (
              <motion.li
                key={String(s.id)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING.smooth, delay: i * 0.06 }}
              >
                <StreamRow
                  s={s}
                  account={account}
                  onWithdraw={onWithdraw}
                  onCancel={onCancel}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function StreamRow({
  s, account, onWithdraw, onCancel,
}: {
  s: StreamView; account: string;
  onWithdraw: (id: bigint) => void; onCancel: (id: bigint) => void;
}) {
  const incoming = s.recipient.toLowerCase() === account.toLowerCase();
  const state = s.cancelled ? 'cancelled' : s.depleted ? 'completed' : 'active';
  const readable = s.depositClear !== null;

  // Vested is computed locally from decrypted values — withdrawable() cannot be
  // a view, because Nox operations emit events for the off-chain TEE.
  const withdrawable = (() => {
    if (s.depositClear === null || s.rateClear === null || s.withdrawnClear === null) return null;
    const now = Math.floor(Date.now() / 1000);
    if (now <= s.startTime) return 0n;
    const vested =
      now >= s.endTime
        ? s.depositClear
        : (() => {
            const streamed = s.rateClear * BigInt(now - s.startTime);
            return streamed > s.depositClear ? s.depositClear : streamed;
          })();
    return vested - s.withdrawnClear;
  })();

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">#{String(s.id)}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] ${
                state === 'active'
                  ? 'border-primary/40 text-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {state}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {incoming ? 'incoming' : 'outgoing'}
            </span>
          </div>
          <p className="mt-1.5 font-mono text-xs text-muted-foreground">
            {short(s.sender)} → {short(s.recipient)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(s.startTime * 1000).toLocaleString()} —{' '}
            {new Date(s.endTime * 1000).toLocaleString()}
          </p>
        </div>

        <div className="flex gap-2">
          {incoming && state === 'active' && (
            <button onClick={() => onWithdraw(s.id)} className="btn-primary">
              Withdraw
            </button>
          )}
          {!incoming && state === 'active' && (
            <button onClick={() => onCancel(s.id)} className="btn-ghost">
              Cancel
            </button>
          )}
          <a
            href={`${EXPLORER}/address/${ADDRESSES.stream}#code`}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-ghost"
            aria-label={`View stream ${s.id} contract on the block explorer`}
          >
            ↗
          </a>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Deposit" value={usdc(s.depositClear)} />
        <Metric
          label="Rate"
          value={s.rateClear === null ? null : `${formatUnits(s.rateClear, 6)}/s`}
        />
        <Metric label="Withdrawn" value={usdc(s.withdrawnClear)} />
        <Metric label="Available" value={usdc(withdrawable)} accent />
      </div>

      {!readable && (
        <p className="mt-3 text-xs text-muted-foreground">
          Encrypted for this wallet. Only the sender and recipient can decrypt
          these values.
        </p>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-mono text-sm tabular ${
          value === null ? 'text-muted-foreground' : accent ? 'text-primary' : ''
        }`}
      >
        {value ?? '••••'}
      </p>
    </div>
  );
}

/* ── status ─────────────────────────────────────────────── */
function StatusToast({
  status, onDismiss,
}: {
  status: { kind: 'idle' | 'busy' | 'ok' | 'err'; msg: string };
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (status.kind === 'ok') {
      const t = setTimeout(onDismiss, 4000);
      return () => clearTimeout(t);
    }
  }, [status, onDismiss]);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-6 pb-6"
    >
      <AnimatePresence>
        {status.kind !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={SPRING.stiff}
            className={`pointer-events-auto flex max-w-lg items-start gap-3 rounded-lg border px-4 py-3 shadow-xl ${
              status.kind === 'err'
                ? 'border-destructive/40 bg-card text-foreground'
                : 'border-border bg-card'
            }`}
          >
            {status.kind === 'busy' && (
              <span className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" />
            )}
            <p className="text-sm">{status.msg}</p>
            <button
              onClick={onDismiss}
              aria-label="Dismiss"
              className="-my-1 -mr-1 ml-2 shrink-0 rounded p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
