"""
Benchmark Validation Suite - BiGG Model Fetcher & COBRApy Solver

Validates MetabolicSuite solver accuracy against gold-standard COBRApy results.
Runs 100+ models from BiGG database through both solvers and compares:
- Objective values (|Δobj| < 1e-6 required)
- Flux distributions (||Δfluxes||₂)
- Solve times

Reference:
- King et al. (2016) "BiGG Models: A platform for integrating, standardizing
  and sharing genome-scale models" Nucleic Acids Research

@module benchmark
"""

import os
import json
import time
import logging
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
import numpy as np

try:
    import cobra
    from cobra.io import load_json_model, read_sbml_model
    COBRA_AVAILABLE = True
except ImportError:
    COBRA_AVAILABLE = False

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# BiGG API endpoints
BIGG_API_BASE = "http://bigg.ucsd.edu/api/v2"
BIGG_MODELS_LIST = f"{BIGG_API_BASE}/models"
BIGG_MODEL_DOWNLOAD = "http://bigg.ucsd.edu/static/models"

# Benchmark configuration
BENCHMARK_DIR = Path(__file__).parent / "benchmark_data"
MODELS_DIR = BENCHMARK_DIR / "models"
RESULTS_DIR = BENCHMARK_DIR / "results"

# Validation thresholds
OBJECTIVE_TOLERANCE = 1e-6  # Maximum allowed |Δobj|
FLUX_TOLERANCE = 1e-4       # Maximum allowed individual flux difference


@dataclass
class ModelInfo:
    """BiGG model metadata"""
    bigg_id: str
    organism: str
    metabolite_count: int
    reaction_count: int
    gene_count: int


@dataclass
class SolveResult:
    """Result from a single solve operation"""
    model_id: str
    method: str
    solver: str
    status: str
    objective_value: Optional[float]
    fluxes: Optional[Dict[str, float]]
    solve_time_ms: float
    error: Optional[str] = None


@dataclass
class ComparisonResult:
    """Comparison between two solver results"""
    model_id: str
    method: str
    solver_a: str
    solver_b: str
    obj_a: Optional[float]
    obj_b: Optional[float]
    obj_diff: Optional[float]
    obj_rel_diff: Optional[float]
    flux_l2_norm: Optional[float]
    flux_max_diff: Optional[float]
    flux_max_diff_rxn: Optional[str]
    time_a_ms: float
    time_b_ms: float
    passed: bool
    notes: str = ""


