import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4100,
    open: true,
    proxy: {
      '/api': {
        target: 'http://104.207.142.188:4500',
        changeOrigin: true,
      },
    },
  },
});
