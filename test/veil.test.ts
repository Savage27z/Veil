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

});