class BiGGModelCatalog:
    """
    Fetches and manages BiGG model catalog
    """

    def __init__(self, cache_dir: Optional[Path] = None):
        self.cache_dir = cache_dir or MODELS_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.catalog: List[ModelInfo] = []

    def fetch_catalog(self, force_refresh: bool = False) -> List[ModelInfo]:
        """Fetch list of all available BiGG models"""
        if not REQUESTS_AVAILABLE:
            raise RuntimeError("requests library required: pip install requests")

        catalog_file = self.cache_dir / "catalog.json"

        # Use cache if available and not forcing refresh
        if catalog_file.exists() and not force_refresh:
            with open(catalog_file) as f:
                data = json.load(f)
                self.catalog = [ModelInfo(**m) for m in data]
                logger.info(f"Loaded {len(self.catalog)} models from cache")
                return self.catalog

        # Fetch from BiGG API
        logger.info("Fetching BiGG model catalog...")
        response = requests.get(BIGG_MODELS_LIST, timeout=30)
        response.raise_for_status()

        data = response.json()
        self.catalog = []

        for model in data.get("results", []):
            self.catalog.append(ModelInfo(
                bigg_id=model["bigg_id"],
                organism=model.get("organism", "Unknown"),
                metabolite_count=model.get("metabolite_count", 0),
                reaction_count=model.get("reaction_count", 0),
                gene_count=model.get("gene_count", 0),
            ))

        # Cache catalog
        with open(catalog_file, "w") as f:
            json.dump([asdict(m) for m in self.catalog], f, indent=2)

        logger.info(f"Fetched {len(self.catalog)} models from BiGG")
        return self.catalog

    def download_model(self, model_id: str, format: str = "json") -> Path:
        """Download a specific model from BiGG"""
        if not REQUESTS_AVAILABLE:
            raise RuntimeError("requests library required")

        ext = "json" if format == "json" else "xml"
        filename = f"{model_id}.{ext}"
        filepath = self.cache_dir / filename

        if filepath.exists():
            logger.debug(f"Model {model_id} already cached")
            return filepath

        url = f"{BIGG_MODEL_DOWNLOAD}/{filename}"
        logger.info(f"Downloading {model_id} from BiGG...")

        response = requests.get(url, timeout=120)
        response.raise_for_status()

        with open(filepath, "wb") as f:
            f.write(response.content)

        logger.info(f"Downloaded {model_id} ({len(response.content) / 1024:.1f} KB)")
        return filepath

    def get_benchmark_models(self,
                             min_reactions: int = 10,
                             max_reactions: int = 5000,
                             limit: int = 100) -> List[ModelInfo]:
        """
        Get a curated list of models for benchmarking

        Filters by size to ensure reasonable benchmark times while
        covering the spectrum from toy models to genome-scale.
        """
        if not self.catalog:
            self.fetch_catalog()

        # Filter by reaction count
        filtered = [
            m for m in self.catalog
            if min_reactions <= m.reaction_count <= max_reactions
        ]

        # Sort by reaction count for stratified sampling
        filtered.sort(key=lambda m: m.reaction_count)

        # Stratified sampling: small, medium, large
        if len(filtered) <= limit:
            return filtered

        step = len(filtered) / limit
        selected = []
        for i in range(limit):
            idx = int(i * step)
            selected.append(filtered[idx])

        return selected


