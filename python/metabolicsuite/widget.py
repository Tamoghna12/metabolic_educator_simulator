"""
PathwayMap Widget - Jupyter Widget for Metabolic Pathway Visualization

Uses anywidget for modern Jupyter widget development with React frontend.
"""

import json
import pathlib
from typing import Any, Dict, List, Optional, Union

import anywidget
import traitlets
import numpy as np
import pandas as pd

# Path to bundled frontend assets
_STATIC_DIR = pathlib.Path(__file__).parent / "static"


class PathwayMap(anywidget.AnyWidget):
    """
    Interactive metabolic pathway map widget for Jupyter notebooks.

    Parameters
    ----------
    model : cobra.Model or dict or str, optional
        A COBRApy model, model dictionary, or path to SBML/JSON file.
    fluxes : dict or pandas.Series, optional
        Flux values to overlay on the map.
    template : str, optional
        Pre-built template name (e.g., 'ecoli_central_carbon', 'glycolysis').
    width : int, optional
        Widget width in pixels (default: 900).
    height : int, optional
        Widget height in pixels (default: 600).

    Examples
    --------
    >>> from metabolicsuite import PathwayMap
    >>> import cobra

    # From COBRApy model
    >>> model = cobra.io.load_model("textbook")
    >>> solution = model.optimize()
    >>> map = PathwayMap(model, fluxes=solution.fluxes)
    >>> map

    # From template
    >>> map = PathwayMap(template="glycolysis")
    >>> map

    # With omics data
    >>> map.add_transcriptomics(gene_expression_df, id_col="gene", value_col="log2fc")
    >>> map.add_metabolomics(metabolite_df, id_col="metabolite", value_col="concentration")
    """

    # Frontend assets (bundled React app with render function)
    _esm = _STATIC_DIR / "widget.js"

    # Model data
    model_data = traitlets.Dict({}).tag(sync=True)
    nodes = traitlets.List([]).tag(sync=True)
    edges = traitlets.List([]).tag(sync=True)

    # Flux data
    fluxes = traitlets.Dict({}).tag(sync=True)

    # Multi-omics data
    omics_data = traitlets.Dict({
        'transcriptomics': None,
        'proteomics': None,
        'metabolomics': None,
        'fluxomics': None
    }).tag(sync=True)

    # Visualization settings
    vis_settings = traitlets.Dict({
        'transcriptomics': {'enabled': False, 'property': 'color', 'colorScale': 'diverging'},
        'proteomics': {'enabled': False, 'property': 'width', 'colorScale': 'sequential'},
        'metabolomics': {'enabled': False, 'property': 'size', 'colorScale': 'diverging'},
        'fluxomics': {'enabled': False, 'property': 'animation', 'colorScale': 'diverging'},
    }).tag(sync=True)

    # Display settings
    width = traitlets.Int(900).tag(sync=True)
    height = traitlets.Int(600).tag(sync=True)
    show_controls = traitlets.Bool(True).tag(sync=True)
    animation_enabled = traitlets.Bool(True).tag(sync=True)

    # Selection state (JS -> Python)
    selected_node = traitlets.Unicode(None, allow_none=True).tag(sync=True)
    selected_reaction = traitlets.Unicode(None, allow_none=True).tag(sync=True)

    # Export data (JS -> Python)
    export_data = traitlets.Dict({}).tag(sync=True)

    def __init__(
        self,
        model: Optional[Any] = None,
        fluxes: Optional[Union[Dict, "pd.Series"]] = None,
        template: Optional[str] = None,
        width: int = 900,
        height: int = 600,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.width = width
        self.height = height

        if template:
            self._load_template(template)
        elif model is not None:
            self._load_model(model)

        if fluxes is not None:
            self.set_fluxes(fluxes)

    def _load_model(self, model: Any) -> None:
        """Load model from various sources."""
        # Try COBRApy model
        if hasattr(model, 'reactions') and hasattr(model, 'metabolites'):
            self._load_cobra_model(model)
        # Dictionary
        elif isinstance(model, dict):
            self._load_dict_model(model)
        # File path
        elif isinstance(model, (str, pathlib.Path)):
            self._load_file_model(model)
        else:
            raise TypeError(f"Unsupported model type: {type(model)}")

    def _load_cobra_model(self, model: Any) -> None:
        """Load from COBRApy model object."""
        model_data = {
            'id': model.id,
            'name': getattr(model, 'name', model.id),
            'reactions': {},
            'metabolites': {},
            'genes': {}
        }

        # Extract reactions
        for rxn in model.reactions:
            model_data['reactions'][rxn.id] = {
                'name': rxn.name,
                'equation': rxn.reaction,
                'subsystem': rxn.subsystem or 'Unclassified',
                'genes': [g.id for g in rxn.genes],
                'gpr': rxn.gene_reaction_rule,
                'lower_bound': rxn.lower_bound,
                'upper_bound': rxn.upper_bound,
                'metabolites': {m.id: c for m, c in rxn.metabolites.items()}
            }

        # Extract metabolites
        for met in model.metabolites:
            model_data['metabolites'][met.id] = {
                'name': met.name,
                'compartment': met.compartment,
                'formula': getattr(met, 'formula', '')
            }

        # Extract genes
        for gene in model.genes:
            model_data['genes'][gene.id] = {
                'name': gene.name,
                'product': getattr(gene, 'product', gene.name)
            }

        self.model_data = model_data
        self._generate_layout()

    def _load_dict_model(self, model: Dict) -> None:
        """Load from dictionary (CobraPy JSON format)."""
        self.model_data = model
        if 'nodes' in model and 'edges' in model:
            self.nodes = model['nodes']
            self.edges = model['edges']
        else:
            self._generate_layout()

    def _load_file_model(self, path: Union[str, pathlib.Path]) -> None:
        """Load from file path."""
        path = pathlib.Path(path)
        if not path.exists():
            raise FileNotFoundError(f"Model file not found: {path}")

        content = path.read_text()

        if path.suffix.lower() in ['.xml', '.sbml']:
            # SBML - would need to parse
            raise NotImplementedError("SBML parsing in Python widget not yet implemented. Use web interface.")
        elif path.suffix.lower() == '.json':
            model = json.loads(content)
            self._load_dict_model(model)
        else:
            raise ValueError(f"Unsupported file format: {path.suffix}")

    def _load_template(self, template_name: str) -> None:
        """Load a pre-built pathway template."""
        from .templates import get_template
        template = get_template(template_name)
        self.nodes = template['nodes']
        self.edges = template['edges']
        self.model_data = {'id': template['id'], 'name': template['name']}

    def _generate_layout(self) -> None:
        """Generate automatic layout for visualization."""
        reactions = self.model_data.get('reactions', {})
        metabolites = self.model_data.get('metabolites', {})

        # Track metabolite connectivity
        connectivity = {}
        for rxn in reactions.values():
            for met_id in rxn.get('metabolites', {}).keys():
                connectivity[met_id] = connectivity.get(met_id, 0) + 1

        # Get top connected metabolites
        sorted_mets = sorted(connectivity.items(), key=lambda x: -x[1])[:30]

        # Generate spiral layout
        nodes = []
        angle = 0
        radius = 100
        width, height = self.width, self.height

        for i, (met_id, count) in enumerate(sorted_mets):
            met = metabolites.get(met_id, {})
            x = width / 2 + radius * np.cos(angle)
            y = height / 2 + radius * np.sin(angle)

            node_type = 'metabolite'
            if met_id.endswith('_e'):
                node_type = 'exchange'
            elif 'biomass' in met_id.lower():
                node_type = 'biomass'

            nodes.append({
                'id': met_id,
                'x': float(x),
                'y': float(y),
                'label': met.get('name', met_id.replace('_c', '').replace('_e', '')),
                'type': node_type,
                'connectivity': count
            })

            angle += 0.8
            if i % 5 == 4:
                radius += 20

        # Generate edges
        edges = []
        key_mets = set(m[0] for m in sorted_mets)

        for rxn_id, rxn in reactions.items():
            mets = rxn.get('metabolites', {})
            reactants = [m for m, c in mets.items() if c < 0 and m in key_mets]
            products = [m for m, c in mets.items() if c > 0 and m in key_mets]

            for r in reactants:
                for p in products:
                    if r != p:
                        edges.append({
                            'from': r,
                            'to': p,
                            'reaction': rxn_id,
                            'label': rxn_id
                        })

        self.nodes = nodes[:30]
        self.edges = edges[:50]

    def set_fluxes(self, fluxes: Union[Dict, "pd.Series"]) -> None:
        """
        Set flux values for visualization.

        Parameters
        ----------
        fluxes : dict or pandas.Series
            Mapping of reaction IDs to flux values.
        """
        if hasattr(fluxes, 'to_dict'):
            fluxes = fluxes.to_dict()
        self.fluxes = {k: float(v) for k, v in fluxes.items() if not np.isnan(v)}

    def add_transcriptomics(
        self,
        data: Union[Dict, "pd.DataFrame"],
        id_col: str = 'gene',
        value_col: str = 'log2fc',
        condition: Optional[str] = None
    ) -> None:
        """
        Add transcriptomics data overlay.

        Parameters
        ----------
        data : dict or pandas.DataFrame
            Gene expression data.
        id_col : str
            Column name for gene identifiers.
        value_col : str
            Column name for expression values (e.g., log2FC).
        condition : str, optional
            Condition name for multi-condition data.
        """
        self._add_omics_data('transcriptomics', data, id_col, value_col, condition)

    def add_proteomics(
        self,
        data: Union[Dict, "pd.DataFrame"],
        id_col: str = 'protein',
        value_col: str = 'abundance',
        condition: Optional[str] = None
    ) -> None:
        """
        Add proteomics data overlay.

        Parameters
        ----------
        data : dict or pandas.DataFrame
            Protein abundance data.
        id_col : str
            Column name for protein/gene identifiers.
        value_col : str
            Column name for abundance values.
        condition : str, optional
            Condition name for multi-condition data.
        """
        self._add_omics_data('proteomics', data, id_col, value_col, condition)

    def add_metabolomics(
        self,
        data: Union[Dict, "pd.DataFrame"],
        id_col: str = 'metabolite',
        value_col: str = 'concentration',
        condition: Optional[str] = None
    ) -> None:
        """
        Add metabolomics data overlay.

        Parameters
        ----------
        data : dict or pandas.DataFrame
            Metabolite concentration data.
        id_col : str
            Column name for metabolite identifiers (BiGG IDs preferred).
        value_col : str
            Column name for concentration values.
        condition : str, optional
            Condition name for multi-condition data.
        """
        self._add_omics_data('metabolomics', data, id_col, value_col, condition)

    def add_fluxomics(
        self,
        data: Union[Dict, "pd.DataFrame"],
        id_col: str = 'reaction',
        value_col: str = 'flux',
        condition: Optional[str] = None
    ) -> None:
        """
        Add fluxomics data overlay (e.g., 13C-MFA results).

        Parameters
        ----------
        data : dict or pandas.DataFrame
            Measured flux data.
        id_col : str
            Column name for reaction identifiers.
        value_col : str
            Column name for flux values.
        condition : str, optional
            Condition name for multi-condition data.
        """
        self._add_omics_data('fluxomics', data, id_col, value_col, condition)

    def _add_omics_data(
        self,
        omics_type: str,
        data: Union[Dict, "pd.DataFrame"],
        id_col: str,
        value_col: str,
        condition: Optional[str]
    ) -> None:
        """Internal method to add omics data."""
        if isinstance(data, pd.DataFrame):
            indexed = {}
            for _, row in data.iterrows():
                id_val = str(row[id_col])
                indexed[id_val] = {value_col: float(row[value_col])}
            data = indexed
        elif isinstance(data, dict):
            if all(isinstance(v, (int, float)) for v in data.values()):
                data = {k: {value_col: v} for k, v in data.items()}

        omics = dict(self.omics_data)
        omics[omics_type] = {
            'data': data,
            'idColumn': id_col,
            'valueColumns': [value_col],
            'conditions': [condition or value_col],
            'selectedCondition': condition or value_col
        }
        self.omics_data = omics

        # Enable visualization
        settings = dict(self.vis_settings)
        settings[omics_type] = {**settings.get(omics_type, {}), 'enabled': True}
        self.vis_settings = settings

    def set_vis_setting(self, omics_type: str, **kwargs) -> None:
        """
        Update visualization settings for an omics type.

        Parameters
        ----------
        omics_type : str
            One of 'transcriptomics', 'proteomics', 'metabolomics', 'fluxomics'.
        **kwargs
            Settings to update (e.g., enabled=True, property='color', colorScale='diverging').
        """
        settings = dict(self.vis_settings)
        settings[omics_type] = {**settings.get(omics_type, {}), **kwargs}
        self.vis_settings = settings

    def export_svg(self) -> str:
        """
        Get SVG export of the current map.

        Returns
        -------
        str
            SVG content as string.
        """
        # This would be populated by JS callback
        return self.export_data.get('svg', '')

    def save_svg(self, path: Union[str, pathlib.Path]) -> None:
        """Save map as SVG file."""
        svg = self.export_svg()
        if svg:
            pathlib.Path(path).write_text(svg)

    def _repr_html_(self) -> str:
        """Rich HTML representation for Jupyter."""
        return f"""
        <div style="border: 1px solid #ccc; border-radius: 8px; padding: 10px; max-width: {self.width}px;">
            <p><strong>MetabolicSuite PathwayMap</strong></p>
            <p>Model: {self.model_data.get('name', 'Not loaded')}</p>
            <p>Nodes: {len(self.nodes)} | Edges: {len(self.edges)}</p>
            <p><em>Widget will render in Jupyter environment</em></p>
        </div>
        """


class OmicsOverlay:
    """
    Utility class for managing multi-omics data overlays.

    This class helps prepare and validate omics data before adding to PathwayMap.
    """

    @staticmethod
    def from_deseq2(filepath: Union[str, pathlib.Path], gene_col: str = 'gene') -> Dict:
        """
        Load transcriptomics data from DESeq2 output.

        Parameters
        ----------
        filepath : str or Path
            Path to DESeq2 results CSV.
        gene_col : str
            Column name for gene identifiers.

        Returns
        -------
        dict
            Prepared data for PathwayMap.add_transcriptomics().
        """
        df = pd.read_csv(filepath)
        return {
            'data': df,
            'id_col': gene_col,
            'value_col': 'log2FoldChange'
        }

    @staticmethod
    def from_maxquant(filepath: Union[str, pathlib.Path], protein_col: str = 'Protein IDs') -> Dict:
        """
        Load proteomics data from MaxQuant output.

        Parameters
        ----------
        filepath : str or Path
            Path to MaxQuant proteinGroups.txt.
        protein_col : str
            Column name for protein identifiers.

        Returns
        -------
        dict
            Prepared data for PathwayMap.add_proteomics().
        """
        df = pd.read_csv(filepath, sep='\t')
        # Find LFQ intensity columns
        lfq_cols = [c for c in df.columns if 'LFQ intensity' in c]
        if not lfq_cols:
            raise ValueError("No LFQ intensity columns found in MaxQuant output")

        return {
            'data': df,
            'id_col': protein_col,
            'value_col': lfq_cols[0]
        }

    @staticmethod
    def from_metaboanalyst(filepath: Union[str, pathlib.Path]) -> Dict:
        """
        Load metabolomics data from MetaboAnalyst export.

        Parameters
        ----------
        filepath : str or Path
            Path to MetaboAnalyst results.

        Returns
        -------
        dict
            Prepared data for PathwayMap.add_metabolomics().
        """
        df = pd.read_csv(filepath)
        # MetaboAnalyst typically has compound IDs in first column
        id_col = df.columns[0]
        # Find fold change column
        fc_cols = [c for c in df.columns if 'FC' in c.upper() or 'fold' in c.lower()]
        value_col = fc_cols[0] if fc_cols else df.columns[1]

        return {
            'data': df,
            'id_col': id_col,
            'value_col': value_col
        }
