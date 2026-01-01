"""
MetabolicSuite Backend API

FastAPI-based backend for heavy computational tasks that benefit from
native solvers (Gurobi, CPLEX, HiGHS via COBRApy).

Endpoints:
- /solve/fba - Flux Balance Analysis
- /solve/pfba - Parsimonious FBA
- /solve/fva - Flux Variability Analysis
- /solve/moma - Minimization of Metabolic Adjustment
- /solve/gimme - Gene Inactivity Moderated by Metabolism and Expression
- /solve/imat - Integrative Metabolic Analysis Tool (true MILP)
- /solve/eflux - Expression-based Flux scaling
- /model/info - Get model statistics
- /model/validate - Validate model structure

References:
- Orth et al. (2010) "What is flux balance analysis?" Nat Biotechnol
- Shlomi et al. (2008) "Network-based prediction" Nat Biotechnol
- Becker & Palsson (2008) "Context-specific networks" PLoS Comput Biol
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# Pydantic Models for Request/Response
# ============================================================================

class ModelData(BaseModel):
    """COBRApy-compatible model JSON structure"""
    id: str = "model"
    name: Optional[str] = None
    reactions: List[Dict[str, Any]]
    metabolites: List[Dict[str, Any]]
    genes: Optional[List[Dict[str, Any]]] = []
    objective: Optional[str] = None

class FBARequest(BaseModel):
    """FBA request with model and constraints"""
    model: ModelData
    constraints: Optional[Dict[str, Dict[str, float]]] = None
    knockouts: Optional[List[str]] = []
    objective: Optional[str] = None

class FVARequest(BaseModel):
    """FVA request with options"""
    model: ModelData
    constraints: Optional[Dict[str, Dict[str, float]]] = None
    knockouts: Optional[List[str]] = []
    fraction_of_optimum: float = Field(default=0.9, ge=0.0, le=1.0)
    reactions: Optional[List[str]] = None  # None = all reactions

class OmicsRequest(BaseModel):
    """Omics integration request (GIMME, iMAT, E-Flux)"""
    model: ModelData
    expression: Dict[str, float]  # gene_id -> expression value
    method: str = Field(default="eflux", pattern="^(gimme|imat|eflux|made)$")
    threshold: Optional[float] = 0.25
    high_threshold: Optional[float] = 0.75
    low_threshold: Optional[float] = 0.25
    required_fraction: Optional[float] = 0.9

class MOMARequest(BaseModel):
    """MOMA request with reference flux"""
    model: ModelData
    constraints: Optional[Dict[str, Dict[str, float]]] = None
    knockouts: Optional[List[str]] = []
    reference_fluxes: Optional[Dict[str, float]] = None

class SolverResponse(BaseModel):
    """Standard response for solver results"""
    status: str
    objective_value: Optional[float] = None
    fluxes: Dict[str, float] = {}
    shadow_prices: Optional[Dict[str, float]] = None
    reduced_costs: Optional[Dict[str, float]] = None
    method: str = "fba"
    solver: str = "glpk"
    solve_time: Optional[float] = None
    error: Optional[str] = None

class FVAResponse(BaseModel):
    """FVA-specific response with min/max ranges"""
    status: str
    objective_value: Optional[float] = None
    ranges: Dict[str, Dict[str, float]] = {}  # rxn_id -> {min, max}
    solve_time: Optional[float] = None
    error: Optional[str] = None

class ModelInfoResponse(BaseModel):
    """Model information/statistics"""
    id: str
    name: Optional[str]
    num_reactions: int
    num_metabolites: int
    num_genes: int
    objective: Optional[str]
    compartments: List[str]
    subsystems: List[str]


# ============================================================================
# FastAPI Application
# ============================================================================

def create_app():
    """Create and configure the FastAPI application"""
    try:
        from fastapi import FastAPI, HTTPException
        from fastapi.middleware.cors import CORSMiddleware
    except ImportError:
        raise ImportError(
            "FastAPI is required for the API server. "
            "Install with: pip install metabolicsuite[server]"
        )

    app = FastAPI(
        title="MetabolicSuite Compute API",
        description="Backend API for constraint-based metabolic modeling",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Configure CORS for frontend access
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure appropriately for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ========================================================================
    # Helper Functions
    # ========================================================================

    def model_from_dict(data: ModelData):
        """Convert request model to COBRApy model"""
        try:
            import cobra
        except ImportError:
            raise HTTPException(
                status_code=500,
                detail="COBRApy is required. Install with: pip install cobra"
            )

        # Convert to JSON-compatible dict for cobra.io.from_json
        model_dict = {
            "id": data.id,
            "name": data.name or data.id,
            "reactions": data.reactions,
            "metabolites": data.metabolites,
            "genes": data.genes or [],
        }

        # Use cobra's JSON parser
        model_json = json.dumps(model_dict)
        model = cobra.io.from_json(model_json)

        # Set objective if specified
        if data.objective and data.objective in model.reactions:
            model.objective = data.objective

        return model

    def apply_constraints(model, constraints: Dict, knockouts: List[str]):
        """Apply constraints and knockouts to model"""
        if constraints:
            for rxn_id, bounds in constraints.items():
                if rxn_id in model.reactions:
                    rxn = model.reactions.get_by_id(rxn_id)
                    if "lb" in bounds:
                        rxn.lower_bound = bounds["lb"]
                    if "ub" in bounds:
                        rxn.upper_bound = bounds["ub"]

        if knockouts:
            for gene_id in knockouts:
                if gene_id in model.genes:
                    gene = model.genes.get_by_id(gene_id)
                    gene.knock_out()

        return model

    # ========================================================================
    # Health Check
    # ========================================================================

    @app.get("/health")
    async def health_check():
        """Health check endpoint"""
        import cobra
        return {
            "status": "healthy",
            "cobra_version": cobra.__version__,
            "solver": str(cobra.Configuration().solver),
        }

    # ========================================================================
    # Model Information
    # ========================================================================

    @app.post("/model/info", response_model=ModelInfoResponse)
    async def get_model_info(request: ModelData):
        """Get model statistics and information"""
        model = model_from_dict(request)

        compartments = list(set(m.compartment for m in model.metabolites))
        subsystems = list(set(r.subsystem for r in model.reactions if r.subsystem))

        return ModelInfoResponse(
            id=model.id,
            name=model.name,
            num_reactions=len(model.reactions),
            num_metabolites=len(model.metabolites),
            num_genes=len(model.genes),
            objective=str(model.objective.expression) if model.objective else None,
            compartments=compartments,
            subsystems=subsystems,
        )

    # ========================================================================
    # FBA Endpoint
    # ========================================================================

    @app.post("/solve/fba", response_model=SolverResponse)
    async def solve_fba(request: FBARequest):
        """
        Flux Balance Analysis

        Standard FBA maximizing objective (typically biomass).
        Uses native solvers for performance.
        """
        import time
        import cobra

        start_time = time.time()

        try:
            model = model_from_dict(request.model)
            model = apply_constraints(model, request.constraints or {}, request.knockouts or [])

            if request.objective and request.objective in model.reactions:
                model.objective = request.objective

            solution = model.optimize()

            solve_time = time.time() - start_time

            return SolverResponse(
                status=solution.status,
                objective_value=solution.objective_value,
                fluxes={rxn.id: solution.fluxes[rxn.id] for rxn in model.reactions},
                shadow_prices={met.id: solution.shadow_prices.get(met.id, 0) for met in model.metabolites},
                reduced_costs={rxn.id: solution.reduced_costs.get(rxn.id, 0) for rxn in model.reactions},
                method="fba",
                solver=str(cobra.Configuration().solver),
                solve_time=solve_time,
            )

        except Exception as e:
            logger.error(f"FBA solve error: {e}")
            return SolverResponse(
                status="error",
                error=str(e),
                method="fba",
            )

    # ========================================================================
    # pFBA Endpoint
    # ========================================================================

    @app.post("/solve/pfba", response_model=SolverResponse)
    async def solve_pfba(request: FBARequest):
        """
        Parsimonious FBA

        Minimizes total flux while maintaining optimal objective.
        Reference: Lewis et al. (2010) Mol Syst Biol
        """
        import time
        import cobra
        from cobra.flux_analysis import pfba

        start_time = time.time()

        try:
            model = model_from_dict(request.model)
            model = apply_constraints(model, request.constraints or {}, request.knockouts or [])

            if request.objective and request.objective in model.reactions:
                model.objective = request.objective

            solution = pfba(model)

            solve_time = time.time() - start_time

            return SolverResponse(
                status=solution.status,
                objective_value=solution.objective_value,
                fluxes={rxn.id: solution.fluxes[rxn.id] for rxn in model.reactions},
                method="pfba",
                solver=str(cobra.Configuration().solver),
                solve_time=solve_time,
            )

        except Exception as e:
            logger.error(f"pFBA solve error: {e}")
            return SolverResponse(
                status="error",
                error=str(e),
                method="pfba",
            )

    # ========================================================================
    # FVA Endpoint
    # ========================================================================

    @app.post("/solve/fva", response_model=FVAResponse)
    async def solve_fva(request: FVARequest):
        """
        Flux Variability Analysis

        Determines min/max flux ranges for reactions.
        Reference: Mahadevan & Schilling (2003) Metab Eng
        """
        import time
        import cobra
        from cobra.flux_analysis import flux_variability_analysis

        start_time = time.time()

        try:
            model = model_from_dict(request.model)
            model = apply_constraints(model, request.constraints or {}, request.knockouts or [])

            # Determine which reactions to analyze
            reaction_list = None
            if request.reactions:
                reaction_list = [model.reactions.get_by_id(r) for r in request.reactions if r in model.reactions]

            fva_result = flux_variability_analysis(
                model,
                reaction_list=reaction_list,
                fraction_of_optimum=request.fraction_of_optimum,
            )

            # Convert to response format
            ranges = {}
            for rxn_id in fva_result.index:
                ranges[rxn_id] = {
                    "min": float(fva_result.loc[rxn_id, "minimum"]),
                    "max": float(fva_result.loc[rxn_id, "maximum"]),
                }

            solve_time = time.time() - start_time

            # Get objective value
            solution = model.optimize()

            return FVAResponse(
                status="optimal",
                objective_value=solution.objective_value,
                ranges=ranges,
                solve_time=solve_time,
            )

        except Exception as e:
            logger.error(f"FVA solve error: {e}")
            return FVAResponse(
                status="error",
                error=str(e),
            )

    # ========================================================================
    # MOMA Endpoint
    # ========================================================================

    @app.post("/solve/moma", response_model=SolverResponse)
    async def solve_moma(request: MOMARequest):
        """
        Minimization of Metabolic Adjustment

        Finds flux distribution closest to wild-type reference.
        Reference: Segre et al. (2002) PNAS
        """
        import time
        import cobra
        from cobra.flux_analysis import moma

        start_time = time.time()

        try:
            model = model_from_dict(request.model)

            # Get wild-type solution if no reference provided
            if request.reference_fluxes:
                reference = request.reference_fluxes
            else:
                wt_solution = model.optimize()
                reference = {rxn.id: wt_solution.fluxes[rxn.id] for rxn in model.reactions}

            # Apply knockouts
            model = apply_constraints(model, request.constraints or {}, request.knockouts or [])

            solution = moma(model, solution=reference, linear=False)

            solve_time = time.time() - start_time

            return SolverResponse(
                status=solution.status,
                objective_value=solution.objective_value,
                fluxes={rxn.id: solution.fluxes[rxn.id] for rxn in model.reactions},
                method="moma",
                solver=str(cobra.Configuration().solver),
                solve_time=solve_time,
            )

        except Exception as e:
            logger.error(f"MOMA solve error: {e}")
            return SolverResponse(
                status="error",
                error=str(e),
                method="moma",
            )

    # ========================================================================
    # GIMME Endpoint
    # ========================================================================

    @app.post("/solve/gimme", response_model=SolverResponse)
    async def solve_gimme(request: OmicsRequest):
        """
        Gene Inactivity Moderated by Metabolism and Expression

        Minimizes use of low-expression reactions while maintaining objective.
        Reference: Becker & Palsson (2008) PLoS Comput Biol
        """
        import time
        import cobra

        start_time = time.time()

        try:
            model = model_from_dict(request.model)

            # Map gene expression to reactions using GPR
            reaction_expression = {}
            for rxn in model.reactions:
                if rxn.gene_reaction_rule:
                    expr = evaluate_gpr_expression(rxn.gene_reaction_rule, request.expression)
                    reaction_expression[rxn.id] = expr
                else:
                    reaction_expression[rxn.id] = 1.0  # Constitutive

            # GIMME objective: min sum(|v_i| * (threshold - expr_i)) for low-expression
            # Subject to: v_biomass >= fraction * v_biomass_max

            # First, get optimal objective value
            solution = model.optimize()
            if solution.status != "optimal":
                raise ValueError(f"Model infeasible: {solution.status}")

            required_obj = request.required_fraction * solution.objective_value

            # Add objective constraint
            obj_rxn = list(model.objective.variables.keys())[0]
            obj_rxn.lower_bound = required_obj

            # Build GIMME objective
            from cobra import Reaction
            import optlang

            # Create auxiliary variables and constraints for GIMME
            gimme_objective = 0
            for rxn in model.reactions:
                expr_val = reaction_expression.get(rxn.id, 1.0)
                if expr_val < request.threshold:
                    # Penalize flux through low-expression reactions
                    penalty = request.threshold - expr_val
                    gimme_objective += penalty * (rxn.flux_expression.forward_variable + rxn.flux_expression.reverse_variable)

            model.objective = gimme_objective
            model.objective_direction = "min"

            solution = model.optimize()

            solve_time = time.time() - start_time

            return SolverResponse(
                status=solution.status,
                objective_value=solution.objective_value,
                fluxes={rxn.id: solution.fluxes[rxn.id] for rxn in model.reactions},
                method="gimme",
                solver=str(cobra.Configuration().solver),
                solve_time=solve_time,
            )

        except Exception as e:
            logger.error(f"GIMME solve error: {e}")
            return SolverResponse(
                status="error",
                error=str(e),
                method="gimme",
            )

    # ========================================================================
    # iMAT Endpoint (True MILP)
    # ========================================================================

    @app.post("/solve/imat", response_model=SolverResponse)
    async def solve_imat(request: OmicsRequest):
        """
        Integrative Metabolic Analysis Tool

        Uses MILP to maximize consistency with expression data.
        Requires a solver with MILP support (Gurobi, CPLEX, or HiGHS).

        Reference: Shlomi et al. (2008) Nat Biotechnol
        """
        import time
        import cobra

        start_time = time.time()

        try:
            model = model_from_dict(request.model)

            # Map gene expression to reactions
            high_expr_rxns = []
            low_expr_rxns = []

            for rxn in model.reactions:
                if rxn.gene_reaction_rule:
                    expr = evaluate_gpr_expression(rxn.gene_reaction_rule, request.expression)
                    if expr >= request.high_threshold:
                        high_expr_rxns.append(rxn.id)
                    elif expr <= request.low_threshold:
                        low_expr_rxns.append(rxn.id)

            # iMAT MILP formulation:
            # Binary variables y_h, y_l for high/low expression reactions
            # Maximize: sum(y_h) + sum(y_l)
            # Subject to:
            #   v_i >= epsilon * y_h_i (high expression -> active)
            #   v_i <= M * (1 - y_l_i) (low expression -> inactive)

            epsilon = 1e-3
            M = 1000

            # Add binary variables
            for rxn_id in high_expr_rxns:
                rxn = model.reactions.get_by_id(rxn_id)
                var_name = f"y_h_{rxn_id}"
                y_h = model.problem.Variable(var_name, type="binary")
                model.solver.add(y_h)

                # v >= epsilon * y_h
                constraint = model.problem.Constraint(
                    rxn.forward_variable + rxn.reverse_variable - epsilon * y_h,
                    lb=0,
                    name=f"imat_high_{rxn_id}"
                )
                model.solver.add(constraint)

            for rxn_id in low_expr_rxns:
                rxn = model.reactions.get_by_id(rxn_id)
                var_name = f"y_l_{rxn_id}"
                y_l = model.problem.Variable(var_name, type="binary")
                model.solver.add(y_l)

                # v <= M * (1 - y_l) => v + M*y_l <= M
                constraint = model.problem.Constraint(
                    rxn.forward_variable + rxn.reverse_variable + M * y_l,
                    ub=M,
                    name=f"imat_low_{rxn_id}"
                )
                model.solver.add(constraint)

            # Set objective to maximize binary variables
            obj_terms = []
            for rxn_id in high_expr_rxns:
                obj_terms.append(model.solver.variables[f"y_h_{rxn_id}"])
            for rxn_id in low_expr_rxns:
                obj_terms.append(model.solver.variables[f"y_l_{rxn_id}"])

            if obj_terms:
                model.objective = sum(obj_terms)
                model.objective_direction = "max"

            solution = model.optimize()

            solve_time = time.time() - start_time

            return SolverResponse(
                status=solution.status,
                objective_value=solution.objective_value,
                fluxes={rxn.id: solution.fluxes.get(rxn.id, 0) for rxn in model.reactions},
                method="imat",
                solver=str(cobra.Configuration().solver),
                solve_time=solve_time,
            )

        except Exception as e:
            logger.error(f"iMAT solve error: {e}")
            return SolverResponse(
                status="error",
                error=str(e),
                method="imat",
            )

    # ========================================================================
    # E-Flux Endpoint
    # ========================================================================

    @app.post("/solve/eflux", response_model=SolverResponse)
    async def solve_eflux(request: OmicsRequest):
        """
        Expression-based Flux scaling

        Scales reaction bounds proportionally to expression.
        Reference: Colijn et al. (2009) Mol Syst Biol
        """
        import time
        import cobra

        start_time = time.time()

        try:
            model = model_from_dict(request.model)

            # Map expression to reactions and scale bounds
            for rxn in model.reactions:
                if rxn.gene_reaction_rule:
                    expr = evaluate_gpr_expression(rxn.gene_reaction_rule, request.expression)
                    # Scale bounds proportionally (0-1 normalized expression)
                    if expr < 1.0:
                        if rxn.upper_bound > 0:
                            rxn.upper_bound *= expr
                        if rxn.lower_bound < 0:
                            rxn.lower_bound *= expr

            solution = model.optimize()

            solve_time = time.time() - start_time

            return SolverResponse(
                status=solution.status,
                objective_value=solution.objective_value,
                fluxes={rxn.id: solution.fluxes[rxn.id] for rxn in model.reactions},
                method="eflux",
                solver=str(cobra.Configuration().solver),
                solve_time=solve_time,
            )

        except Exception as e:
            logger.error(f"E-Flux solve error: {e}")
            return SolverResponse(
                status="error",
                error=str(e),
                method="eflux",
            )

    # ========================================================================
    # Benchmark Endpoint
    # ========================================================================

    class BenchmarkRequest(BaseModel):
        """Request for benchmark comparison"""
        model: ModelData
        method: str = Field(default="fba", pattern="^(fba|pfba)$")
        solver: str = Field(default="glpk", pattern="^(glpk|cplex|gurobi)$")

    class BenchmarkResponse(BaseModel):
        """Benchmark result for comparison with HiGHS"""
        status: str
        objective_value: Optional[float] = None
        fluxes: Dict[str, float] = {}
        solve_time_ms: float = 0
        solver: str = "cobrapy-glpk"
        error: Optional[str] = None

    @app.post("/benchmark/solve", response_model=BenchmarkResponse)
    async def benchmark_solve(request: BenchmarkRequest):
        """
        Run solver for benchmark comparison with HiGHS WASM.

        Used by the frontend BenchmarkRunner to validate numerical accuracy.
        """
        import time
        import cobra

        start_time = time.perf_counter()

        try:
            model = model_from_dict(request.model)
            model.solver = request.solver

            if request.method == "fba":
                solution = model.optimize()
            elif request.method == "pfba":
                solution = cobra.flux_analysis.pfba(model)
            else:
                raise ValueError(f"Unknown method: {request.method}")

            solve_time_ms = (time.perf_counter() - start_time) * 1000

            if solution.status == "optimal":
                return BenchmarkResponse(
                    status="optimal",
                    objective_value=solution.objective_value,
                    fluxes={rxn.id: solution.fluxes[rxn.id] for rxn in model.reactions},
                    solve_time_ms=solve_time_ms,
                    solver=f"cobrapy-{request.solver}",
                )
            else:
                return BenchmarkResponse(
                    status=solution.status,
                    solve_time_ms=solve_time_ms,
                    solver=f"cobrapy-{request.solver}",
                )

        except Exception as e:
            solve_time_ms = (time.perf_counter() - start_time) * 1000
            logger.error(f"Benchmark solve error: {e}")
            return BenchmarkResponse(
                status="error",
                error=str(e),
                solve_time_ms=solve_time_ms,
                solver=f"cobrapy-{request.solver}",
            )

    @app.get("/benchmark/bigg-catalog")
    async def get_bigg_catalog():
        """Fetch BiGG model catalog for benchmarking"""
        from .benchmark import BiGGModelCatalog
        try:
            catalog = BiGGModelCatalog()
            models = catalog.fetch_catalog()
            return {"models": [
                {
                    "bigg_id": m.bigg_id,
                    "organism": m.organism,
                    "reaction_count": m.reaction_count,
                    "metabolite_count": m.metabolite_count,
                    "gene_count": m.gene_count,
                }
                for m in models
            ]}
        except Exception as e:
            logger.error(f"Failed to fetch BiGG catalog: {e}")
            return {"error": str(e)}

    @app.post("/benchmark/run-full")
    async def run_full_benchmark(num_models: int = 20, methods: List[str] = ["fba", "pfba"]):
        """
        Run full benchmark suite (COBRApy side only).

        Returns results that can be compared with HiGHS WASM results.
        """
        from .benchmark import run_full_benchmark
        try:
            result = run_full_benchmark(num_models=num_models, methods=methods)
            return result
        except Exception as e:
            logger.error(f"Benchmark failed: {e}")
            return {"error": str(e)}

    return app


# ============================================================================
# GPR Expression Evaluation
# ============================================================================

def evaluate_gpr_expression(gpr_rule: str, expression: Dict[str, float]) -> float:
    """
    Evaluate GPR rule to get reaction expression level.

    AND -> MIN (enzyme complex limited by lowest subunit)
    OR -> MAX (isozymes, highest expression dominates)

    Args:
        gpr_rule: Boolean expression (e.g., "(geneA and geneB) or geneC")
        expression: Dictionary of gene_id -> expression value (0-1 normalized)

    Returns:
        Reaction expression level (0-1)
    """
    if not gpr_rule or not gpr_rule.strip():
        return 1.0  # Constitutive

    def get_gene_expr(gene_id: str) -> float:
        return expression.get(gene_id.strip(), 1.0)

    def evaluate(expr: str) -> float:
        expr = expr.strip()

        # Handle parentheses
        while "(" in expr:
            # Find innermost parentheses
            start = expr.rfind("(")
            end = expr.find(")", start)
            inner = expr[start + 1:end]
            result = evaluate(inner)
            expr = expr[:start] + str(result) + expr[end + 1:]

        # Handle OR (max)
        if " or " in expr.lower():
            parts = expr.lower().split(" or ")
            values = [evaluate(p) for p in parts]
            return max(values)

        # Handle AND (min)
        if " and " in expr.lower():
            parts = expr.lower().split(" and ")
            values = [evaluate(p) for p in parts]
            return min(values)

        # Single gene or numeric value
        try:
            return float(expr)
        except ValueError:
            return get_gene_expr(expr)

    try:
        return evaluate(gpr_rule)
    except Exception:
        return 1.0  # Default to constitutive on parse error


# ============================================================================
# Server Runner
# ============================================================================

def run_server(host: str = "0.0.0.0", port: int = 8000, reload: bool = False):
    """Run the FastAPI server"""
    try:
        import uvicorn
    except ImportError:
        raise ImportError(
            "Uvicorn is required to run the server. "
            "Install with: pip install metabolicsuite[server]"
        )

    app = create_app()
    uvicorn.run(app, host=host, port=port, reload=reload)


# Allow running directly
if __name__ == "__main__":
    run_server()