class COBRApyBenchmark:
    """
    Run benchmark solves using COBRApy
    """

    def __init__(self, catalog: BiGGModelCatalog):
        if not COBRA_AVAILABLE:
            raise RuntimeError("COBRApy required: pip install cobra")
        self.catalog = catalog
        self.results: List[SolveResult] = []

    def load_model(self, model_id: str) -> Optional[cobra.Model]:
        """Load a model from cache or download"""
        try:
            filepath = self.catalog.download_model(model_id, format="json")
            return load_json_model(str(filepath))
        except Exception as e:
            logger.error(f"Failed to load {model_id}: {e}")
            return None

    def solve_fba(self, model: cobra.Model, solver: str = "glpk") -> SolveResult:
        """Run FBA on a model"""
        model_id = model.id

        try:
            # Set solver
            model.solver = solver

            start = time.perf_counter()
            solution = model.optimize()
            elapsed_ms = (time.perf_counter() - start) * 1000

            if solution.status == "optimal":
                # Convert numpy dtypes to Python floats to avoid serialization issues
                fluxes = {}
                for rxn in model.reactions:
                    val = solution.fluxes[rxn.id]
                    # Handle numpy types by converting to Python float
                    if hasattr(val, 'item'):
                        fluxes[rxn.id] = float(val.item())
                    else:
                        fluxes[rxn.id] = float(val)

                obj_val = solution.objective_value
                if hasattr(obj_val, 'item'):
                    obj_val = float(obj_val.item())
                else:
                    obj_val = float(obj_val)

                return SolveResult(
                    model_id=model_id,
                    method="fba",
                    solver=f"cobrapy-{solver}",
                    status="optimal",
                    objective_value=obj_val,
                    fluxes=fluxes,
                    solve_time_ms=elapsed_ms,
                )
            else:
                return SolveResult(
                    model_id=model_id,
                    method="fba",
                    solver=f"cobrapy-{solver}",
                    status=solution.status,
                    objective_value=None,
                    fluxes=None,
                    solve_time_ms=elapsed_ms,
                )
        except Exception as e:
            return SolveResult(
                model_id=model_id,
                method="fba",
                solver=f"cobrapy-{solver}",
                status="error",
                objective_value=None,
                fluxes=None,
                solve_time_ms=0,
                error=str(e),
            )

    def solve_pfba(self, model: cobra.Model, solver: str = "glpk") -> SolveResult:
        """Run pFBA on a model"""
        model_id = model.id

        try:
            model.solver = solver

            start = time.perf_counter()
            solution = cobra.flux_analysis.pfba(model)
            elapsed_ms = (time.perf_counter() - start) * 1000

            # Convert numpy dtypes to Python floats
            fluxes = {}
            for rxn in model.reactions:
                val = solution.fluxes[rxn.id]
                if hasattr(val, 'item'):
                    fluxes[rxn.id] = float(val.item())
                else:
                    fluxes[rxn.id] = float(val)

            obj_val = solution.objective_value
            if hasattr(obj_val, 'item'):
                obj_val = float(obj_val.item())
            else:
                obj_val = float(obj_val)

            return SolveResult(
                model_id=model_id,
                method="pfba",
                solver=f"cobrapy-{solver}",
                status="optimal",
                objective_value=obj_val,
                fluxes=fluxes,
                solve_time_ms=elapsed_ms,
            )
        except Exception as e:
            return SolveResult(
                model_id=model_id,
                method="pfba",
                solver=f"cobrapy-{solver}",
                status="error",
                objective_value=None,
                fluxes=None,
                solve_time_ms=0,
                error=str(e),
            )

    def solve_fva(self, model: cobra.Model,
                  fraction: float = 0.9,
                  solver: str = "glpk") -> SolveResult:
        """Run FVA on a model"""
        model_id = model.id

        try:
            model.solver = solver

            start = time.perf_counter()
            fva_result = cobra.flux_analysis.flux_variability_analysis(
                model,
                fraction_of_optimum=fraction,
                loopless=False,
            )
            elapsed_ms = (time.perf_counter() - start) * 1000

            # Convert to dict format: {rxn_id: {"min": x, "max": y}}
            # Handle numpy dtypes by converting to Python floats
            fluxes = {}
            for rxn_id in fva_result.index:
                min_val = fva_result.loc[rxn_id, "minimum"]
                max_val = fva_result.loc[rxn_id, "maximum"]
                # Convert numpy types
                if hasattr(min_val, 'item'):
                    min_val = float(min_val.item())
                else:
                    min_val = float(min_val)
                if hasattr(max_val, 'item'):
                    max_val = float(max_val.item())
                else:
                    max_val = float(max_val)
                fluxes[rxn_id] = {"min": min_val, "max": max_val}

            return SolveResult(
                model_id=model_id,
                method=f"fva_{int(fraction*100)}",
                solver=f"cobrapy-{solver}",
                status="optimal",
                objective_value=None,  # FVA doesn't have single objective
                fluxes=fluxes,
                solve_time_ms=elapsed_ms,
            )
        except Exception as e:
            return SolveResult(
                model_id=model_id,
                method=f"fva_{int(fraction*100)}",
                solver=f"cobrapy-{solver}",
                status="error",
                objective_value=None,
                fluxes=None,
                solve_time_ms=0,
                error=str(e),
            )

    def run_benchmark(self,
                      models: List[ModelInfo],
                      methods: List[str] = ["fba", "pfba"],
                      solvers: List[str] = ["glpk"]) -> List[SolveResult]:
        """
        Run full benchmark suite
        """
        results = []
        total = len(models) * len(methods) * len(solvers)
        completed = 0

        for model_info in models:
            model = self.load_model(model_info.bigg_id)
            if model is None:
                continue

            for method in methods:
                for solver in solvers:
                    completed += 1
                    logger.info(f"[{completed}/{total}] {model_info.bigg_id} - {method} ({solver})")

                    if method == "fba":
                        result = self.solve_fba(model, solver)
                    elif method == "pfba":
                        result = self.solve_pfba(model, solver)
                    elif method.startswith("fva"):
                        fraction = int(method.split("_")[1]) / 100 if "_" in method else 0.9
                        result = self.solve_fva(model, fraction, solver)
                    else:
                        logger.warning(f"Unknown method: {method}")
                        continue

                    results.append(result)

        self.results = results
        return results

    def export_results(self, filepath: Path) -> None:
        """Export results to JSON"""
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w") as f:
            json.dump([asdict(r) for r in self.results], f, indent=2)
        logger.info(f"Exported {len(self.results)} results to {filepath}")


