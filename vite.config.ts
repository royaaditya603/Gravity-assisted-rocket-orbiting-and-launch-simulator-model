import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // @ts-expect-error vitest options
  test: {
    include: ['test/**/*.{test,spec}.{ts,tsx}', 'test/*.{test,spec}.{ts,tsx}'],
  },
});
