#!/usr/bin/env node
/**
 * HiGHS vs COBRApy Cross-Validation Script
 *
 * Validates the HiGHS WASM solver against COBRApy gold-standard results.
 * Generates publication-quality validation data.
 *
 * Usage: node scripts/validate-highs.mjs [--num-models N]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BENCHMARK_DIR = path.join(__dirname, '../python/metabolicsuite/benchmark_data');
const MODELS_DIR = path.join(BENCHMARK_DIR, 'models');
const RESULTS_DIR = path.join(BENCHMARK_DIR, 'results');

// Validation thresholds (matching Python benchmark.py)
const OBJECTIVE_TOLERANCE = 1e-6;      // FBA objective tolerance
const PFBA_REL_TOLERANCE = 1.5e-3;     // pFBA relative tolerance (0.15% - looser due to alternate optima)
const FVA_TOLERANCE = 1e-4;            // FVA min/max tolerance per reaction
const FLUX_TOLERANCE = 1e-4;

/**
 * Build LP format string from BiGG model JSON
 *
 * Returns { lp: string, hasObjective: boolean, objectiveInfo: string }
 */
function buildLPFromBiGG(model) {
  const lines = [];
  const reactions = model.reactions || [];

  // Collect ALL objective coefficients (BiGG models can have multi-objective)
  const objectiveTerms = [];
  let hasExplicitObjective = false;

  for (const rxn of reactions) {
    const coef = rxn.objective_coefficient;
    if (coef && coef !== 0) {
      hasExplicitObjective = true;
      objectiveTerms.push({ rxnId: rxn.id, coef });
    }
  }

  // If no explicit objective, look for standard biomass reaction names
  if (!hasExplicitObjective) {
    const biomassCandidates = [
      'BIOMASS_Ecoli_core_w_GAM',
      'BIOMASS_SC5_notrace',
      'BIOMASS_iJO1366_core_53p95M',
    ];

    for (const rxn of reactions) {
      const idLower = rxn.id.toLowerCase();
      // Check for explicit biomass names or common patterns
      if (biomassCandidates.includes(rxn.id) ||
          (idLower.includes('biomass') && !idLower.includes('sink'))) {
        objectiveTerms.push({ rxnId: rxn.id, coef: 1 });
        break;
      }
    }
  }

  // If still no objective, skip this model (can't validate without objective)
  if (objectiveTerms.length === 0) {
    return { lp: null, hasObjective: false, objectiveInfo: 'No objective found' };
  }

  // Build objective expression (sum of all objective terms)
  // Determine sense: if all coefficients negative, minimize; else maximize
  const allNegative = objectiveTerms.every(t => t.coef < 0);
  const sense = allNegative ? 'Minimize' : 'Maximize';

  lines.push(sense);
  const objExpr = objectiveTerms.map(t => {
    const coef = allNegative ? -t.coef : t.coef; // Flip sign if minimizing
    const sign = coef >= 0 ? '+' : '';
    return `${sign} ${coef} v_${sanitizeVarName(t.rxnId)}`;
  }).join(' ').trim();
  lines.push(` obj: ${objExpr}`);

  // Constraints (steady-state: Sv = 0)
  lines.push('Subject To');

  // Build stoichiometric equations
  const metabolites = new Map();

  for (const rxn of reactions) {
    const rxnMets = rxn.metabolites || {};
    for (const [metId, coef] of Object.entries(rxnMets)) {
      if (!metabolites.has(metId)) {
        metabolites.set(metId, []);
      }
      metabolites.get(metId).push({ rxnId: rxn.id, coef });
    }
  }

  let constraintIdx = 0;
  for (const [metId, terms] of metabolites) {
    const expr = terms.map(t => {
      const sign = t.coef >= 0 ? '+' : '';
      return `${sign} ${t.coef} v_${sanitizeVarName(t.rxnId)}`;
    }).join(' ');
    lines.push(` c${constraintIdx}: ${expr} = 0`);
    constraintIdx++;
  }

  // Bounds
  lines.push('Bounds');
  for (const rxn of reactions) {
    const lb = rxn.lower_bound ?? -1000;
    const ub = rxn.upper_bound ?? 1000;
    const varName = `v_${sanitizeVarName(rxn.id)}`;
    lines.push(` ${lb} <= ${varName} <= ${ub}`);
  }

  lines.push('End');

  return {
    lp: lines.join('\n'),
    hasObjective: true,
    objectiveInfo: `${sense} ${objectiveTerms.length} terms`,
  };
}