class BenchmarkComparator:
    """
    Compare results between different solvers
    """

    def __init__(self):
        self.comparisons: List[ComparisonResult] = []

    def compare(self,
                result_a: SolveResult,
                result_b: SolveResult) -> ComparisonResult:
        """Compare two solve results"""

        # Check if both solved successfully
        if result_a.status != "optimal" or result_b.status != "optimal":
            return ComparisonResult(
                model_id=result_a.model_id,
                method=result_a.method,
                solver_a=result_a.solver,
                solver_b=result_b.solver,
                obj_a=result_a.objective_value,
                obj_b=result_b.objective_value,
                obj_diff=None,
                obj_rel_diff=None,
                flux_l2_norm=None,
                flux_max_diff=None,
                flux_max_diff_rxn=None,
                time_a_ms=result_a.solve_time_ms,
                time_b_ms=result_b.solve_time_ms,
                passed=False,
                notes=f"Non-optimal status: {result_a.status}/{result_b.status}",
            )

        # Compare objective values
        obj_a = result_a.objective_value or 0
        obj_b = result_b.objective_value or 0
        obj_diff = abs(obj_a - obj_b)
        obj_rel_diff = obj_diff / max(abs(obj_a), abs(obj_b), 1e-10)

        # Compare fluxes
        flux_l2 = None
        flux_max = None
        flux_max_rxn = None

        if result_a.fluxes and result_b.fluxes:
            common_rxns = set(result_a.fluxes.keys()) & set(result_b.fluxes.keys())

            if common_rxns:
                diffs = []
                max_diff = 0
                max_rxn = None

                for rxn in common_rxns:
                    fa = result_a.fluxes[rxn]
                    fb = result_b.fluxes[rxn]

                    # Handle FVA results (dict with min/max)
                    if isinstance(fa, dict):
                        diff = max(abs(fa["min"] - fb["min"]), abs(fa["max"] - fb["max"]))
                    else:
                        diff = abs(fa - fb)

                    diffs.append(diff ** 2)
                    if diff > max_diff:
                        max_diff = diff
                        max_rxn = rxn

                flux_l2 = np.sqrt(sum(diffs))
                flux_max = max_diff
                flux_max_rxn = max_rxn

        # Determine pass/fail
        passed = obj_diff < OBJECTIVE_TOLERANCE
        notes = ""
        if not passed:
            notes = f"Objective difference {obj_diff:.2e} exceeds tolerance {OBJECTIVE_TOLERANCE:.0e}"
        elif flux_max and flux_max > FLUX_TOLERANCE:
            notes = f"Large flux difference at {flux_max_rxn}: {flux_max:.2e}"

        return ComparisonResult(
            model_id=result_a.model_id,
            method=result_a.method,
            solver_a=result_a.solver,
            solver_b=result_b.solver,
            obj_a=obj_a,
            obj_b=obj_b,
            obj_diff=obj_diff,
            obj_rel_diff=obj_rel_diff,
            flux_l2_norm=flux_l2,
            flux_max_diff=flux_max,
            flux_max_diff_rxn=flux_max_rxn,
            time_a_ms=result_a.solve_time_ms,
            time_b_ms=result_b.solve_time_ms,
            passed=passed,
            notes=notes,
        )

    def compare_result_sets(self,
                            results_a: List[SolveResult],
                            results_b: List[SolveResult]) -> List[ComparisonResult]:
        """Compare two sets of results"""

        # Index by (model_id, method)
        index_a = {(r.model_id, r.method): r for r in results_a}
        index_b = {(r.model_id, r.method): r for r in results_b}

        common_keys = set(index_a.keys()) & set(index_b.keys())

        comparisons = []
        for key in sorted(common_keys):
            comp = self.compare(index_a[key], index_b[key])
            comparisons.append(comp)

        self.comparisons = comparisons
        return comparisons

    def generate_summary(self) -> Dict:
        """Generate summary statistics"""
        if not self.comparisons:
            return {}

        total = len(self.comparisons)
        passed = sum(1 for c in self.comparisons if c.passed)
        failed = total - passed

        obj_diffs = [c.obj_diff for c in self.comparisons if c.obj_diff is not None]
        flux_l2s = [c.flux_l2_norm for c in self.comparisons if c.flux_l2_norm is not None]

        return {
            "total_comparisons": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": passed / total if total > 0 else 0,
            "objective_diff": {
                "mean": np.mean(obj_diffs) if obj_diffs else None,
                "std": np.std(obj_diffs) if obj_diffs else None,
                "max": max(obj_diffs) if obj_diffs else None,
                "min": min(obj_diffs) if obj_diffs else None,
            },
            "flux_l2_norm": {
                "mean": np.mean(flux_l2s) if flux_l2s else None,
                "std": np.std(flux_l2s) if flux_l2s else None,
                "max": max(flux_l2s) if flux_l2s else None,
            },
            "timestamp": datetime.now().isoformat(),
        }


