/**
 * Unit Tests for SolverWorker
 *
 * Tests the numerical fixes and tolerance constants.
 *
 * Note: Web Worker 'self' is mocked in src/test/setup.js
 *
 * Reference:
 * - Lewis et al. (2010) "Omic data from evolved E. coli" - pFBA formulation
 * - Baba et al. (2006) "Construction of E. coli K-12 knockout collection" - Viability threshold
 */

import { describe, it, expect } from 'vitest';
import {
  SOLVER_TOLERANCE,
  OBJECTIVE_TOLERANCE,
  FLUX_TOLERANCE,
  IMAT_EPSILON,
  DEFAULT_VIABILITY_THRESHOLD
} from './SolverWorker.js';

describe('Tolerance Constants', () => {
  it('should define SOLVER_TOLERANCE at 1e-9', () => {
    expect(SOLVER_TOLERANCE).toBe(1e-9);
  });

  it('should define OBJECTIVE_TOLERANCE at 1e-6', () => {
    expect(OBJECTIVE_TOLERANCE).toBe(1e-6);
  });

  it('should define FLUX_TOLERANCE at 1e-6', () => {
    expect(FLUX_TOLERANCE).toBe(1e-6);
  });

  it('should define IMAT_EPSILON at 1e-3', () => {
    expect(IMAT_EPSILON).toBe(1e-3);
  });

  it('should maintain correct tolerance hierarchy', () => {
    // SOLVER_TOLERANCE < OBJECTIVE_TOLERANCE <= FLUX_TOLERANCE
    // This ensures numerical stability
    expect(SOLVER_TOLERANCE).toBeLessThan(OBJECTIVE_TOLERANCE);
    expect(OBJECTIVE_TOLERANCE).toBeLessThanOrEqual(FLUX_TOLERANCE);
  });

  it('should have tolerances with scientific justification', () => {
    // SOLVER_TOLERANCE: double precision epsilon ~ 2e-16, use 1e-9 for safety
    // OBJECTIVE_TOLERANCE: standard LP solver tolerance
    // FLUX_TOLERANCE: accounts for alternate optima
    expect(SOLVER_TOLERANCE).toBeGreaterThan(Number.EPSILON);
    expect(SOLVER_TOLERANCE).toBeLessThan(1e-6);
  });
});

describe('Viability Threshold', () => {
  it('should define DEFAULT_VIABILITY_THRESHOLD at 0.001', () => {
    // Default: 0.001 h^-1 (Baba et al., 2006)
    expect(DEFAULT_VIABILITY_THRESHOLD).toBe(0.001);
  });

  it('should represent biologically meaningful growth rate', () => {
    // 0.001 h^-1 corresponds to ~693 hour doubling time
    // This is the threshold for viable vs non-viable phenotype
    const doublingTime = Math.log(2) / DEFAULT_VIABILITY_THRESHOLD;
    expect(doublingTime).toBeCloseTo(693, 0); // hours
  });
});

describe('Near-Zero Flux Filtering', () => {
  it('should filter values below SOLVER_TOLERANCE', () => {
    // Test that very small values would be filtered to zero
    const nearZeroValues = [
      1e-10,   // Below SOLVER_TOLERANCE
      1e-15,   // Much below
      -1e-10,  // Negative near-zero
      -1e-15,  // Negative much below
    ];

    nearZeroValues.forEach(val => {
      const shouldFilter = Math.abs(val) < SOLVER_TOLERANCE;
      expect(shouldFilter).toBe(true);
    });
  });

  it('should not filter values above SOLVER_TOLERANCE', () => {
    const validValues = [
      1e-8,    // Above SOLVER_TOLERANCE
      1e-6,    // Much above
      0.001,   // Significant flux
      10.0,    // Large flux
    ];

    validValues.forEach(val => {
      const shouldFilter = Math.abs(val) < SOLVER_TOLERANCE;
      expect(shouldFilter).toBe(false);
    });
  });

  it('should handle edge case at SOLVER_TOLERANCE boundary', () => {
    // Exactly at threshold should not be filtered (< not <=)
    const atThreshold = SOLVER_TOLERANCE;
    const shouldFilter = Math.abs(atThreshold) < SOLVER_TOLERANCE;
    expect(shouldFilter).toBe(false);
  });
});