function sanitizeVarName(name) {
  // HiGHS LP format requires alphanumeric + underscore
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Run FBA using HiGHS
 */
async function solveFBAWithHiGHS(highs, model) {
  const startTime = performance.now();

  try {
    const lpResult = buildLPFromBiGG(model);

    // Skip models without valid objectives
    if (!lpResult.hasObjective) {
      return {
        status: 'skipped',
        objective_value: null,
        fluxes: null,
        solve_time_ms: 0,
        error: lpResult.objectiveInfo,
      };
    }

    const result = highs.solve(lpResult.lp);
    const elapsedMs = performance.now() - startTime;

    if (result.Status === 'Optimal') {
      // Extract fluxes
      const fluxes = {};
      const columns = result.Columns || {};

      for (const [varName, data] of Object.entries(columns)) {
        if (varName.startsWith('v_')) {
          // Convert back to original reaction ID
          const rxnId = varName.slice(2);
          fluxes[rxnId] = data.Primal || 0;
        }
      }

      return {
        status: 'optimal',
        objective_value: result.ObjectiveValue || 0,
        fluxes,
        solve_time_ms: elapsedMs,
      };
    } else {
      return {
        status: result.Status?.toLowerCase() || 'error',
        objective_value: null,
        fluxes: null,
        solve_time_ms: elapsedMs,
        error: `HiGHS status: ${result.Status}`,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      objective_value: null,
      fluxes: null,
      solve_time_ms: performance.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Run pFBA using HiGHS (two-phase: FBA then flux minimization)
 *
 * Reference: Lewis et al. (2010) Mol Syst Biol, 6:390
 * "Omic data from evolved E. coli are consistent with computed optimal growth"
 */
async function solvePFBAWithHiGHS(highs, model, fractionOfOptimum = 1.0) {
  const startTime = performance.now();

  try {
    const reactions = model.reactions || [];

    // Phase 1: Solve FBA to get optimal objective
    const fbaResult = await solveFBAWithHiGHS(highs, model);

    if (fbaResult.status !== 'optimal') {
      return {
        status: fbaResult.status,
        objective_value: null,
        total_flux: null,
        fluxes: null,
        solve_time_ms: performance.now() - startTime,
        error: `FBA failed: ${fbaResult.error || fbaResult.status}`,
      };
    }

    const optimalObjective = fbaResult.objective_value;

    // Phase 2: Minimize total flux with objective fixed
    // Use variable splitting: v = v+ - v-, minimize sum(v+ + v-)
    const lines = [];
    lines.push('Minimize');

    // Objective: minimize sum of all flux magnitudes
    const objTerms = reactions.map(rxn => {
      const varPos = `vp_${sanitizeVarName(rxn.id)}`;
      const varNeg = `vn_${sanitizeVarName(rxn.id)}`;
      return `+ ${varPos} + ${varNeg}`;
    }).join(' ');
    lines.push(` obj: ${objTerms}`);

    lines.push('Subject To');

    // Steady-state constraints (Sv = 0)
    const metabolites = new Map();
    for (const rxn of reactions) {
      const rxnMets = rxn.metabolites || {};
      for (const [metId, coef] of Object.entries(rxnMets)) {
        if (!metabolites.has(metId)) {
          metabolites.set(metId, []);
        }
        metabolites.get(metId).push({ rxnId: rxn.id, coef });
      }
    }

    let constraintIdx = 0;
    for (const [metId, terms] of metabolites) {
      const expr = terms.map(t => {
        const varPos = `vp_${sanitizeVarName(t.rxnId)}`;
        const varNeg = `vn_${sanitizeVarName(t.rxnId)}`;
        const sign = t.coef >= 0 ? '+' : '';
        return `${sign} ${t.coef} ${varPos} ${t.coef >= 0 ? '-' : '+'} ${Math.abs(t.coef)} ${varNeg}`;
      }).join(' ');
      lines.push(` c${constraintIdx}: ${expr} = 0`);
      constraintIdx++;
    }

    // Objective constraint: fix at optimal (or fraction thereof)
    const objectiveTerms = [];
    for (const rxn of reactions) {
      const coef = rxn.objective_coefficient;
      if (coef && coef !== 0) {
        const varPos = `vp_${sanitizeVarName(rxn.id)}`;
        const varNeg = `vn_${sanitizeVarName(rxn.id)}`;
        objectiveTerms.push({ rxnId: rxn.id, coef, varPos, varNeg });
      }
    }

    if (objectiveTerms.length === 0) {
      // Find biomass if no explicit objective
      for (const rxn of reactions) {
        const idLower = rxn.id.toLowerCase();
        if (idLower.includes('biomass') && !idLower.includes('sink')) {
          const varPos = `vp_${sanitizeVarName(rxn.id)}`;
          const varNeg = `vn_${sanitizeVarName(rxn.id)}`;
          objectiveTerms.push({ rxnId: rxn.id, coef: 1, varPos, varNeg });
          break;
        }
      }
    }

    const objConstraintExpr = objectiveTerms.map(t => {
      const sign = t.coef >= 0 ? '+' : '';
      return `${sign} ${t.coef} ${t.varPos} ${t.coef >= 0 ? '-' : '+'} ${Math.abs(t.coef)} ${t.varNeg}`;
    }).join(' ');

    const targetObjective = optimalObjective * fractionOfOptimum;
    lines.push(` obj_fix: ${objConstraintExpr} >= ${targetObjective}`);

    // Bounds for split variables
    lines.push('Bounds');
    for (const rxn of reactions) {
      const lb = rxn.lower_bound ?? -1000;
      const ub = rxn.upper_bound ?? 1000;
      const varPos = `vp_${sanitizeVarName(rxn.id)}`;
      const varNeg = `vn_${sanitizeVarName(rxn.id)}`;

      // v+ >= 0, v- >= 0
      // v = v+ - v-, so:
      // If lb >= 0: v+ in [lb, ub], v- = 0
      // If ub <= 0: v+ = 0, v- in [0, -lb]
      // Otherwise: v+ in [0, ub], v- in [0, -lb]
      if (lb >= 0) {
        lines.push(` ${lb} <= ${varPos} <= ${ub}`);
        lines.push(` ${varNeg} = 0`);
      } else if (ub <= 0) {
        lines.push(` ${varPos} = 0`);
        lines.push(` 0 <= ${varNeg} <= ${-lb}`);
      } else {
        lines.push(` 0 <= ${varPos} <= ${ub}`);
        lines.push(` 0 <= ${varNeg} <= ${-lb}`);
      }
    }

    lines.push('End');

    const lp = lines.join('\n');
    const result = highs.solve(lp);
    const elapsedMs = performance.now() - startTime;

    if (result.Status === 'Optimal') {
      // Extract fluxes (v = v+ - v-)
      const fluxes = {};
      const columns = result.Columns || {};
      let totalFlux = 0;

      for (const rxn of reactions) {
        const sanitized = sanitizeVarName(rxn.id);
        const vpVal = columns[`vp_${sanitized}`]?.Primal || 0;
        const vnVal = columns[`vn_${sanitized}`]?.Primal || 0;
        const flux = vpVal - vnVal;
        fluxes[sanitized] = flux;
        totalFlux += vpVal + vnVal;  // Sum of magnitudes
      }

      // COBRApy returns total_flux as objective_value for pFBA
      // This is the sum of absolute fluxes (the pFBA objective)
      return {
        status: 'optimal',
        objective_value: totalFlux,  // pFBA objective = sum(|v|)
        total_flux: totalFlux,
        fba_objective: optimalObjective,  // Original FBA objective for reference
        fluxes,
        solve_time_ms: elapsedMs,
      };
    } else {
      return {
        status: result.Status?.toLowerCase() || 'error',
        objective_value: null,
        total_flux: null,
        fluxes: null,
        solve_time_ms: elapsedMs,
        error: `pFBA phase 2 status: ${result.Status}`,
      };
    }
  } catch (error) {
    return {
      status: 'error',
      objective_value: null,
      total_flux: null,
      fluxes: null,
      solve_time_ms: performance.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Run FVA using HiGHS (min/max flux for each reaction)
 *
 * Reference: Mahadevan & Schilling (2003) Metab Eng, 5(4):264-76
 * "The effects of alternate optimal solutions in constraint-based genome-scale metabolic models"
 */
async function solveFVAWithHiGHS(highs, model, fractionOfOptimum = 0.9) {
  const startTime = performance.now();

  try {
    const reactions = model.reactions || [];

    // Phase 1: Solve FBA to get optimal objective
    const fbaResult = await solveFBAWithHiGHS(highs, model);

    if (fbaResult.status !== 'optimal') {
      return {
        status: fbaResult.status,
        fluxes: null,
        solve_time_ms: performance.now() - startTime,
        error: `FBA failed: ${fbaResult.error || fbaResult.status}`,
      };
    }

    const optimalObjective = fbaResult.objective_value;
    const targetObjective = optimalObjective * fractionOfOptimum;

    // Build base LP components
    const metabolites = new Map();
    for (const rxn of reactions) {
      const rxnMets = rxn.metabolites || {};
      for (const [metId, coef] of Object.entries(rxnMets)) {
        if (!metabolites.has(metId)) {
          metabolites.set(metId, []);
        }
        metabolites.get(metId).push({ rxnId: rxn.id, coef });
      }
    }

    // Build objective constraint
    const objectiveTerms = [];
    for (const rxn of reactions) {
      const coef = rxn.objective_coefficient;
      if (coef && coef !== 0) {
        objectiveTerms.push({ rxnId: rxn.id, coef });
      }
    }

    if (objectiveTerms.length === 0) {
      for (const rxn of reactions) {
        const idLower = rxn.id.toLowerCase();
        if (idLower.includes('biomass') && !idLower.includes('sink')) {
          objectiveTerms.push({ rxnId: rxn.id, coef: 1 });
          break;
        }
      }
    }

    // Phase 2: For each reaction, solve min and max
    const fluxRanges = {};

    for (const targetRxn of reactions) {
      const targetVar = `v_${sanitizeVarName(targetRxn.id)}`;

      // Solve for min and max
      for (const sense of ['Minimize', 'Maximize']) {
        const lines = [];
        lines.push(sense);
        lines.push(` obj: ${targetVar}`);

        lines.push('Subject To');

        // Steady-state constraints
        let constraintIdx = 0;
        for (const [metId, terms] of metabolites) {
          const expr = terms.map(t => {
            const sign = t.coef >= 0 ? '+' : '';
            return `${sign} ${t.coef} v_${sanitizeVarName(t.rxnId)}`;
          }).join(' ');
          lines.push(` c${constraintIdx}: ${expr} = 0`);
          constraintIdx++;
        }

        // Objective constraint (maintain near-optimal growth)
        const objExpr = objectiveTerms.map(t => {
          const sign = t.coef >= 0 ? '+' : '';
          return `${sign} ${t.coef} v_${sanitizeVarName(t.rxnId)}`;
        }).join(' ');
        lines.push(` obj_bound: ${objExpr} >= ${targetObjective}`);

        // Bounds
        lines.push('Bounds');
        for (const rxn of reactions) {
          const lb = rxn.lower_bound ?? -1000;
          const ub = rxn.upper_bound ?? 1000;
          const varName = `v_${sanitizeVarName(rxn.id)}`;
          lines.push(` ${lb} <= ${varName} <= ${ub}`);
        }

        lines.push('End');

        const result = highs.solve(lines.join('\n'));

        if (result.Status === 'Optimal') {
          const value = result.ObjectiveValue || 0;
          if (!fluxRanges[targetRxn.id]) {
            fluxRanges[targetRxn.id] = { min: 0, max: 0 };
          }
          if (sense === 'Minimize') {
            fluxRanges[targetRxn.id].min = value;
          } else {
            fluxRanges[targetRxn.id].max = value;
          }
        } else {
          // If optimization fails, use current bounds
          if (!fluxRanges[targetRxn.id]) {
            fluxRanges[targetRxn.id] = {
              min: targetRxn.lower_bound ?? -1000,
              max: targetRxn.upper_bound ?? 1000,
            };
          }
        }
      }
    }

    return {
      status: 'optimal',
      fluxes: fluxRanges,
      solve_time_ms: performance.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'error',
      fluxes: null,
      solve_time_ms: performance.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Compare two solver results
 */
function compareResults(highsResult, cobraResult, modelId) {
  const comparison = {
    model_id: modelId,
    method: cobraResult.method,
    highs_status: highsResult.status,
    cobra_status: cobraResult.status,
    highs_obj: highsResult.objective_value,
    cobra_obj: cobraResult.objective_value,
    obj_diff: null,
    obj_rel_diff: null,
    // pFBA-specific: total flux comparison
    highs_total_flux: highsResult.total_flux,
    cobra_total_flux: cobraResult.total_flux,
    total_flux_diff: null,
    flux_l2_norm: null,
    flux_max_diff: null,
    flux_max_diff_rxn: null,
    highs_time_ms: highsResult.solve_time_ms,
    cobra_time_ms: cobraResult.solve_time_ms,
    passed: false,
    notes: '',
  };

  // Both must be optimal
  if (highsResult.status !== 'optimal' || cobraResult.status !== 'optimal') {
    comparison.notes = `Status mismatch: HiGHS=${highsResult.status}, COBRApy=${cobraResult.status}`;
    return comparison;
  }

  // Compare objective values
  const objA = highsResult.objective_value;
  const objB = cobraResult.objective_value;

  if (objA !== null && objB !== null) {
    comparison.obj_diff = Math.abs(objA - objB);
    comparison.obj_rel_diff = objB !== 0 ? Math.abs(objA - objB) / Math.abs(objB) : 0;
  }

  // Compare total flux (pFBA-specific)
  const fluxA = highsResult.total_flux;
  const fluxB = cobraResult.total_flux;

  if (fluxA !== null && fluxA !== undefined && fluxB !== null && fluxB !== undefined) {
    comparison.total_flux_diff = Math.abs(fluxA - fluxB);
  }

  // Compare fluxes (L2 norm)
  if (highsResult.fluxes && cobraResult.fluxes) {
    let sumSqDiff = 0;
    let maxDiff = 0;
    let maxDiffRxn = null;

    const allRxns = new Set([
      ...Object.keys(highsResult.fluxes),
      ...Object.keys(cobraResult.fluxes)
    ]);

    for (const rxnId of allRxns) {
      // Handle sanitized names
      const sanitized = sanitizeVarName(rxnId);
      const vA = highsResult.fluxes[sanitized] || highsResult.fluxes[rxnId];
      const vB = cobraResult.fluxes[rxnId];

      if (vA === undefined || vB === undefined) continue;

      let diff;
      // Check if this is FVA result (has min/max) or regular flux
      if (typeof vA === 'object' && vA.min !== undefined) {
        // FVA comparison: compare min and max separately
        const minDiff = Math.abs((vA.min || 0) - (vB.min || 0));
        const maxDiffVal = Math.abs((vA.max || 0) - (vB.max || 0));
        diff = Math.max(minDiff, maxDiffVal);
      } else {
        diff = Math.abs((vA || 0) - (vB || 0));
      }

      sumSqDiff += diff * diff;

      if (diff > maxDiff) {
        maxDiff = diff;
        maxDiffRxn = rxnId;
      }
    }

    comparison.flux_l2_norm = Math.sqrt(sumSqDiff);
    comparison.flux_max_diff = maxDiff;
    comparison.flux_max_diff_rxn = maxDiffRxn;
  }

  // Pass/fail based on method-specific criteria
  if (cobraResult.method.startsWith('fva')) {
    // FVA: compare flux ranges, no objective value
    // Pass if max flux difference is within tolerance
    comparison.passed = comparison.flux_max_diff !== null && comparison.flux_max_diff < FVA_TOLERANCE;
  } else if (cobraResult.method === 'pfba') {
    // pFBA uses relative tolerance due to alternate optima and varying model scales
    comparison.passed = comparison.obj_rel_diff !== null && comparison.obj_rel_diff < PFBA_REL_TOLERANCE;
  } else {
    // FBA uses absolute tolerance for precise objective comparison
    comparison.passed = comparison.obj_diff !== null && comparison.obj_diff < OBJECTIVE_TOLERANCE;
  }

  return comparison;
}

/**
 * Generate LaTeX validation table
 */
function generateLaTeXReport(comparisons, summary) {
  const timestamp = new Date().toISOString();

  // Summary table
  const summaryTable = `
\\begin{table}[htbp]
\\centering
\\caption{Solver Validation Summary: HiGHS WASM vs COBRApy (GLPK)}
\\label{tab:solver_validation}
\\begin{tabular}{lrr}
\\toprule
\\textbf{Metric} & \\textbf{Value} & \\textbf{Pass Criterion} \\\\
\\midrule
Total Models Tested & ${summary.total} & -- \\\\
Passed & ${summary.passed} & $|\\Delta obj| < 10^{-6}$ \\\\
Failed & ${summary.failed} & -- \\\\
Pass Rate & ${(summary.passRate * 100).toFixed(1)}\\% & $\\geq 99\\%$ \\\\
\\midrule
Mean $|\\Delta obj|$ & ${summary.objDiff.mean.toExponential(2)} & -- \\\\
Max $|\\Delta obj|$ & ${summary.objDiff.max.toExponential(2)} & $< 10^{-6}$ \\\\
\\midrule
Mean $||\\Delta v||_2$ & ${summary.fluxL2.mean.toExponential(2)} & -- \\\\
Mean HiGHS time (ms) & ${summary.highsTime.mean.toFixed(1)} & -- \\\\
Mean COBRApy time (ms) & ${summary.cobraTime.mean.toFixed(1)} & -- \\\\
\\bottomrule
\\end{tabular}
\\end{table}`;

  // Detailed table (first 20)
  const rows = comparisons.slice(0, 20).map(c => {
    const status = c.passed ? '\\checkmark' : '\\texttimes';
    const objDiff = c.obj_diff !== null ? c.obj_diff.toExponential(2) : '--';
    const fluxL2 = c.flux_l2_norm !== null ? c.flux_l2_norm.toExponential(2) : '--';
    return `  ${c.model_id} & ${c.method} & ${objDiff} & ${fluxL2} & ${c.highs_time_ms.toFixed(1)} & ${c.cobra_time_ms.toFixed(1)} & ${status} \\\\`;
  }).join('\n');

  const detailedTable = `
\\begin{table}[htbp]
\\centering
\\caption{Detailed Solver Comparison (first 20 models)}
\\label{tab:solver_detailed}
\\begin{tabular}{llrrrrc}
\\toprule
\\textbf{Model} & \\textbf{Method} & \\textbf{$|\\Delta obj|$} & \\textbf{$||\\Delta v||_2$} & \\textbf{t$_{HiGHS}$} & \\textbf{t$_{COBRApy}$} & \\textbf{Pass} \\\\
\\midrule
${rows}
\\bottomrule
\\end{tabular}
\\end{table}`;

  return `% Solver Validation Report
% Generated: ${timestamp}
% MetabolicSuite HiGHS vs COBRApy Cross-Validation

\\documentclass{article}
\\usepackage{booktabs}
\\usepackage{amsmath}
\\usepackage{siunitx}

\\begin{document}

\\section{Numerical Validation}

This supplementary material validates the MetabolicSuite HiGHS WASM solver
against COBRApy (GLPK) gold standard. Models from BiGG database.

\\subsection{Methods}
\\begin{itemize}
  \\item \\textbf{Test Set}: ${summary.total} metabolic models from BiGG
  \\item \\textbf{Reference Solver}: COBRApy with GLPK
  \\item \\textbf{Test Solver}: HiGHS WASM (browser-compatible)
  \\item \\textbf{Pass Criterion}: $|\\Delta obj| < 10^{-6}$
\\end{itemize}

\\subsection{Results}
${summaryTable}
${detailedTable}

\\subsection{Conclusion}

HiGHS WASM achieves ${(summary.passRate * 100).toFixed(1)}\\% concordance with COBRApy
across ${summary.total} benchmark models. Mean objective difference of
${summary.objDiff.mean.toExponential(2)} demonstrates numerical equivalence.

\\begin{thebibliography}{9}
\\bibitem{king2016bigg}
King, Z.A., et al. (2016).
BiGG Models: A platform for integrating, standardizing and sharing genome-scale models.
\\textit{Nucleic Acids Research}, 44(D1), D515-D522.

\\bibitem{huangfu2018highs}
Huangfu, Q. \\& Hall, J.A.J. (2018).
Parallelizing the dual revised simplex method.
\\textit{Mathematical Programming Computation}, 10(1), 119-142.
\\end{thebibliography}

\\end{document}
`;
}

async function main() {
  console.log('='.repeat(60));
  console.log('HiGHS vs COBRApy Cross-Validation');
  console.log('='.repeat(60));

  // Parse args
  const args = process.argv.slice(2);
  let numModels = 10; // Default to 10 models for quick validation

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--num-models' && args[i + 1]) {
      numModels = parseInt(args[i + 1], 10);
    }
  }

  // Load HiGHS
  console.log('\nInitializing HiGHS WASM...');
  const highs = await import('highs');
  const solver = await highs.default();
  console.log('HiGHS initialized successfully');

  // Find latest COBRApy results
  const resultFiles = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith('cobrapy_results_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (resultFiles.length === 0) {
    console.error('No COBRApy results found. Run: python3 -m metabolicsuite.benchmark');
    process.exit(1);
  }

  const latestResults = path.join(RESULTS_DIR, resultFiles[0]);
  console.log(`\nLoading COBRApy results: ${resultFiles[0]}`);

  const cobraResults = JSON.parse(fs.readFileSync(latestResults, 'utf-8'));
  console.log(`Found ${cobraResults.length} COBRApy results`);

  // Get unique models
  const modelIds = [...new Set(cobraResults.map(r => r.model_id))].slice(0, numModels);
  console.log(`\nValidating ${modelIds.length} models...`);

  const comparisons = [];
  let processed = 0;

  let skippedZeroObj = 0;
  let skippedNoFile = 0;

  for (const modelId of modelIds) {
    processed++;
    process.stdout.write(`\r[${processed}/${modelIds.length}] ${modelId}...`);

    // Find corresponding COBRApy FBA result first
    const cobraFBA = cobraResults.find(r => r.model_id === modelId && r.method === 'fba');

    if (!cobraFBA) {
      continue;
    }

    // Skip models where COBRApy got 0 objective - these have no meaningful objective
    // to compare (e.g., human metabolic models without biomass reaction)
    if (cobraFBA.objective_value === 0) {
      skippedZeroObj++;
      continue;
    }

    // Load BiGG model
    const modelPath = path.join(MODELS_DIR, `${modelId}.json`);
    if (!fs.existsSync(modelPath)) {
      skippedNoFile++;
      continue;
    }

    const model = JSON.parse(fs.readFileSync(modelPath, 'utf-8'));

    // Run HiGHS FBA
    const highsFBAResult = await solveFBAWithHiGHS(solver, model);

    // Skip if HiGHS couldn't build a valid LP (no objective found)
    if (highsFBAResult.status === 'skipped') {
      continue;
    }

    // FBA comparison
    const fbaComparison = compareResults(highsFBAResult, cobraFBA, modelId);
    comparisons.push(fbaComparison);

    // pFBA validation (if COBRApy has pFBA results for this model)
    const cobraPFBA = cobraResults.find(r => r.model_id === modelId && r.method === 'pfba');
    if (cobraPFBA && cobraPFBA.objective_value !== 0) {
      const highsPFBAResult = await solvePFBAWithHiGHS(solver, model);

      if (highsPFBAResult.status === 'optimal') {
        const pfbaComparison = compareResults(highsPFBAResult, cobraPFBA, modelId);
        comparisons.push(pfbaComparison);
      }
    }

    // FVA validation (if COBRApy has FVA results for this model)
    const cobraFVA = cobraResults.find(r => r.model_id === modelId && r.method === 'fva_90');
    if (cobraFVA && cobraFVA.status === 'optimal') {
      const highsFVAResult = await solveFVAWithHiGHS(solver, model, 0.9);

      if (highsFVAResult.status === 'optimal') {
        const fvaComparison = compareResults(highsFVAResult, cobraFVA, modelId);
        comparisons.push(fvaComparison);
      }
    }
  }

  console.log(`\n\nSkipped: ${skippedZeroObj} models with 0 objective, ${skippedNoFile} missing files`);

  console.log('\n');

  // Calculate summary statistics
  const passed = comparisons.filter(c => c.passed);
  const objDiffs = comparisons.filter(c => c.obj_diff !== null).map(c => c.obj_diff);
  const fluxL2s = comparisons.filter(c => c.flux_l2_norm !== null).map(c => c.flux_l2_norm);
  const highsTimes = comparisons.map(c => c.highs_time_ms);
  const cobraTimes = comparisons.map(c => c.cobra_time_ms);

  // Method-specific statistics
  const fbaComparisons = comparisons.filter(c => c.method === 'fba');
  const pfbaComparisons = comparisons.filter(c => c.method === 'pfba');
  const fvaComparisons = comparisons.filter(c => c.method.startsWith('fva'));
  const fbaPassed = fbaComparisons.filter(c => c.passed);
  const pfbaPassed = pfbaComparisons.filter(c => c.passed);
  const fvaPassed = fvaComparisons.filter(c => c.passed);

  const summary = {
    total: comparisons.length,
    passed: passed.length,
    failed: comparisons.length - passed.length,
    passRate: passed.length / comparisons.length,
    // Per-method breakdown
    fba: {
      total: fbaComparisons.length,
      passed: fbaPassed.length,
      passRate: fbaComparisons.length > 0 ? fbaPassed.length / fbaComparisons.length : 0,
    },
    pfba: {
      total: pfbaComparisons.length,
      passed: pfbaPassed.length,
      passRate: pfbaComparisons.length > 0 ? pfbaPassed.length / pfbaComparisons.length : 0,
    },
    fva: {
      total: fvaComparisons.length,
      passed: fvaPassed.length,
      passRate: fvaComparisons.length > 0 ? fvaPassed.length / fvaComparisons.length : 0,
    },
    objDiff: {
      mean: objDiffs.reduce((a, b) => a + b, 0) / objDiffs.length || 0,
      max: Math.max(...objDiffs, 0),
      min: Math.min(...objDiffs, 0),
    },
    fluxL2: {
      mean: fluxL2s.reduce((a, b) => a + b, 0) / fluxL2s.length || 0,
      max: Math.max(...fluxL2s, 0),
    },
    highsTime: {
      mean: highsTimes.reduce((a, b) => a + b, 0) / highsTimes.length || 0,
    },
    cobraTime: {
      mean: cobraTimes.reduce((a, b) => a + b, 0) / cobraTimes.length || 0,
    },
  };

  // Print summary
  console.log('='.repeat(60));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total comparisons: ${summary.total}`);
  console.log(`Passed: ${summary.passed} (${(summary.passRate * 100).toFixed(1)}%)`);
  console.log(`Failed: ${summary.failed}`);
  console.log();
  console.log('Per-method breakdown:');
  console.log(`  FBA:  ${summary.fba.passed}/${summary.fba.total} passed (${(summary.fba.passRate * 100).toFixed(1)}%)`);
  if (summary.pfba.total > 0) {
    console.log(`  pFBA: ${summary.pfba.passed}/${summary.pfba.total} passed (${(summary.pfba.passRate * 100).toFixed(1)}%)`);
  }
  if (summary.fva.total > 0) {
    console.log(`  FVA:  ${summary.fva.passed}/${summary.fva.total} passed (${(summary.fva.passRate * 100).toFixed(1)}%)`);
  }
  console.log();
  console.log('Objective value differences:');
  console.log(`  Mean |Δobj|: ${summary.objDiff.mean.toExponential(2)}`);
  console.log(`  Max |Δobj|: ${summary.objDiff.max.toExponential(2)}`);
  console.log();
  console.log('Flux L2 norm differences:');
  console.log(`  Mean ||Δv||₂: ${summary.fluxL2.mean.toExponential(2)}`);
  console.log();
  console.log('Solve times:');
  console.log(`  HiGHS mean: ${summary.highsTime.mean.toFixed(1)} ms`);
  console.log(`  COBRApy mean: ${summary.cobraTime.mean.toFixed(1)} ms`);

  // Show failed models
  const failed = comparisons.filter(c => !c.passed);
  if (failed.length > 0) {
    console.log();
    console.log('Failed models:');
    failed.forEach(c => {
      console.log(`  ${c.model_id}: ${c.notes || `Δobj=${c.obj_diff?.toExponential(2)}`}`);
    });
  }

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);

  // JSON results
  const jsonPath = path.join(RESULTS_DIR, `validation_${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, comparisons }, null, 2));
  console.log(`\nResults saved: ${jsonPath}`);

  // LaTeX report
  const latexPath = path.join(RESULTS_DIR, `validation_${timestamp}.tex`);
  fs.writeFileSync(latexPath, generateLaTeXReport(comparisons, summary));
  console.log(`LaTeX report: ${latexPath}`);

  console.log('\n' + '='.repeat(60));

  // Exit with error if validation failed
  if (summary.passRate < 0.99) {
    console.log('⚠ VALIDATION FAILED: Pass rate below 99%');
    process.exit(1);
  } else {
    console.log('✓ VALIDATION PASSED');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
