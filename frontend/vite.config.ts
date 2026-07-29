import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Some web3 deps still probe for a Node global.
    global: 'globalThis',
  },
});
