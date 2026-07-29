/**
 * Prepares a live demo stream on Sepolia:
 *   1. sends the recipient a little Sepolia ETH so it can afford `withdraw`
 *   2. tops up the sender's confidential cUSDC balance
 *   3. opens a stream that is ALREADY VESTING, so the recipient has a
 *      withdrawable balance the moment the camera rolls
 *
 *   npx hardhat run scripts/demo-setup.ts --network sepolia
 */
import { network } from 'hardhat';
import { formatEther, parseEther } from 'viem';
import { createViemHandleClient } from '@iexec-nox/handle';
import { ADDRESSES, STREAM_ABI, USDC_ABI, VAULT_ABI } from '../frontend/src/config.js';

const RECIPIENT = '0xd876C746A5fbFb26A202596900C969192dF846e0' as `0x${string}`;
const GAS_GIFT = parseEther('0.006'); // Sepolia test ETH, enough for a withdraw
const DEPOSIT = 864_000_000n; // 864 cUSDC (6dp)
const DURATION = 86400; // 24 hours -> exactly 0.01 USDC/sec
const ALREADY_ELAPSED = 3600; // start 1 h ago so it's mid-vest on camera

const USDCf = (v: bigint) => `${Number(v) / 1e6} USDC`;

const connection = await network.connect();
const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [wallet] = await viem.getWalletClients();
const me = wallet.account.address;

const send = async (label: string, hash: `0x${string}`) => {
  const r = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ${label} — ${r.status}`);
  return r;
};

console.log(`sender    ${me}`);
console.log(`recipient ${RECIPIENT}`);
console.log(`sender ETH ${formatEther(await publicClient.getBalance({ address: me }))}\n`);

// ---- 1. gas for the recipient ---------------------------------------------
const recipBal = await publicClient.getBalance({ address: RECIPIENT });
console.log(`1. Recipient gas (has ${formatEther(recipBal)} ETH)`);
if (recipBal < GAS_GIFT) {
  await send('transfer', await wallet.sendTransaction({ to: RECIPIENT, value: GAS_GIFT }));
  console.log(`  now ${formatEther(await publicClient.getBalance({ address: RECIPIENT }))} ETH`);
} else {
  console.log('  already funded, skipping');
}

// ---- 2. top up confidential balance ---------------------------------------
console.log('\n2. Top up sender cUSDC');
await send('mint   ', await wallet.writeContract({
  address: ADDRESSES.usdc, abi: USDC_ABI, functionName: 'mint', args: [me, 1_000_000_000n],
}));
await send('approve', await wallet.writeContract({
  address: ADDRESSES.usdc, abi: USDC_ABI, functionName: 'approve', args: [ADDRESSES.vault, 1_000_000_000n],
}));
await send('wrap   ', await wallet.writeContract({
  address: ADDRESSES.vault, abi: VAULT_ABI, functionName: 'wrap', args: [me, 1_000_000_000n],
}));

// ---- 3. the demo stream ----------------------------------------------------
console.log('\n3. Open the demo stream');
const handleClient = await createViemHandleClient(wallet);
const { handle, handleProof } = await handleClient.encryptInput(
  DEPOSIT, 'uint256', ADDRESSES.stream,
);

const now = Math.floor(Date.now() / 1000);
const start = now - ALREADY_ELAPSED;
const end = start + DURATION;

await send('createStream', await wallet.writeContract({
  address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'createStream',
  args: [RECIPIENT, handle as `0x${string}`, handleProof as `0x${string}`, start, end],
}));

const ids = await publicClient.readContract({
  address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'streamsReceivedBy', args: [RECIPIENT],
}) as bigint[];
const streamId = ids[ids.length - 1];
const s = await publicClient.readContract({
  address: ADDRESSES.stream, abi: STREAM_ABI, functionName: 'getStream', args: [streamId],
}) as readonly any[];

console.log(`\n=== DEMO STREAM #${streamId} READY ===`);
console.log(`  recipient        ${RECIPIENT}`);
console.log(`  window           ${new Date(Number(s[2]) * 1000).toLocaleString()}`);
console.log(`                -> ${new Date(Number(s[3]) * 1000).toLocaleString()}`);
console.log(`  deposit (handle) ${s[6]}`);
console.log(`  rate    (handle) ${s[7]}`);
console.log(`  expected         ${USDCf(DEPOSIT)} @ ${USDCf(DEPOSIT / BigInt(DURATION))}/sec`);
console.log(`\n  ACL grants take a few seconds to index — run demo-status.ts to`);
console.log(`  confirm decryption:  npx hardhat run scripts/demo-status.ts --network sepolia`);
