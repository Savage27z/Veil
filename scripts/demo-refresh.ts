/**
 * Opens a FRESH long-running demo stream, without re-minting or re-wrapping
 * (the sender already holds cUSDC, and gas is finite on the demo wallet).
 *
 *   npx hardhat run scripts/demo-refresh.ts --network sepolia
 *
 * Why the parameters are what they are:
 *  - 7-day window so it cannot quietly expire between now and recording.
 *  - Starts 12h in the past so there is already a meaningful withdrawable
 *    balance on camera instead of a near-zero number.
 *  - 604.8 cUSDC over 604800s divides to exactly 1000 units/sec (0.001 cUSDC/s),
 *    which avoids the integer-truncation trap where a small deposit over a long
 *    duration floors ratePerSecond to zero and nothing appears to stream.
 */
import { network } from 'hardhat';
import { createViemHandleClient } from '@iexec-nox/handle';
import { ADDRESSES, STREAM_ABI, VAULT_ABI } from '../frontend/src/config.js';

const RECIPIENT = '0xd876C746A5fbFb26A202596900C969192dF846e0' as `0x${string}`;
const DEPOSIT = 604_800_000n; // 604.8 cUSDC (6dp)
const DURATION = 604_800; // 7 days
const BACKDATE = 43_200; // start 12h ago

const connection = await network.connect();
const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [wallet] = await viem.getWalletClients();
const me = wallet.account.address;

console.log(`sender    ${me}`);
console.log(`recipient ${RECIPIENT}`);

const isOp = (await publicClient.readContract({
  address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'isOperator',
  args: [me, ADDRESSES.stream],
})) as boolean;
console.log(`operator approved: ${isOp}`);
if (!isOp) {
  const h = await wallet.writeContract({
    address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'setOperator',
    args: [ADDRESSES.stream, Math.floor(Date.now() / 1000) + 365 * 24 * 3600],
  });
  await publicClient.waitForTransactionReceipt({ hash: h });
  console.log('  operator re-approved');
}

const handleClient = await createViemHandleClient(wallet);
const { handle, handleProof } = await handleClient.encryptInput(
  DEPOSIT, 'uint256', ADDRESSES.stream,
);

const now = Math.floor(Date.now() / 1000);
const start = now - BACKDATE;
const end = start + DURATION;

const hash = await wallet.writeContract({
  address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'createStream',
  args: [RECIPIENT, handle as `0x${string}`, handleProof as `0x${string}`, start, end],
});
const rc = await publicClient.waitForTransactionReceipt({ hash });
console.log(`createStream — ${rc.status} (gas ${rc.gasUsed})`);

const ids = (await publicClient.readContract({
  address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'streamsReceivedBy', args: [RECIPIENT],
})) as bigint[];
const id = ids[ids.length - 1];

console.log(`\n=== FRESH DEMO STREAM #${id} ===`);
console.log(`  window  ${new Date(start * 1000).toLocaleString()}`);
console.log(`       -> ${new Date(end * 1000).toLocaleString()}`);
console.log(`  deposit ${Number(DEPOSIT) / 1e6} cUSDC @ ${Number(DEPOSIT / BigInt(DURATION)) / 1e6}/sec`);
console.log(`  already vested ≈ ${(BACKDATE * Number(DEPOSIT / BigInt(DURATION))) / 1e6} cUSDC`);
console.log(`\n  ends in ${(DURATION - BACKDATE) / 86400} days — plenty of runway to record.`);
console.log(`  Verify decryption with: npx hardhat run scripts/demo-status.ts --network sepolia`);