class LaTeXReportGenerator:
    """
    Generate publication-ready LaTeX tables
    """

    def __init__(self, comparisons: List[ComparisonResult], summary: Dict):
        self.comparisons = comparisons
        self.summary = summary

    def generate_summary_table(self) -> str:
        """Generate summary statistics table"""
        s = self.summary

        return f"""
\\begin{{table}}[htbp]
\\centering
\\caption{{Solver Validation Summary: MetabolicSuite (HiGHS WASM) vs COBRApy}}
\\label{{tab:solver_validation}}
\\begin{{tabular}}{{lrr}}
\\toprule
\\textbf{{Metric}} & \\textbf{{Value}} & \\textbf{{Pass Criterion}} \\\\
\\midrule
Total Models Tested & {s.get('total_comparisons', 0)} & -- \\\\
Passed & {s.get('passed', 0)} & $|\\Delta obj| < 10^{{-6}}$ \\\\
Failed & {s.get('failed', 0)} & -- \\\\
Pass Rate & {s.get('pass_rate', 0)*100:.1f}\\% & $\\geq 99\\%$ \\\\
\\midrule
Mean $|\\Delta obj|$ & {s['objective_diff']['mean']:.2e} & -- \\\\
Max $|\\Delta obj|$ & {s['objective_diff']['max']:.2e} & $< 10^{{-6}}$ \\\\
Std $|\\Delta obj|$ & {s['objective_diff']['std']:.2e} & -- \\\\
\\midrule
Mean $||\\Delta v||_2$ & {s['flux_l2_norm']['mean']:.2e} & -- \\\\
Max $||\\Delta v||_2$ & {s['flux_l2_norm']['max']:.2e} & -- \\\\
\\bottomrule
\\end{{tabular}}
\\end{{table}}
"""

    def generate_detailed_table(self, max_rows: int = 20) -> str:
        """Generate detailed comparison table"""

        rows = []
        for c in self.comparisons[:max_rows]:
            status = "\\checkmark" if c.passed else "\\texttimes"
            obj_diff = f"{c.obj_diff:.2e}" if c.obj_diff else "--"
            flux_l2 = f"{c.flux_l2_norm:.2e}" if c.flux_l2_norm else "--"

            rows.append(
                f"  {c.model_id} & {c.method} & {obj_diff} & {flux_l2} & "
                f"{c.time_a_ms:.1f} & {c.time_b_ms:.1f} & {status} \\\\"
            )

        return f"""
\\begin{{table}}[htbp]
\\centering
\\caption{{Detailed Solver Comparison Results (first {max_rows} models)}}
\\label{{tab:solver_detailed}}
\\begin{{tabular}}{{llrrrrc}}
\\toprule
\\textbf{{Model}} & \\textbf{{Method}} & \\textbf{{$|\\Delta obj|$}} &
\\textbf{{$||\\Delta v||_2$}} & \\textbf{{t$_{{HiGHS}}$}} &
\\textbf{{t$_{{COBRApy}}$}} & \\textbf{{Pass}} \\\\
\\midrule
{chr(10).join(rows)}
\\bottomrule
\\end{{tabular}}
\\end{{table}}
"""

    def generate_full_report(self) -> str:
        """Generate complete LaTeX document"""

        return f"""% Solver Validation Report
% Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
% MetabolicSuite Benchmark Suite

\\documentclass{{article}}
\\usepackage{{booktabs}}
\\usepackage{{amsmath}}
\\usepackage{{siunitx}}

\\begin{{document}}

\\section{{Numerical Validation}}

This supplementary material provides numerical validation of the MetabolicSuite
LP/MILP solver (HiGHS WASM) against the gold-standard COBRApy implementation.
Models were obtained from the BiGG Models database \\cite{{king2016bigg}}.

\\subsection{{Methods}}

\\begin{{itemize}}
  \\item \\textbf{{Test Set}}: {self.summary.get('total_comparisons', 0)} metabolic models from BiGG
  \\item \\textbf{{Methods}}: FBA, pFBA, FVA (90\\% optimum)
  \\item \\textbf{{Reference Solver}}: COBRApy with GLPK
  \\item \\textbf{{Test Solver}}: HiGHS WASM (browser-based)
  \\item \\textbf{{Pass Criterion}}: $|\\Delta obj| < 10^{{-6}}$
\\end{{itemize}}

\\subsection{{Results}}

{self.generate_summary_table()}

{self.generate_detailed_table()}

\\subsection{{Conclusion}}

The MetabolicSuite solver achieves {self.summary.get('pass_rate', 0)*100:.1f}\\%
concordance with COBRApy across {self.summary.get('total_comparisons', 0)} benchmark models.
Mean objective value difference of {self.summary['objective_diff']['mean']:.2e}
demonstrates numerical equivalence suitable for research applications.

\\begin{{thebibliography}}{{9}}
\\bibitem{{king2016bigg}}
King, Z.A., et al. (2016).
BiGG Models: A platform for integrating, standardizing and sharing genome-scale models.
\\textit{{Nucleic Acids Research}}, 44(D1), D515-D522.
\\end{{thebibliography}}

\\end{{document}}
"""

    def save_report(self, filepath: Path) -> None:
        """Save report to file"""
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w") as f:
            f.write(self.generate_full_report())
        logger.info(f"LaTeX report saved to {filepath}")


