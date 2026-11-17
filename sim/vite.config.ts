// Bundles the engine + simulator into .sim-build/index.js for Node (npm run sim:build).
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,        // the simulator does not need sprites or fonts
  logLevel: 'warn',
  build: {
    ssr: 'sim/index.ts',
    outDir: '.sim-build',
    emptyOutDir: true,
  },
});
