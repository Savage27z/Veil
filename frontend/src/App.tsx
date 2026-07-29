import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  parseUnits,
} from 'viem';
import { sepolia } from 'viem/chains';
import { createViemHandleClient, type HandleClient } from '@iexec-nox/handle';
import { ADDRESSES, SEPOLIA_CHAIN_ID, STREAM_ABI, USDC_ABI, VAULT_ABI } from './config';

const fmt = (v: bigint | null) => (v === null ? '•••••' : `${formatUnits(v, 6)} USDC`);

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
  // decrypted (only fills for authorized wallets)
  depositClear: bigint | null;
  rateClear: bigint | null;
  withdrawnClear: bigint | null;
};

export default function App() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [handleClient, setHandleClient] = useState<HandleClient | null>(null);
  const [status, setStatus] = useState('');
  const [usdcBal, setUsdcBal] = useState<bigint | null>(null);
  const [cusdcBal, setCusdcBal] = useState<bigint | null>(null);
  const [streams, setStreams] = useState<StreamView[]>([]);

  const publicClient = useMemo(
    () => createPublicClient({ chain: sepolia, transport: custom((window as any).ethereum) }),
    [],
  );
  const walletClient = useMemo(
    () =>
      account
        ? createWalletClient({
            chain: sepolia,
            transport: custom((window as any).ethereum),
            account,
          })
        : null,
    [account],
  );

  // ---------- wallet ----------

  const connect = async () => {
    const eth = (window as any).ethereum;
    if (!eth) return setStatus('No wallet found — install MetaMask.');
    const [addr] = await eth.request({ method: 'eth_requestAccounts' });
    const chainId = await eth.request({ method: 'eth_chainId' });
    if (parseInt(chainId, 16) !== SEPOLIA_CHAIN_ID) {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + SEPOLIA_CHAIN_ID.toString(16) }],
      });
    }
    setAccount(addr);
  };

  // Handle SDK client bound to the connected wallet (signs decrypt authorizations).
  useEffect(() => {
    if (!walletClient) return;
    createViemHandleClient(walletClient).then(setHandleClient).catch((e) => {
      console.error(e);
      setStatus(`Nox SDK init failed: ${e.message}`);
    });
  }, [walletClient]);

  // ---------- reads ----------

  const tryDecrypt = useCallback(
    async (handle: `0x${string}`): Promise<bigint | null> => {
      if (!handleClient) return null;
      if (handle === '0x' + '0'.repeat(64)) return null;
      try {
        const { value } = await handleClient.decrypt(handle);
        return value as bigint;
      } catch {
        return null; // not authorized for this handle — that's the point of VEIL
      }
    },
    [handleClient],
  );

  const refresh = useCallback(async () => {
    if (!account || !handleClient) return;
    setStatus('Refreshing…');
    try {
      const [usdcB, cHandle, sentIds, recvIds] = await Promise.all([
        publicClient.readContract({ address: ADDRESSES.usdc, abi: USDC_ABI, functionName: 'balanceOf', args: [account] }),
        publicClient.readContract({ address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'confidentialBalanceOf', args: [account] }),
        publicClient.readContract({ address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'streamsSentBy', args: [account] }),
        publicClient.readContract({ address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'streamsReceivedBy', args: [account] }),
      ]);
      setUsdcBal(usdcB as bigint);
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
      setStreams(views);
      setStatus('');
    } catch (e: any) {
      console.error(e);
      setStatus(`Refresh failed: ${e.shortMessage ?? e.message}`);
    }
  }, [account, handleClient, publicClient, tryDecrypt]);

  useEffect(() => {
    if (handleClient) refresh();
  }, [handleClient, refresh]);

  // ---------- actions ----------

  const tx = async (label: string, fn: () => Promise<`0x${string}`>) => {
    try {
      setStatus(`${label}…`);
      const hash = await fn();
      setStatus(`${label}: waiting for confirmation…`);
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus(`${label}: done.`);
      await refresh();
    } catch (e: any) {
      console.error(e);
      setStatus(`${label} failed: ${e.shortMessage ?? e.message}`);
    }
  };

  const faucet = () =>
    tx('Minting 1,000 test USDC', () =>
      walletClient!.writeContract({
        address: ADDRESSES.usdc, abi: USDC_ABI, functionName: 'mint',
        args: [account!, parseUnits('1000', 6)],
      }),
    );

  const [wrapAmount, setWrapAmount] = useState('100');
  const wrap = async () => {
    const amount = parseUnits(wrapAmount, 6);
    await tx('Approving', () =>
      walletClient!.writeContract({
        address: ADDRESSES.usdc, abi: USDC_ABI, functionName: 'approve',
        args: [ADDRESSES.vault, amount],
      }),
    );
    await tx(`Wrapping ${wrapAmount} USDC → cUSDC`, () =>
      walletClient!.writeContract({
        address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'wrap',
        args: [account!, amount],
      }),
    );
  };

  const [recipient, setRecipient] = useState('');
  const [streamAmount, setStreamAmount] = useState('100');
  const [durationMin, setDurationMin] = useState('60');
  const createStream = async () => {
    if (!handleClient) return;
    const amount = parseUnits(streamAmount, 6);

    const isOp = await publicClient.readContract({
      address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'isOperator',
      args: [account!, ADDRESSES.stream],
    });
    if (!isOp) {
      await tx('Authorizing VEILStream as operator', () =>
        walletClient!.writeContract({
          address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'setOperator',
          args: [ADDRESSES.stream, Math.floor(Date.now() / 1000) + 365 * 24 * 3600],
        }),
      );
    }

    setStatus('Encrypting deposit client-side via Nox…');
    const { handle, handleProof } = await handleClient.encryptInput(
      amount, 'uint256', ADDRESSES.stream,
    );

    const start = BigInt(Math.floor(Date.now() / 1000) + 60);
    const end = start + BigInt(Number(durationMin) * 60);
    await tx('Creating confidential stream', () =>
      walletClient!.writeContract({
        address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'createStream',
        args: [recipient as `0x${string}`, handle as `0x${string}`, handleProof as `0x${string}`, Number(start), Number(end)],
      }),
    );
  };

  const withdraw = (id: bigint) =>
    tx(`Withdrawing from stream #${id}`, () =>
      walletClient!.writeContract({
        address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'withdraw', args: [id],
      }),
    );

  const cancel = (id: bigint) =>
    tx(`Cancelling stream #${id}`, () =>
      walletClient!.writeContract({
        address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'cancel', args: [id],
      }),
    );

  // Live withdrawable estimate, computed client-side from decrypted values.
  const withdrawableNow = (s: StreamView): bigint | null => {
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
  };

  // ---------- render ----------

  return (
    <div style={{ maxWidth: 860, margin: '2rem auto', fontFamily: 'system-ui, sans-serif', padding: '0 1rem' }}>
      <h1>VEIL <span style={{ fontWeight: 300, fontSize: '0.6em', color: '#666' }}>private payment streams on Nox</span></h1>

      {!account ? (
        <button onClick={connect}>Connect wallet (Sepolia)</button>
      ) : (
        <>
          <p style={{ color: '#666' }}>
            {account} · <button onClick={refresh}>Refresh</button>
          </p>

          <section style={card}>
            <h2>1 · Hidden Vault</h2>
            <p>USDC: <b>{usdcBal === null ? '—' : formatUnits(usdcBal, 6)}</b> · cUSDC (decrypted just for you): <b>{fmt(cusdcBal)}</b></p>
            <button onClick={faucet}>Faucet: mint 1,000 USDC</button>{' '}
            <input value={wrapAmount} onChange={(e) => setWrapAmount(e.target.value)} size={8} />{' '}
            <button onClick={wrap}>Wrap → cUSDC</button>
          </section>

          <section style={card}>
            <h2>2 · Create confidential stream</h2>
            <p>
              To: <input value={recipient} onChange={(e) => setRecipient(e.target.value)} size={44} placeholder="0x… recipient" /><br />
              Amount: <input value={streamAmount} onChange={(e) => setStreamAmount(e.target.value)} size={8} /> cUSDC
              {' '}over <input value={durationMin} onChange={(e) => setDurationMin(e.target.value)} size={5} /> minutes
            </p>
            <button onClick={createStream}>Create stream (amount encrypted client-side)</button>
          </section>

          <section style={card}>
            <h2>3 · My streams</h2>
            {streams.length === 0 && <p>No streams for this wallet.</p>}
            {streams.map((s) => {
              const mine = s.recipient.toLowerCase() === account.toLowerCase();
              const wd = withdrawableNow(s);
              return (
                <div key={String(s.id)} style={{ borderTop: '1px solid #eee', padding: '0.6rem 0' }}>
                  <b>#{String(s.id)}</b> {mine ? '← incoming' : '→ outgoing'}
                  {s.cancelled ? ' · cancelled' : s.depleted ? ' · completed' : ' · active'}<br />
                  {new Date(s.startTime * 1000).toLocaleString()} → {new Date(s.endTime * 1000).toLocaleString()}<br />
                  deposit {fmt(s.depositClear)} · rate {fmt(s.rateClear)}/s · withdrawn {fmt(s.withdrawnClear)}
                  {wd !== null && !s.cancelled && !s.depleted && <> · <b>withdrawable ≈ {fmt(wd)}</b></>}
                  <br />
                  {mine && !s.cancelled && !s.depleted && (
                    <button onClick={() => withdraw(s.id)}>Withdraw vested</button>
                  )}{' '}
                  {!mine && !s.cancelled && !s.depleted && (
                    <button onClick={() => cancel(s.id)}>Cancel stream</button>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}

      <p style={{ color: '#999', minHeight: '1.4em' }}>{status}</p>
    </div>
  );
}

const card: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: '0.5rem 1rem',
  margin: '1rem 0',
};
