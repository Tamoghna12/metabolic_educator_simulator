import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'src/**/*.spec.js'],
    globals: true,
    testTimeout: 30000, // LP solving can take time
    setupFiles: ['./src/test/setup.js'],
  },
});
