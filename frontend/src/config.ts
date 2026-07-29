// Deployed contract addresses — filled in by scripts/deploy.ts output.
export const ADDRESSES = {
  usdc: '0xc0d600daeb699f468ac5b15ddf3b5171d1bb1f28' as `0x${string}`,
  vault: '0xfd18862b9802695376ca7fb50a58a3fff7a04db2' as `0x${string}`,
  stream: '0xb8b7f8a1b422b7514cee822528f0d8aefecbaaff' as `0x${string}`,
};

export const SEPOLIA_CHAIN_ID = 11155111;

export const USDC_ABI = [
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