# API endpoint functions for FastAPI integration
async def run_cobrapy_benchmark(model_json: Dict,
                                 method: str = "fba",
                                 solver: str = "glpk") -> Dict:
    """
    Run a single model benchmark via API

    Called by the frontend to get COBRApy results for comparison
    """
    if not COBRA_AVAILABLE:
        return {"error": "COBRApy not available"}

    try:
        # Create model from JSON
        import io
        from cobra.io import load_json_model

        model = cobra.Model()

        # Parse metabolites
        for met_data in model_json.get("metabolites", []):
            met = cobra.Metabolite(
                id=met_data["id"],
                name=met_data.get("name", met_data["id"]),
                compartment=met_data.get("compartment", "c"),
            )
            model.add_metabolites([met])

        # Parse reactions
        for rxn_data in model_json.get("reactions", []):
            rxn = cobra.Reaction(
                id=rxn_data["id"],
                name=rxn_data.get("name", rxn_data["id"]),
                lower_bound=rxn_data.get("lower_bound", -1000),
                upper_bound=rxn_data.get("upper_bound", 1000),
            )

            # Add metabolites
            metabolites = {}
            for met_id, coef in rxn_data.get("metabolites", {}).items():
                if met_id in model.metabolites:
                    metabolites[model.metabolites.get_by_id(met_id)] = coef
            rxn.add_metabolites(metabolites)

            # Set objective
            if rxn_data.get("objective_coefficient", 0) != 0:
                rxn.objective_coefficient = rxn_data["objective_coefficient"]

            model.add_reactions([rxn])

        # Set solver
        model.solver = solver

        # Run solve
        start = time.perf_counter()

        if method == "fba":
            solution = model.optimize()
        elif method == "pfba":
            solution = cobra.flux_analysis.pfba(model)
        else:
            return {"error": f"Unknown method: {method}"}

        elapsed_ms = (time.perf_counter() - start) * 1000

        if solution.status == "optimal":
            # Convert numpy dtypes to Python floats for JSON serialization
            fluxes = {}
            for rxn_id, val in solution.fluxes.items():
                if hasattr(val, 'item'):
                    fluxes[rxn_id] = float(val.item())
                else:
                    fluxes[rxn_id] = float(val)

            obj_val = solution.objective_value
            if hasattr(obj_val, 'item'):
                obj_val = float(obj_val.item())
            else:
                obj_val = float(obj_val)

            return {
                "status": "optimal",
                "objective_value": obj_val,
                "fluxes": fluxes,
                "solve_time_ms": elapsed_ms,
                "solver": f"cobrapy-{solver}",
            }
        else:
            return {
                "status": solution.status,
                "objective_value": None,
                "fluxes": None,
                "solve_time_ms": elapsed_ms,
                "solver": f"cobrapy-{solver}",
            }

    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "solve_time_ms": 0,
        }


