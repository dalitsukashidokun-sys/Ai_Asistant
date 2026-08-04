import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
      },
      preload: {
        input: 'electron/preload.ts',
      },
      // Permite usar APIs de Node (p. ej. `path`) directamente en el renderer si algún día lo necesitas.
      renderer: {},
    }),
  ],
});
