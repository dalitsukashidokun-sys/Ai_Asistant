import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

const isVercel = process.env.VERCEL === '1';

export default defineConfig({
  plugins: [
    react(),
    ...(!isVercel
      ? [
          electron({
            main: { entry: 'electron/main.ts' },
            preload: { input: 'electron/preload.ts' },
            renderer: {},
          }),
        ]
      : []),
  ],
});