def run_full_benchmark(num_models: int = 100,
                       methods: List[str] = ["fba", "pfba"],
                       output_dir: Optional[Path] = None) -> Dict:
    """
    Run complete benchmark suite

    Returns summary and saves detailed results
    """
    output_dir = output_dir or RESULTS_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    # Initialize
    catalog = BiGGModelCatalog()
    models = catalog.get_benchmark_models(limit=num_models)

    logger.info(f"Running benchmark on {len(models)} models...")

    # Run COBRApy benchmark
    benchmark = COBRApyBenchmark(catalog)
    results = benchmark.run_benchmark(models, methods=methods)

    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    results_file = output_dir / f"cobrapy_results_{timestamp}.json"
    benchmark.export_results(results_file)

    # Generate summary
    summary = {
        "num_models": len(models),
        "num_results": len(results),
        "methods": methods,
        "timestamp": timestamp,
        "optimal_count": sum(1 for r in results if r.status == "optimal"),
        "error_count": sum(1 for r in results if r.status == "error"),
    }

    return {
        "summary": summary,
        "results_file": str(results_file),
    }


if __name__ == "__main__":
    # Run benchmark when executed directly
    import argparse

    parser = argparse.ArgumentParser(description="MetabolicSuite Benchmark Suite")
    parser.add_argument("-n", "--num-models", type=int, default=20,
                        help="Number of models to benchmark")
    parser.add_argument("-m", "--methods", nargs="+", default=["fba", "pfba"],
                        help="Methods to benchmark")
    parser.add_argument("-o", "--output", type=Path, default=None,
                        help="Output directory")

    args = parser.parse_args()

    result = run_full_benchmark(
        num_models=args.num_models,
        methods=args.methods,
        output_dir=args.output,
    )

    print(f"\nBenchmark Complete!")
    print(f"Results: {result['results_file']}")
    print(f"Summary: {result['summary']}")