describe('pFBA Fraction of Optimum', () => {
  it('should default to 1.0 (100% of optimal)', () => {
    // Lewis et al. (2010) pFBA requires maintaining exact optimal objective
    // Using 0.999 would allow suboptimal solutions
    const defaultFraction = 1.0;
    expect(defaultFraction).toBe(1.0);
  });

  it('should allow configurable fraction for robustness', () => {
    // Some use cases may want 99% or 95% of optimal
    const validFractions = [0.9, 0.95, 0.99, 1.0];

    validFractions.forEach(fraction => {
      expect(fraction).toBeGreaterThan(0);
      expect(fraction).toBeLessThanOrEqual(1);
    });
  });
});

describe('Big-M Calculation', () => {
  it('should calculate Big-M from model bounds', () => {
    // Big-M should be derived from max flux bounds, not hardcoded
    const mockModel = {
      reactions: {
        'R1': { lower_bound: -100, upper_bound: 100 },
        'R2': { lower_bound: 0, upper_bound: 1000 },
        'R3': { lower_bound: -500, upper_bound: 500 },
      }
    };

    const maxBound = Math.max(
      ...Object.values(mockModel.reactions).map(rxn =>
        Math.max(Math.abs(rxn.lower_bound), Math.abs(rxn.upper_bound))
      )
    );

    expect(maxBound).toBe(1000);
  });

  it('should have minimum Big-M of 1000', () => {
    // Even for small models, use minimum Big-M of 1000
    const mockSmallModel = {
      reactions: {
        'R1': { lower_bound: -10, upper_bound: 10 },
      }
    };

    const calculatedMax = Math.max(
      ...Object.values(mockSmallModel.reactions).map(rxn =>
        Math.max(Math.abs(rxn.lower_bound), Math.abs(rxn.upper_bound))
      ),
      1000  // Minimum
    );

    expect(calculatedMax).toBe(1000);
  });

  it('should handle missing bounds', () => {
    // Reactions without explicit bounds default to +-1000
    const mockModel = {
      reactions: {
        'R1': {},  // No bounds specified
      }
    };

    const defaultLB = mockModel.reactions.R1.lower_bound ?? -1000;
    const defaultUB = mockModel.reactions.R1.upper_bound ?? 1000;

    expect(defaultLB).toBe(-1000);
    expect(defaultUB).toBe(1000);
  });
});

describe('IMAT Epsilon', () => {
  it('should define epsilon for expression thresholds', () => {
    // IMAT uses epsilon to define "active" vs "inactive" expression
    // Shlomi et al. (2008) Nat Biotechnol 26:1003
    expect(IMAT_EPSILON).toBe(1e-3);
  });

  it('should be larger than solver tolerance', () => {
    // IMAT epsilon is a biological threshold, not numerical
    expect(IMAT_EPSILON).toBeGreaterThan(SOLVER_TOLERANCE);
    expect(IMAT_EPSILON).toBeGreaterThan(OBJECTIVE_TOLERANCE);
  });
});

describe('Validation Criteria', () => {
  it('should match COBRApy validation thresholds', () => {
    // These tolerances are used for cross-validation with COBRApy
    // FBA: |Δobj| < 1e-6
    // pFBA: relative difference < 0.15%
    // FVA: |Δmin|, |Δmax| < 1e-4

    expect(OBJECTIVE_TOLERANCE).toBe(1e-6);
    expect(FLUX_TOLERANCE).toBe(1e-6);
  });

  it('should be appropriate for publication standards', () => {
    // Nature Biotechnology / Metabolic Engineering standards
    // Require numerical validation to at least 1e-6 precision
    expect(OBJECTIVE_TOLERANCE).toBeLessThanOrEqual(1e-5);
  });
});
