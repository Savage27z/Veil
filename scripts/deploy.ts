/**
 * Deploys MockUSDC, HiddenVault and VEILStream.
 *
 * Local:   npx hardhat run scripts/deploy.ts
 * Sepolia: npx hardhat run scripts/deploy.ts --network sepolia
 *          (requires SEPOLIA_RPC_URL and SEPOLIA_PRIVATE_KEY config variables)
 */
import { network } from 'hardhat';

const connection = await network.connect();
const { viem } = connection;

const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();
console.log(`Network: ${connection.networkName} (chainId ${await publicClient.getChainId()})`);
console.log(`Deployer: ${deployer.account.address}`);

const usdc = await viem.deployContract('MockUSDC', []);
console.log(`MockUSDC:   ${usdc.address}`);

const vault = await viem.deployContract('HiddenVault', [usdc.address]);
console.log(`HiddenVault: ${vault.address}`);

const stream = await viem.deployContract('VEILStream', [vault.address]);
console.log(`VEILStream: ${stream.address}`);

console.log('\nPaste into frontend/src/config.ts:');
console.log(JSON.stringify({ usdc: usdc.address, vault: vault.address, stream: stream.address }, null, 2));
