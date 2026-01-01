"""
Parsers for metabolic models and omics data.
"""

import json
import pathlib
from typing import Any, Dict, Optional, Union

import pandas as pd


def parse_model(source: Union[str, pathlib.Path, Dict]) -> Dict:
    """
    Parse a metabolic model from various sources.

    Parameters
    ----------
    source : str, Path, or dict
        Model source - can be:
        - Path to SBML (.xml, .sbml) or JSON file
        - COBRApy model object
        - Dictionary in CobraPy JSON format

    Returns
    -------
    dict
        Standardized model dictionary with reactions, metabolites, genes.

    Examples
    --------
    >>> model = parse_model("iML1515.xml")
    >>> model = parse_model(cobra_model)
    >>> model = parse_model({"reactions": [...], "metabolites": [...]})
    """
    # COBRApy model
    if hasattr(source, 'reactions') and hasattr(source, 'metabolites'):
        return _parse_cobra_model(source)

    # Dictionary
    if isinstance(source, dict):
        return _standardize_dict_model(source)

    # File path
    path = pathlib.Path(source)
    if not path.exists():
        raise FileNotFoundError(f"Model file not found: {path}")

    content = path.read_text()

    if path.suffix.lower() in ['.xml', '.sbml']:
        return _parse_sbml(content)
    elif path.suffix.lower() == '.json':
        data = json.loads(content)
        return _standardize_dict_model(data)
    else:
        raise ValueError(f"Unsupported file format: {path.suffix}")


def _parse_cobra_model(model: Any) -> Dict:
    """Parse from COBRApy model object."""
    result = {
        'id': model.id,
        'name': getattr(model, 'name', model.id),
        'reactions': {},
        'metabolites': {},
        'genes': {}
    }

    for rxn in model.reactions:
        result['reactions'][rxn.id] = {
            'name': rxn.name,
            'equation': rxn.reaction,
            'subsystem': rxn.subsystem or 'Unclassified',
            'genes': [g.id for g in rxn.genes],
            'gpr': rxn.gene_reaction_rule,
            'lower_bound': rxn.lower_bound,
            'upper_bound': rxn.upper_bound,
            'metabolites': {m.id: c for m, c in rxn.metabolites.items()}
        }

    for met in model.metabolites:
        result['metabolites'][met.id] = {
            'name': met.name,
            'compartment': met.compartment,
            'formula': getattr(met, 'formula', '')
        }

    for gene in model.genes:
        result['genes'][gene.id] = {
            'name': gene.name,
            'product': getattr(gene, 'product', gene.name)
        }

    return result


def _standardize_dict_model(data: Dict) -> Dict:
    """Standardize dictionary model to common format."""
    result = {
        'id': data.get('id', 'model'),
        'name': data.get('name', data.get('id', 'Model')),
        'reactions': {},
        'metabolites': {},
        'genes': {}
    }

    # Handle CobraPy JSON format (list-based)
    if isinstance(data.get('reactions'), list):
        for rxn in data['reactions']:
            rxn_id = rxn.get('id', '')
            result['reactions'][rxn_id] = {
                'name': rxn.get('name', rxn_id),
                'equation': _build_equation(rxn.get('metabolites', {})),
                'subsystem': rxn.get('subsystem', 'Unclassified'),
                'genes': _parse_gpr_genes(rxn.get('gene_reaction_rule', '')),
                'gpr': rxn.get('gene_reaction_rule', ''),
                'lower_bound': rxn.get('lower_bound', -1000),
                'upper_bound': rxn.get('upper_bound', 1000),
                'metabolites': rxn.get('metabolites', {})
            }
    elif isinstance(data.get('reactions'), dict):
        result['reactions'] = data['reactions']

    if isinstance(data.get('metabolites'), list):
        for met in data['metabolites']:
            met_id = met.get('id', '')
            result['metabolites'][met_id] = {
                'name': met.get('name', met_id),
                'compartment': met.get('compartment', 'c'),
                'formula': met.get('formula', '')
            }
    elif isinstance(data.get('metabolites'), dict):
        result['metabolites'] = data['metabolites']

    if isinstance(data.get('genes'), list):
        for gene in data['genes']:
            gene_id = gene.get('id', '')
            result['genes'][gene_id] = {
                'name': gene.get('name', gene_id),
                'product': gene.get('product', gene.get('name', gene_id))
            }
    elif isinstance(data.get('genes'), dict):
        result['genes'] = data['genes']

    return result


