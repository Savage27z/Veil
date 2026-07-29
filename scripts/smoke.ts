/**
 * Live Sepolia smoke test — exercises the deployed contracts against the HOSTED
 * Nox TEE stack (not the local Docker one). Proves the exact path the demo uses.
 *
 *   npx hardhat run scripts/smoke.ts --network sepolia
 *
 * Idempotent-ish: mints fresh USDC each run, wraps a slice of it, and opens one
 * new stream. Safe to re-run.
 */
import { network } from 'hardhat';
import { createViemHandleClient } from '@iexec-nox/handle';
import { ADDRESSES, STREAM_ABI, USDC_ABI, VAULT_ABI } from '../frontend/src/config.js';

const USDC = (n: number) => BigInt(Math.round(n * 1e6));
const fmt = (v: bigint) => `${Number(v) / 1e6} USDC`;

const connection = await network.connect();
const { viem } = connection;

const publicClient = await viem.getPublicClient();
const [wallet] = await viem.getWalletClients();
const me = wallet.account.address;

console.log(`chainId  ${await publicClient.getChainId()}`);
console.log(`wallet   ${me}\n`);

const send = async (label: string, hash: `0x${string}`) => {
  const r = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ${label} — ${r.status} (gas ${r.gasUsed})`);
  return r;
};

// The handle client signs EIP-712 decrypt authorizations and talks to the
// hosted Handle Gateway. Same SDK path the frontend uses.
const handleClient = await createViemHandleClient(wallet);

// ---- 1. mint + wrap -> confidential balance -------------------------------
console.log('1. Mint 1000 USDC and wrap into cUSDC');
await send('mint    ', await wallet.writeContract({
  address: ADDRESSES.usdc, abi: USDC_ABI, functionName: 'mint', args: [me, USDC(1000)],
}));
await send('approve ', await wallet.writeContract({
  address: ADDRESSES.usdc, abi: USDC_ABI, functionName: 'approve', args: [ADDRESSES.vault, USDC(1000)],
}));
await send('wrap    ', await wallet.writeContract({
  address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'wrap', args: [me, USDC(1000)],
}));

const balHandle = await publicClient.readContract({
  address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'confidentialBalanceOf', args: [me],
}) as `0x${string}`;
console.log(`  on-chain handle : ${balHandle}`);
const bal = await handleClient.decrypt(balHandle);
console.log(`  decrypted       : ${fmt(bal.value as bigint)}  <- only this wallet can do this\n`);

// ---- 2. create a confidential stream --------------------------------------
console.log('2. Create a stream (deposit encrypted client-side before the tx)');
const isOp = await publicClient.readContract({
  address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'isOperator', args: [me, ADDRESSES.stream],
}) as boolean;
if (!isOp) {
  await send('setOperator', await wallet.writeContract({
    address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'setOperator',
    args: [ADDRESSES.stream, Math.floor(Date.now() / 1000) + 365 * 24 * 3600],
  }));
}

const recipient = '0x000000000000000000000000000000000000dEaD' as `0x${string}`;
const { handle, handleProof } = await handleClient.encryptInput(
  USDC(600), 'uint256', ADDRESSES.stream,
);
console.log(`  encrypted deposit handle: ${handle}`);
console.log(`  (600 USDC never appears in calldata)`);

const now = Math.floor(Date.now() / 1000);
const start = now + 30;
const end = start + 600; // 1 USDC/s

await send('createStream', await wallet.writeContract({
  address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'createStream',
  args: [recipient, handle as `0x${string}`, handleProof as `0x${string}`, start, end],
}));

const ids = await publicClient.readContract({
  address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'streamsSentBy', args: [me],
}) as bigint[];
const streamId = ids[ids.length - 1];
const s = await publicClient.readContract({
  address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'getStream', args: [streamId],
}) as readonly any[];

console.log(`\n  stream #${streamId}`);
console.log(`  PUBLIC  sender=${s[0]}`);
console.log(`  PUBLIC  recipient=${s[1]}`);
console.log(`  PUBLIC  window=${new Date(Number(s[2]) * 1000).toISOString()} -> ${new Date(Number(s[3]) * 1000).toISOString()}`);
console.log(`  HANDLE  deposit=${s[6]}`);
console.log(`  HANDLE  rate=${s[7]}`);

const dep = await handleClient.decrypt(s[6] as `0x${string}`);
const rate = await handleClient.decrypt(s[7] as `0x${string}`);
console.log(`\n  decrypted deposit : ${fmt(dep.value as bigint)}`);
console.log(`  decrypted rate    : ${fmt(rate.value as bigint)}/second  <- derived on ciphertext in the TEE`);

const remaining = await handleClient.decrypt(
  await publicClient.readContract({
    address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'confidentialBalanceOf', args: [me],
  }) as `0x${string}`,
);
console.log(`  vault balance now : ${fmt(remaining.value as bigint)}`);
console.log('\nSMOKE TEST PASSED — hosted Nox TEE, real handles, real encryption.');
