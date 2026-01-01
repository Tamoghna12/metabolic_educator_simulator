/**
 * HiGHSSolver - High-Performance LP/MILP Solver for Browser
 *
 * Wrapper around HiGHS WASM for solving:
 * - Linear Programs (LP) - FBA, pFBA, E-Flux
 * - Mixed-Integer Linear Programs (MILP) - iMAT, GIMME (true formulation)
 *
 * HiGHS is currently the world's best open-source LP/MILP solver:
 * - Developed at University of Edinburgh
 * - Used by Google OR-Tools, SciPy, and Julia
 * - Outperforms GLPK by 10-100x on large problems
 *
 * Reference:
 * - Huangfu & Hall (2018) "Parallelizing the dual revised simplex method"
 *   Mathematical Programming Computation
 *
 * @module HiGHSSolver
 */

// Solver status codes
export const SolverStatus = {
  OPTIMAL: 'optimal',
  INFEASIBLE: 'infeasible',
  UNBOUNDED: 'unbounded',
  ERROR: 'error',
  TIMEOUT: 'timeout',
};

// HiGHS status mapping
const HIGHS_STATUS_MAP = {
  'Optimal': SolverStatus.OPTIMAL,
  'Infeasible': SolverStatus.INFEASIBLE,
  'Unbounded': SolverStatus.UNBOUNDED,
  'Error': SolverStatus.ERROR,
};

/**
 * HiGHS Solver class
 */
