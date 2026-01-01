/**
 * Vitest Setup File
 *
 * Runs before any test to set up global mocks.
 */

// Mock Web Worker 'self' for SolverWorker tests
globalThis.self = globalThis.self || {
  onmessage: null,
  postMessage: () => {},
};