def _parse_sbml(content: str) -> Dict:
    """Parse SBML XML content."""
    # For now, recommend using web interface for SBML
    # Full SBML parsing would require lxml or similar
    raise NotImplementedError(
        "SBML parsing in Python not yet implemented. "
        "Use the web interface for SBML files, or convert to JSON using COBRApy: "
        "cobra.io.save_json_model(model, 'model.json')"
    )


def _build_equation(metabolites: Dict) -> str:
    """Build reaction equation string from metabolites dict."""
    reactants = []
    products = []

    for met_id, coeff in metabolites.items():
        name = met_id.replace('_c', '').replace('_e', '')
        if coeff < 0:
            reactants.append(f"{abs(coeff)} {name}" if abs(coeff) != 1 else name)
        else:
            products.append(f"{coeff} {name}" if coeff != 1 else name)

    return f"{' + '.join(reactants) or '∅'} → {' + '.join(products) or '∅'}"


def _parse_gpr_genes(gpr: str) -> list:
    """Extract gene IDs from GPR string."""
    if not gpr:
        return []
    import re
    genes = re.findall(r'[a-zA-Z0-9_.-]+', gpr)
    return [g for g in genes if g.upper() not in ('AND', 'OR')]


def parse_omics_data(
    source: Union[str, pathlib.Path, pd.DataFrame, Dict],
    id_col: Optional[str] = None,
    value_cols: Optional[list] = None
) -> Dict:
    """
    Parse omics data from various sources.

    Parameters
    ----------
    source : str, Path, DataFrame, or dict
        Omics data source.
    id_col : str, optional
        Column name for identifiers. Auto-detected if not provided.
    value_cols : list, optional
        Column names for values. Auto-detected if not provided.

    Returns
    -------
    dict
        Standardized omics data dictionary.

    Examples
    --------
    >>> data = parse_omics_data("deseq2_results.csv", id_col="gene", value_cols=["log2FoldChange"])
    >>> data = parse_omics_data(df, id_col="metabolite", value_cols=["wt", "mutant"])
    """
    # Load data
    if isinstance(source, pd.DataFrame):
        df = source
    elif isinstance(source, dict):
        df = pd.DataFrame(source)
    else:
        path = pathlib.Path(source)
        if path.suffix.lower() in ['.csv']:
            df = pd.read_csv(path)
        elif path.suffix.lower() in ['.tsv', '.txt']:
            df = pd.read_csv(path, sep='\t')
        elif path.suffix.lower() == '.xlsx':
            df = pd.read_excel(path)
        else:
            raise ValueError(f"Unsupported file format: {path.suffix}")

    # Auto-detect ID column
    if id_col is None:
        id_patterns = ['gene', 'protein', 'metabolite', 'reaction', 'id', 'name']
        for pattern in id_patterns:
            matches = [c for c in df.columns if pattern.lower() in c.lower()]
            if matches:
                id_col = matches[0]
                break
        if id_col is None:
            id_col = df.columns[0]

    # Auto-detect value columns
    if value_cols is None:
        value_cols = [c for c in df.columns if c != id_col and df[c].dtype in ['float64', 'int64']]

    # Build indexed data
    indexed = {}
    for _, row in df.iterrows():
        item_id = str(row[id_col])
        indexed[item_id] = {col: float(row[col]) for col in value_cols if pd.notna(row[col])}

    return {
        'data': indexed,
        'id_column': id_col,
        'value_columns': value_cols,
        'conditions': value_cols,
        'stats': _calculate_stats(df, value_cols)
    }


def _calculate_stats(df: pd.DataFrame, value_cols: list) -> Dict:
    """Calculate statistics for value columns."""
    all_values = []
    for col in value_cols:
        all_values.extend(df[col].dropna().tolist())

    if not all_values:
        return {}

    import numpy as np
    arr = np.array(all_values)

    return {
        'min': float(np.min(arr)),
        'max': float(np.max(arr)),
        'mean': float(np.mean(arr)),
        'median': float(np.median(arr)),
        'std': float(np.std(arr)),
        'count': len(arr)
    }