class HiGHSSolverClass {
  constructor() {
    this.highs = null;
    this.initialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize the HiGHS WASM module
   */
  async initialize() {
    if (this.initialized) return this;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        // Import HiGHS WASM - handle various module formats (CJS/ESM)
        const highsImport = await import('highs');
        let highsFactory = highsImport;
        if (typeof highsFactory !== 'function') {
          highsFactory = highsImport.default;
        }
        if (typeof highsFactory !== 'function' && highsFactory?.default) {
          highsFactory = highsFactory.default;
        }
        // Pass locateFile to ensure WASM is loaded from public folder
        this.highs = await highsFactory({
          locateFile: (file) => file.endsWith('.wasm') ? '/highs.wasm' : file
        });
        this.initialized = true;
        console.log('HiGHS WASM initialized successfully');
        return this;
      } catch (error) {
        console.error('Failed to initialize HiGHS:', error);
        throw new Error(`HiGHS initialization failed: ${error.message}`);
      }
    })();

    return this.initPromise;
  }

  /**
   * Build LP/MILP problem in CPLEX LP format
   *
   * @param {Object} problem - Problem definition
   * @returns {string} CPLEX LP format string
   */
  buildLPFormat(problem) {
    const lines = [];

    // Objective
    lines.push(problem.sense === 'min' ? 'Minimize' : 'Maximize');
    lines.push(' obj: ' + this.formatExpression(problem.objective));

    // Constraints
    lines.push('Subject To');
    problem.constraints.forEach((constraint, i) => {
      const name = constraint.name || `c${i}`;
      const expr = this.formatExpression(constraint.lhs);

      if (constraint.type === 'eq') {
        lines.push(` ${name}: ${expr} = ${constraint.rhs}`);
      } else if (constraint.type === 'le') {
        lines.push(` ${name}: ${expr} <= ${constraint.rhs}`);
      } else if (constraint.type === 'ge') {
        lines.push(` ${name}: ${expr} >= ${constraint.rhs}`);
      } else if (constraint.type === 'range') {
        lines.push(` ${name}: ${constraint.lb} <= ${expr} <= ${constraint.ub}`);
      }
    });

    // Bounds
    lines.push('Bounds');
    problem.variables.forEach(v => {
      const lb = v.lb ?? 0;
      const ub = v.ub ?? Infinity;

      if (lb === -Infinity && ub === Infinity) {
        lines.push(` ${v.name} free`);
      } else if (lb === -Infinity) {
        lines.push(` -inf <= ${v.name} <= ${ub}`);
      } else if (ub === Infinity) {
        lines.push(` ${v.name} >= ${lb}`);
      } else if (lb === ub) {
        lines.push(` ${v.name} = ${lb}`);
      } else {
        lines.push(` ${lb} <= ${v.name} <= ${ub}`);
      }
    });

    // Integer/Binary variables
    const binaries = problem.variables.filter(v => v.type === 'binary');
    const integers = problem.variables.filter(v => v.type === 'integer');

    if (binaries.length > 0) {
      lines.push('Binary');
      binaries.forEach(v => lines.push(` ${v.name}`));
    }

    if (integers.length > 0) {
      lines.push('General');
      integers.forEach(v => lines.push(` ${v.name}`));
    }

    lines.push('End');

    return lines.join('\n');
  }

  /**
   * Format a linear expression as string
   */
  formatExpression(terms) {
    if (!terms || terms.length === 0) return '0';

    return terms.map((term, i) => {
      const coef = term.coef ?? term.coefficient ?? 1;
      const name = term.name ?? term.variable;
      const sign = coef >= 0 ? (i > 0 ? ' + ' : '') : ' - ';
      const absCoef = Math.abs(coef);

      if (absCoef === 1) {
        return `${sign}${name}`;
      } else {
        return `${sign}${absCoef} ${name}`;
      }
    }).join('');
  }

  /**
   * Solve an LP/MILP problem
   *
   * @param {Object} problem - Problem definition
   * @param {Object} options - Solver options
   * @returns {Object} Solution object
   */
  async solve(problem, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = performance.now();

    try {
      // Build LP format string
      const lpString = this.buildLPFormat(problem);

      // Set solver options
      const solverOptions = {
        time_limit: options.timeLimit ?? 300, // 5 minutes default
        mip_rel_gap: options.mipGap ?? 0.01,  // 1% gap tolerance
        threads: options.threads ?? 0,         // 0 = auto
        log_to_console: options.verbose ?? false,
      };

      // Solve
      const result = this.highs.solve(lpString, solverOptions);

      const solveTime = (performance.now() - startTime) / 1000;

      // Parse result
      const status = HIGHS_STATUS_MAP[result.Status] || SolverStatus.ERROR;

      if (status !== SolverStatus.OPTIMAL) {
        return {
          status,
          objectiveValue: null,
          variables: {},
          solveTime,
          solver: 'highs-wasm',
        };
      }

      // Extract variable values
      const variables = {};
      const columns = result.Columns || {};
      Object.entries(columns).forEach(([name, data]) => {
        variables[name] = data.Primal ?? 0;
      });

      return {
        status: SolverStatus.OPTIMAL,
        objectiveValue: result.ObjectiveValue,
        variables,
        solveTime,
        solver: 'highs-wasm',
        iterations: result.SimplexIterations,
        nodes: result.MipNodes,
      };
    } catch (error) {
      console.error('HiGHS solve error:', error);
      return {
        status: SolverStatus.ERROR,
        error: error.message,
        solveTime: (performance.now() - startTime) / 1000,
        solver: 'highs-wasm',
      };
    }
  }

  /**
   * Build and solve FBA problem
   */
  async solveFBA(model, constraints = {}, knockouts = []) {
    const { problem, rxnVars } = this.buildMetabolicProblem(model, constraints, knockouts);

    const result = await this.solve(problem);

    return this.formatFBAResult(result, rxnVars, model);
  }

  /**
   * Build and solve pFBA problem (two-stage)
   */
  async solvePFBA(model, constraints = {}, knockouts = []) {
    // Stage 1: Standard FBA
    const fbaResult = await this.solveFBA(model, constraints, knockouts);

    if (fbaResult.status !== SolverStatus.OPTIMAL) {
      return fbaResult;
    }

    // Stage 2: Minimize total flux with fixed objective
    const { problem, rxnVars } = this.buildMetabolicProblem(model, constraints, knockouts);

    // Find and fix objective
    const objRxn = this.findObjectiveReaction(model);
    if (objRxn) {
      // Add constraint to maintain objective value
      problem.constraints.push({
        name: 'fix_objective',
        lhs: [{ name: `v_${objRxn}_pos`, coef: 1 }, { name: `v_${objRxn}_neg`, coef: -1 }],
        type: 'ge',
        rhs: fbaResult.objectiveValue * 0.999,
      });
    }

    // Change objective to minimize sum of absolute fluxes
    problem.objective = [];
    problem.sense = 'min';

    rxnVars.forEach(rxnId => {
      problem.objective.push({ name: `v_${rxnId}_pos`, coef: 1 });
      problem.objective.push({ name: `v_${rxnId}_neg`, coef: 1 });
    });

    const result = await this.solve(problem);

    return this.formatFBAResult(result, rxnVars, model, 'pfba');
  }

  /**
   * Build and solve FVA problem
   */
  async solveFVA(model, constraints = {}, knockouts = [], options = {}) {
    const fractionOfOptimum = options.fractionOfOptimum ?? 0.9;
    const reactions = options.reactions || Object.keys(model.reactions || {});

    // First solve FBA to get optimal objective
    const fbaResult = await this.solveFBA(model, constraints, knockouts);

    if (fbaResult.status !== SolverStatus.OPTIMAL) {
      return { status: fbaResult.status, ranges: {} };
    }

    const requiredObj = fbaResult.objectiveValue * fractionOfOptimum;
    const ranges = {};

    // For each reaction, find min and max
    for (let i = 0; i < reactions.length; i++) {
      const rxnId = reactions[i];

      // Report progress
      if (options.onProgress) {
        options.onProgress((i + 1) / reactions.length);
      }

      // Build problem with objective constraint
      const { problem, rxnVars } = this.buildMetabolicProblem(model, constraints, knockouts);

      // Add objective constraint
      const objRxn = this.findObjectiveReaction(model);
      if (objRxn) {
        problem.constraints.push({
          name: 'min_objective',
          lhs: [{ name: `v_${objRxn}_pos`, coef: 1 }, { name: `v_${objRxn}_neg`, coef: -1 }],
          type: 'ge',
          rhs: requiredObj,
        });
      }

      // Set objective to target reaction
      problem.objective = [
        { name: `v_${rxnId}_pos`, coef: 1 },
        { name: `v_${rxnId}_neg`, coef: -1 },
      ];

      // Minimize
      problem.sense = 'min';
      const minResult = await this.solve(problem);

      // Maximize
      problem.sense = 'max';
      const maxResult = await this.solve(problem);

      ranges[rxnId] = {
        min: minResult.status === SolverStatus.OPTIMAL
          ? (minResult.variables[`v_${rxnId}_pos`] || 0) - (minResult.variables[`v_${rxnId}_neg`] || 0)
          : -Infinity,
        max: maxResult.status === SolverStatus.OPTIMAL
          ? (maxResult.variables[`v_${rxnId}_pos`] || 0) - (maxResult.variables[`v_${rxnId}_neg`] || 0)
          : Infinity,
      };
    }

    return {
      status: SolverStatus.OPTIMAL,
      objectiveValue: fbaResult.objectiveValue,
      ranges,
      solver: 'highs-wasm',
    };
  }

  /**
   * Solve iMAT using true MILP formulation
   *
   * Reference: Shlomi et al. (2008) Nat Biotechnol
   */
  async solveIMAT(model, expressionData, options = {}) {
    const highThreshold = options.highThreshold ?? 0.75;
    const lowThreshold = options.lowThreshold ?? 0.25;
    const epsilon = options.epsilon ?? 1e-3;
    const M = options.bigM ?? 1000;

    const { problem, rxnVars } = this.buildMetabolicProblem(model, {}, []);

    // Classify reactions by expression
    const highExprRxns = [];
    const lowExprRxns = [];

    rxnVars.forEach(rxnId => {
      const rxn = model.reactions[rxnId];
      if (rxn.gpr || rxn.gene_reaction_rule) {
        const expr = this.evaluateGPR(rxn.gpr || rxn.gene_reaction_rule, expressionData);
        if (expr >= highThreshold) {
          highExprRxns.push(rxnId);
        } else if (expr <= lowThreshold) {
          lowExprRxns.push(rxnId);
        }
      }
    });

    // Add binary variables for high-expression reactions
    // y_h = 1 if reaction is active (|v| >= epsilon)
    highExprRxns.forEach(rxnId => {
      const yName = `y_h_${rxnId}`;

      problem.variables.push({
        name: yName,
        lb: 0,
        ub: 1,
        type: 'binary',
      });

      // v_pos + v_neg >= epsilon * y_h
      problem.constraints.push({
        name: `imat_high_${rxnId}`,
        lhs: [
          { name: `v_${rxnId}_pos`, coef: 1 },
          { name: `v_${rxnId}_neg`, coef: 1 },
          { name: yName, coef: -epsilon },
        ],
        type: 'ge',
        rhs: 0,
      });

      // Add to objective (maximize y_h)
      problem.objective.push({ name: yName, coef: 1 });
    });

    // Add binary variables for low-expression reactions
    // y_l = 1 if reaction is inactive (|v| <= epsilon)
    lowExprRxns.forEach(rxnId => {
      const yName = `y_l_${rxnId}`;

      problem.variables.push({
        name: yName,
        lb: 0,
        ub: 1,
        type: 'binary',
      });

      // v_pos + v_neg <= M * (1 - y_l) => v_pos + v_neg + M*y_l <= M
      problem.constraints.push({
        name: `imat_low_${rxnId}`,
        lhs: [
          { name: `v_${rxnId}_pos`, coef: 1 },
          { name: `v_${rxnId}_neg`, coef: 1 },
          { name: yName, coef: M },
        ],
        type: 'le',
        rhs: M,
      });

      // Add to objective (maximize y_l)
      problem.objective.push({ name: yName, coef: 1 });
    });

    // Set objective to maximize consistency
    problem.sense = 'max';

    const result = await this.solve(problem, { timeLimit: 300, mipGap: 0.05 });

    return this.formatFBAResult(result, rxnVars, model, 'imat');
  }

  /**
   * Solve GIMME using LP formulation
   *
   * Reference: Becker & Palsson (2008) PLoS Comput Biol
   */
  async solveGIMME(model, expressionData, options = {}) {
    const threshold = options.threshold ?? 0.25;
    const requiredFraction = options.requiredFraction ?? 0.9;

    // First, get optimal objective value
    const fbaResult = await this.solveFBA(model, {}, []);

    if (fbaResult.status !== SolverStatus.OPTIMAL) {
      return fbaResult;
    }

    const requiredObj = fbaResult.objectiveValue * requiredFraction;

    // Build GIMME problem
    const { problem, rxnVars } = this.buildMetabolicProblem(model, {}, []);

    // Add objective constraint
    const objRxn = this.findObjectiveReaction(model);
    if (objRxn) {
      problem.constraints.push({
        name: 'min_objective',
        lhs: [{ name: `v_${objRxn}_pos`, coef: 1 }, { name: `v_${objRxn}_neg`, coef: -1 }],
        type: 'ge',
        rhs: requiredObj,
      });
    }

    // Build GIMME objective: minimize sum((threshold - expr_i) * |v_i|) for low-expression
    problem.objective = [];
    problem.sense = 'min';

    rxnVars.forEach(rxnId => {
      const rxn = model.reactions[rxnId];
      let expr = 1.0;

      if (rxn.gpr || rxn.gene_reaction_rule) {
        expr = this.evaluateGPR(rxn.gpr || rxn.gene_reaction_rule, expressionData);
      }

      if (expr < threshold) {
        const penalty = threshold - expr;
        problem.objective.push({ name: `v_${rxnId}_pos`, coef: penalty });
        problem.objective.push({ name: `v_${rxnId}_neg`, coef: penalty });
      }
    });

    const result = await this.solve(problem);

    return this.formatFBAResult(result, rxnVars, model, 'gimme');
  }

  /**
   * Solve E-Flux (expression-based flux bounds)
   *
   * Reference: Colijn et al. (2009) Mol Syst Biol
   */
  async solveEFlux(model, expressionData, options = {}) {
    // Scale bounds by expression and solve FBA
    const scaledModel = JSON.parse(JSON.stringify(model));

    Object.entries(scaledModel.reactions).forEach(([rxnId, rxn]) => {
      if (rxn.gpr || rxn.gene_reaction_rule) {
        const expr = this.evaluateGPR(rxn.gpr || rxn.gene_reaction_rule, expressionData);
        if (expr < 1.0) {
          if (rxn.upper_bound > 0) {
            rxn.upper_bound *= expr;
          }
          if (rxn.lower_bound < 0) {
            rxn.lower_bound *= expr;
          }
        }
      }
    });

    const result = await this.solveFBA(scaledModel, {}, []);
    result.method = 'eflux';
    return result;
  }

  /**
   * Build metabolic LP problem with split variables for absolute values
   */
  buildMetabolicProblem(model, constraints = {}, knockouts = []) {
    const reactions = Object.entries(model.reactions || {});
    const metabolites = Object.entries(model.metabolites || {});

    const problem = {
      sense: 'max',
      objective: [],
      constraints: [],
      variables: [],
    };

    const rxnVars = [];

    // Create split variables for each reaction: v = v_pos - v_neg
    reactions.forEach(([rxnId, rxn]) => {
      rxnVars.push(rxnId);

      let lb = rxn.lower_bound ?? -1000;
      let ub = rxn.upper_bound ?? 1000;

      // Apply custom constraints
      if (constraints[rxnId]) {
        if (constraints[rxnId].lb !== undefined) lb = constraints[rxnId].lb;
        if (constraints[rxnId].ub !== undefined) ub = constraints[rxnId].ub;
      }

      // Apply knockouts via GPR
      if (knockouts.length > 0 && (rxn.gpr || rxn.gene_reaction_rule)) {
        const isKO = knockouts.some(g =>
          (rxn.gpr || rxn.gene_reaction_rule).toLowerCase().includes(g.toLowerCase())
        );
        if (isKO) {
          lb = 0;
          ub = 0;
        }
      }

      // v_pos (positive flux component)
      problem.variables.push({
        name: `v_${rxnId}_pos`,
        lb: Math.max(0, lb),
        ub: Math.max(0, ub),
        type: 'continuous',
      });

      // v_neg (negative flux component)
      problem.variables.push({
        name: `v_${rxnId}_neg`,
        lb: Math.max(0, -ub),
        ub: Math.max(0, -lb),
        type: 'continuous',
      });

      // Objective coefficient
      if (rxn.objective_coefficient && rxn.objective_coefficient !== 0) {
        problem.objective.push({ name: `v_${rxnId}_pos`, coef: rxn.objective_coefficient });
        problem.objective.push({ name: `v_${rxnId}_neg`, coef: -rxn.objective_coefficient });
      }
    });

    // If no explicit objective, look for biomass
    if (problem.objective.length === 0) {
      const biomassRxn = reactions.find(([id]) =>
        id.toLowerCase().includes('biomass')
      );
      if (biomassRxn) {
        problem.objective.push({ name: `v_${biomassRxn[0]}_pos`, coef: 1 });
        problem.objective.push({ name: `v_${biomassRxn[0]}_neg`, coef: -1 });
      }
    }

    // Mass balance constraints: Sv = 0
    metabolites.forEach(([metId]) => {
      const terms = [];

      reactions.forEach(([rxnId, rxn]) => {
        const coef = rxn.metabolites?.[metId];
        if (coef) {
          terms.push({ name: `v_${rxnId}_pos`, coef });
          terms.push({ name: `v_${rxnId}_neg`, coef: -coef });
        }
      });

      if (terms.length > 0) {
        problem.constraints.push({
          name: `mb_${metId}`,
          lhs: terms,
          type: 'eq',
          rhs: 0,
        });
      }
    });

    return { problem, rxnVars };
  }

  /**
   * Find the objective reaction in a model
   */
  findObjectiveReaction(model) {
    for (const [rxnId, rxn] of Object.entries(model.reactions || {})) {
      if (rxn.objective_coefficient && rxn.objective_coefficient !== 0) {
        return rxnId;
      }
    }
    return Object.keys(model.reactions || {}).find(id =>
      id.toLowerCase().includes('biomass')
    );
  }

  /**
   * Evaluate GPR expression to get reaction expression level
   */
  evaluateGPR(gpr, expressionData) {
    if (!gpr || !gpr.trim()) return 1.0;

    const getExpr = (gene) => {
      const id = gene.trim();
      if (expressionData instanceof Map) {
        return expressionData.get(id) ?? 1.0;
      }
      return expressionData[id] ?? 1.0;
    };

    const evaluate = (expr) => {
      expr = expr.trim();

      // Handle parentheses
      while (expr.includes('(')) {
        const start = expr.lastIndexOf('(');
        const end = expr.indexOf(')', start);
        const inner = expr.substring(start + 1, end);
        const result = evaluate(inner);
        expr = expr.substring(0, start) + result + expr.substring(end + 1);
      }

      // Handle OR (max)
      if (expr.toLowerCase().includes(' or ')) {
        const parts = expr.split(/\s+or\s+/i);
        return Math.max(...parts.map(p => evaluate(p)));
      }

      // Handle AND (min)
      if (expr.toLowerCase().includes(' and ')) {
        const parts = expr.split(/\s+and\s+/i);
        return Math.min(...parts.map(p => evaluate(p)));
      }

      // Single gene or number
      const num = parseFloat(expr);
      return isNaN(num) ? getExpr(expr) : num;
    };

    try {
      return evaluate(gpr);
    } catch {
      return 1.0;
    }
  }

  /**
   * Format solver result to standard FBA output
   */
  formatFBAResult(result, rxnVars, model, method = 'fba') {
    if (result.status !== SolverStatus.OPTIMAL) {
      return {
        status: result.status,
        error: result.error,
        objectiveValue: 0,
        growthRate: 0,
        fluxes: {},
        method,
        solver: 'highs-wasm',
        phenotype: 'infeasible',
      };
    }

    // Reconstruct fluxes from split variables
    const fluxes = {};
    rxnVars.forEach(rxnId => {
      const pos = result.variables[`v_${rxnId}_pos`] || 0;
      const neg = result.variables[`v_${rxnId}_neg`] || 0;
      fluxes[rxnId] = pos - neg;
    });

    // Find growth rate
    let growthRate = 0;
    const objRxn = this.findObjectiveReaction(model);
    if (objRxn && fluxes[objRxn] !== undefined) {
      growthRate = fluxes[objRxn];
    }

    return {
      status: SolverStatus.OPTIMAL,
      objectiveValue: result.objectiveValue,
      growthRate,
      fluxes,
      method,
      solver: 'highs-wasm',
      solveTime: result.solveTime,
      phenotype: growthRate > 0.01 ? 'viable' : 'lethal',
      iterations: result.iterations,
      mipNodes: result.nodes,
    };
  }

  /**
   * Get solver information
   */
  getInfo() {
    return {
      name: 'HiGHS',
      version: 'WASM',
      capabilities: ['LP', 'MILP', 'QP'],
      initialized: this.initialized,
    };
  }
}

// Export singleton instance
export const highsSolver = new HiGHSSolverClass();

// Export class for testing
export { HiGHSSolverClass };

export default highsSolver;
