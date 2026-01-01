import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vite configuration for building the Jupyter widget bundle.
 *
 * This creates a single ES module that can be loaded by anywidget.
 */
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'python/metabolicsuite/static',
    lib: {
      entry: resolve(__dirname, 'src/widget/index.jsx'),
      formats: ['es'],
      fileName: () => 'widget.js',
    },
    rollupOptions: {
      // Bundle everything including React for standalone widget
      output: {
        // Single file output
        inlineDynamicImports: true,
      },
    },
    // Minimize for production
    minify: 'terser',
    // Generate sourcemaps for debugging
    sourcemap: true,
  },
});
