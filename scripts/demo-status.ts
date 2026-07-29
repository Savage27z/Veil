/**
 * Reads back the demo stream and shows what the sender can decrypt.
 *   npx hardhat run scripts/demo-status.ts --network sepolia
 */
import { network } from 'hardhat';
import { createViemHandleClient } from '@iexec-nox/handle';
import { ADDRESSES, STREAM_ABI, VAULT_ABI } from '../frontend/src/config.js';

const RECIPIENT = '0xd876C746A5fbFb26A202596900C969192dF846e0' as `0x${string}`;
const USDCf = (v: bigint) => `${Number(v) / 1e6} USDC`;

const connection = await network.connect();
const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [wallet] = await viem.getWalletClients();
const handleClient = await createViemHandleClient(wallet);

/** The gateway reads ACLs from an indexer, which lags the tx. Retry a bit. */
async function decryptWithRetry(handle: `0x${string}`, label: string, tries = 10) {
  for (let i = 1; i <= tries; i++) {
    try {
      const { value } = await handleClient.decrypt(handle);
      if (i > 1) console.log(`    (resolved on attempt ${i})`);
      return value as bigint;
    } catch (e: any) {
      const msg = String(e?.message ?? e).slice(0, 90);
      if (i === tries) { console.log(`  ${label}: FAILED — ${msg}`); return null; }
      await new Promise((r) => setTimeout(r, 6000));
    }
  }
  return null;
}

const ids = await publicClient.readContract({
  address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'streamsReceivedBy', args: [RECIPIENT],
}) as bigint[];
if (ids.length === 0) { console.log('No streams for recipient.'); process.exit(0); }
const streamId = ids[ids.length - 1];

const s = await publicClient.readContract({
  address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'getStream', args: [streamId],
}) as readonly any[];

console.log(`=== STREAM #${streamId} ===`);
console.log(`PUBLIC  sender    ${s[0]}`);
console.log(`PUBLIC  recipient ${s[1]}`);
console.log(`PUBLIC  window    ${new Date(Number(s[2]) * 1000).toLocaleTimeString()} -> ${new Date(Number(s[3]) * 1000).toLocaleTimeString()}`);
console.log(`PUBLIC  cancelled=${s[4]} depleted=${s[5]}`);
console.log(`HANDLE  deposit   ${s[6]}`);
console.log(`HANDLE  rate      ${s[7]}`);
console.log(`HANDLE  withdrawn ${s[8]}`);

console.log('\nDecrypting as sender…');
const dep = await decryptWithRetry(s[6] as `0x${string}`, 'deposit');
const rate = await decryptWithRetry(s[7] as `0x${string}`, 'rate');
const wd = await decryptWithRetry(s[8] as `0x${string}`, 'withdrawn');

if (dep !== null) console.log(`  deposit   ${USDCf(dep)}`);
if (rate !== null) console.log(`  rate      ${USDCf(rate)}/sec`);
if (wd !== null) console.log(`  withdrawn ${USDCf(wd)}`);

if (dep !== null && rate !== null && wd !== null) {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = Math.max(0, Math.min(now, Number(s[3])) - Number(s[2]));
  const vested = rate * BigInt(elapsed) > dep ? dep : rate * BigInt(elapsed);
  console.log(`\n  withdrawable right now ≈ ${USDCf(vested - wd)}`);
  const left = Number(s[3]) - now;
  console.log(`  stream ends in ${Math.floor(left / 60)}m ${left % 60}s`);
}

const vaultBal = await publicClient.readContract({
  address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'confidentialBalanceOf', args: [wallet.account.address],
}) as `0x${string}`;
const vb = await decryptWithRetry(vaultBal, 'vault balance');
if (vb !== null) console.log(`\n  sender vault balance ${USDCf(vb)}`);
