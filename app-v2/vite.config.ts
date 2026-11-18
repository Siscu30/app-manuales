import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: la app se sirve en /app-v2/ junto a la app actual (GitHub Pages).
export default defineConfig({ base: './', plugins: [react()] });
