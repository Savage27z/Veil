import hardhatToolboxViemPlugin from '@nomicfoundation/hardhat-toolbox-viem';
import { defineConfig, configVariable } from 'hardhat/config';
import noxPlugin from '@iexec-nox/nox-hardhat-plugin';

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin, noxPlugin],
  solidity: '0.8.35',
});
