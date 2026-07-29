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

export const VAULT_ABI = [
  { type: 'function', name: 'wrap', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'unwrap', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'encryptedAmount', type: 'bytes32' }, { name: 'inputProof', type: 'bytes' }], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'finalizeUnwrap', stateMutability: 'nonpayable', inputs: [{ name: 'unwrapRequestId', type: 'bytes32' }, { name: 'decryptedAmountAndProof', type: 'bytes' }], outputs: [] },
  { type: 'function', name: 'confidentialBalanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'bytes32' }] },
  { type: 'function', name: 'setOperator', stateMutability: 'nonpayable', inputs: [{ name: 'operator', type: 'address' }, { name: 'until', type: 'uint48' }], outputs: [] },
  { type: 'function', name: 'isOperator', stateMutability: 'view', inputs: [{ name: 'holder', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'bool' }] },
] as const;

export const STREAM_ABI = [
  { type: 'function', name: 'createStream', stateMutability: 'nonpayable', inputs: [{ name: 'recipient', type: 'address' }, { name: 'encryptedDeposit', type: 'bytes32' }, { name: 'depositProof', type: 'bytes' }, { name: 'startTime', type: 'uint40' }, { name: 'endTime', type: 'uint40' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [{ name: 'streamId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'cancel', stateMutability: 'nonpayable', inputs: [{ name: 'streamId', type: 'uint256' }], outputs: [] },
  {
    type: 'function', name: 'getStream', stateMutability: 'view',
    inputs: [{ name: 'streamId', type: 'uint256' }],
    outputs: [
      { name: 'sender', type: 'address' },
      { name: 'recipient', type: 'address' },
      { name: 'startTime', type: 'uint40' },
      { name: 'endTime', type: 'uint40' },
      { name: 'cancelled', type: 'bool' },
      { name: 'depleted', type: 'bool' },
      { name: 'deposit', type: 'bytes32' },
      { name: 'ratePerSecond', type: 'bytes32' },
      { name: 'withdrawn', type: 'bytes32' },
    ],
  },
  { type: 'function', name: 'streamsSentBy', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256[]' }] },
  { type: 'function', name: 'streamsReceivedBy', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256[]' }] },
] as const;
