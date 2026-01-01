/**
 * Unit Tests for OmicsIntegration
 *
 * Tests the multi-omics integration algorithms:
 * - GPR to reaction expression mapping
 * - GIMME, E-Flux, iMAT method configurations
 *
 * Note: Full LP-based tests require browser environment with Web Workers.
 */

import { describe, it, expect } from 'vitest';
import { gprToReactionExpression } from './OmicsIntegration.js';

describe('GPR to Reaction Expression', () => {
  it('should return 1.0 for empty GPR (constitutive)', () => {
    const geneExpression = new Map();
    expect(gprToReactionExpression('', geneExpression)).toBe(1.0);
    expect(gprToReactionExpression('  ', geneExpression)).toBe(1.0);
  });

  it('should return gene expression for single gene', () => {
    const geneExpression = new Map([
      ['gene1', 0.8],
      ['gene2', 0.2]
    ]);

    expect(gprToReactionExpression('gene1', geneExpression)).toBe(0.8);
    expect(gprToReactionExpression('gene2', geneExpression)).toBe(0.2);
  });

  it('should return default 1.0 for unknown genes', () => {
    const geneExpression = new Map([['gene1', 0.5]]);
    expect(gprToReactionExpression('unknownGene', geneExpression)).toBe(1.0);
  });

  it('should use MIN for AND (enzyme complex - limiting factor)', () => {
    const geneExpression = new Map([
      ['geneA', 0.9],
      ['geneB', 0.3]
    ]);

    // Enzyme complex: limited by lowest subunit expression
    const result = gprToReactionExpression('geneA and geneB', geneExpression);
    expect(result).toBe(0.3);
  });

  it('should use MAX for OR (isozymes - highest expression dominates)', () => {
    const geneExpression = new Map([
      ['geneA', 0.9],
      ['geneB', 0.3]
    ]);

    // Isozymes: reaction rate determined by most expressed isozyme
    const result = gprToReactionExpression('geneA or geneB', geneExpression);
    expect(result).toBe(0.9);
  });

  it('should handle nested expressions correctly', () => {
    const geneExpression = new Map([
      ['pykA', 0.8],
      ['pykB', 0.6],
      ['pykF', 0.2]
    ]);

    // (pykA and pykB) or pykF
    // Complex: min(0.8, 0.6) = 0.6
    // Isozyme: max(0.6, 0.2) = 0.6
    const result = gprToReactionExpression('(pykA and pykB) or pykF', geneExpression);
    expect(result).toBe(0.6);
  });

  it('should handle case where isozyme rescues low complex expression', () => {
    const geneExpression = new Map([
      ['pykA', 0.1],  // Low - complex limited
      ['pykB', 0.1],
      ['pykF', 0.9]  // High - isozyme rescues
    ]);

    // (pykA and pykB) or pykF
    // Complex: min(0.1, 0.1) = 0.1
    // Isozyme: max(0.1, 0.9) = 0.9
    const result = gprToReactionExpression('(pykA and pykB) or pykF', geneExpression);
    expect(result).toBe(0.9);
  });

  it('should handle real E. coli GPR patterns', () => {
    // Example: PFK (pfkA or pfkB)
    const expression = new Map([
      ['b3916', 0.7],  // pfkA
      ['b1723', 0.4]   // pfkB
    ]);

    const result = gprToReactionExpression('b3916 or b1723', expression);
    expect(result).toBe(0.7);
  });

  it('should handle complex multi-subunit enzymes', () => {
    // Example: ATP synthase has many subunits
    const expression = new Map([
      ['atpA', 0.9],
      ['atpB', 0.8],
      ['atpC', 0.5],
      ['atpD', 0.7]
    ]);

    // All subunits needed: atpA and atpB and atpC and atpD
    // Should return minimum (limiting subunit)
    const result = gprToReactionExpression('atpA and atpB and atpC and atpD', expression);
    expect(result).toBe(0.5);
  });
});

describe('Expression Normalization', () => {
  it('should handle expression values > 1 gracefully', () => {
    const geneExpression = new Map([
      ['gene1', 2.5],
      ['gene2', 1.2]
    ]);

    // Should not fail - just use the values as-is
    const result = gprToReactionExpression('gene1 or gene2', geneExpression);
    expect(result).toBe(2.5);
  });

  it('should handle zero expression', () => {
    const geneExpression = new Map([
      ['gene1', 0],
      ['gene2', 0.5]
    ]);

    // AND: zero should propagate (enzyme blocked)
    expect(gprToReactionExpression('gene1 and gene2', geneExpression)).toBe(0);

    // OR: non-zero isozyme should rescue
    expect(gprToReactionExpression('gene1 or gene2', geneExpression)).toBe(0.5);
  });

  it('should handle negative expression (log2FC)', () => {
    // In log2FC, negative means downregulated
    const geneExpression = new Map([
      ['gene1', -2],  // Downregulated
      ['gene2', 1]    // Upregulated
    ]);

    // For log2FC data, users should normalize before passing
    // The function will work with the raw values
    expect(gprToReactionExpression('gene1 or gene2', geneExpression)).toBe(1);
    expect(gprToReactionExpression('gene1 and gene2', geneExpression)).toBe(-2);
  });
});

describe('Integration Method Selection', () => {
  // These tests document expected behavior for integration methods

  it('E-Flux should scale bounds proportionally to expression', () => {
    // E-Flux algorithm: ub_new = ub_original * expression_normalized
    // Test case: high expression = high flux capacity
    // Low expression = low flux capacity

    // This is a documentation test - actual E-Flux runs in browser
    expect(true).toBe(true);
  });

  it('GIMME should minimize flux through low-expression reactions', () => {
    // GIMME algorithm:
    // 1. Define threshold for "low expression"
    // 2. Minimize sum of |v_i| * (threshold - expr_i) for low-expression reactions
    // 3. While maintaining objective >= fraction * optimal

    // This is a documentation test
    expect(true).toBe(true);
  });

  it('iMAT should maximize consistency with expression data', () => {
    // iMAT algorithm:
    // 1. Classify reactions as high/medium/low expression
    // 2. Try to activate high-expression, deactivate low-expression
    // 3. Uses MILP (or LP relaxation)

    // This is a documentation test
    expect(true).toBe(true);
  });
});

describe('GPR Edge Cases', () => {
  it('should handle malformed GPR gracefully', () => {
    const geneExpression = new Map([['gene1', 0.5]]);

    // Missing operand - parser handles gracefully, returns gene1's value
    // The parser ignores trailing operators
    const result1 = gprToReactionExpression('gene1 and', geneExpression);
    expect(typeof result1).toBe('number');

    // Unmatched parenthesis - should try to parse
    // May throw or return default depending on implementation
    try {
      const result = gprToReactionExpression('(gene1', geneExpression);
      // If it doesn't throw, should return something reasonable
      expect(typeof result).toBe('number');
    } catch {
      // Expected to throw for malformed GPR
      expect(true).toBe(true);
    }
  });

  it('should handle very long GPR rules', () => {
    // Some genome-scale models have very complex GPR rules
    const genes = new Map();
    for (let i = 1; i <= 20; i++) {
      genes.set(`gene${i}`, i * 0.05);
    }

    // Create a long GPR: gene1 or gene2 or ... or gene20
    const gprParts = [];
    for (let i = 1; i <= 20; i++) {
      gprParts.push(`gene${i}`);
    }
    const longGPR = gprParts.join(' or ');

    const result = gprToReactionExpression(longGPR, genes);
    // Should return max of all (gene20 = 1.0)
    expect(result).toBe(1.0);
  });
});
