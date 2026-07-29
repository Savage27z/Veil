import { strict as assert } from 'node:assert';
import { describe, it, before } from 'node:test';
import { nox } from '@iexec-nox/nox-hardhat-plugin';

/**
 * End-to-end tests against the real local Nox stack (Docker):
 * real encrypted handles, real TEE compute, no mocks.
 *
 * Decryption assertions are made from the default (sender) account, which is
 * granted ACL access on every stream handle by VEILStream.
 */
describe('VEIL — private payment streams', () => {
  const USDC = (n: number) => BigInt(Math.round(n * 1e6));

  let connection: Awaited<ReturnType<typeof nox.connect>>;
  let viem: (typeof connection)['viem'];
  let networkHelpers: any;
  let usdc: any;
  let vault: any;
  let stream: any;
  let sender: `0x${string}`;
  let recipient: `0x${string}`;

  before(async () => {
    connection = await nox.connect();
    viem = connection.viem;
    networkHelpers = (connection as any).networkHelpers;

    const wallets = await viem.getWalletClients();
    sender = wallets[0].account.address;
    recipient = wallets[1].account.address;

    usdc = await viem.deployContract('MockUSDC', []);
    vault = await viem.deployContract('HiddenVault', [usdc.address]);
    stream = await viem.deployContract('VEILStream', [vault.address]);
  });

  it('wraps USDC into cUSDC with an encrypted balance', async () => {
    await usdc.write.mint([sender, USDC(1000)]);
    await usdc.write.approve([vault.address, USDC(1000)]);
    await vault.write.wrap([sender, USDC(1000)]);

    const handle = (await vault.read.confidentialBalanceOf([sender])) as `0x${string}`;
    const { value } = await nox.decrypt(handle);
    assert.equal(value, USDC(1000));
  });

  it('creates a stream with encrypted deposit and derived rate', async () => {
    // Allow VEILStream to pull the confidential deposit.
    const until = BigInt(Math.floor(Date.now() / 1000) + 3600 * 24 * 365);
    await vault.write.setOperator([stream.address, until]);

    const now = BigInt(await networkHelpers.time.latest());
    const start = now + 100n;
    const end = start + 600n; // 600s → rate = 1 USDC/s for a 600 USDC deposit

    const { handle, handleProof } = await nox.encryptInput(
      USDC(600),
      'uint256',
      stream.address,
    );
    await stream.write.createStream([recipient, handle, handleProof, start, end]);

    const s = (await stream.read.getStream([1n])) as any[];
    assert.equal(s[0].toLowerCase(), sender.toLowerCase());
    assert.equal(s[1].toLowerCase(), recipient.toLowerCase());
    assert.equal(s[2], Number(start));
    assert.equal(s[3], Number(end));

    // Sender can decrypt deposit / rate / withdrawn.
    assert.equal((await nox.decrypt(s[6])).value, USDC(600));
    assert.equal((await nox.decrypt(s[7])).value, USDC(1)); // 1 USDC per second
    assert.equal((await nox.decrypt(s[8])).value, 0n);

    // Sender's vault balance dropped by the deposit.
    const bal = (await vault.read.confidentialBalanceOf([sender])) as `0x${string}`;
    assert.equal((await nox.decrypt(bal)).value, USDC(400));
  });

  it('lets the recipient withdraw the vested amount mid-stream', async () => {
    const s = (await stream.read.getStream([1n])) as any[];
    const start = BigInt(s[2]);

    // Move to exactly start + 300s, then withdraw as recipient.
    await networkHelpers.time.increaseTo(start + 300n);
    const [, recipientWallet] = await viem.getWalletClients();
    const streamAsRecipient = await viem.getContractAt('VEILStream', stream.address, {
      client: { wallet: recipientWallet },
    });
    await streamAsRecipient.write.withdraw([1n]);

    const after = (await stream.read.getStream([1n])) as any[];
    const withdrawn = (await nox.decrypt(after[8])).value as bigint;
    // ~301s elapsed at mining time; allow one second of drift.
    assert.ok(withdrawn >= USDC(300) && withdrawn <= USDC(302), `withdrawn=${withdrawn}`);
  });

});
