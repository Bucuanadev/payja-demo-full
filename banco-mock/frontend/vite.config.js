import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4100,
    open: true,
    proxy: {
      '/api': {
        target: 'http://155.138.227.26:4500',
        changeOrigin: true,
      },
    },
  },
});
