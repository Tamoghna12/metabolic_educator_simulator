"""
MetabolicSuite - Interactive Metabolic Pathway Visualization

A Jupyter widget for interactive visualization of metabolic models with
multi-omics data integration. Supports SBML and CobraPy JSON models.

Example:
    >>> from metabolicsuite import PathwayMap
    >>> import cobra
    >>> model = cobra.io.load_model("textbook")
    >>> map = PathwayMap(model)
    >>> map  # Display in Jupyter

Features:
    - Interactive pathway visualization with pan/zoom/drag
    - Multi-omics overlay (transcriptomics, proteomics, metabolomics)
    - Animated flux flow visualization
    - SVG/PNG export
    - Pre-built pathway templates
    - FBA simulation results overlay

References:
    - King et al. (2015) Escher: PLOS Comp Bio
    - Ebrahim et al. (2013) COBRApy: BMC Systems Biology
"""

from .parsers import parse_model, parse_omics_data
from .templates import get_template, list_templates

# Widget imports require anywidget (optional dependency for Jupyter)
try:
    from .widget import PathwayMap, OmicsOverlay
    _HAS_WIDGET = True
except ImportError:
    PathwayMap = None
    OmicsOverlay = None
    _HAS_WIDGET = False

__version__ = "0.1.0"
__all__ = [
    "PathwayMap",
    "OmicsOverlay",
    "parse_model",
    "parse_omics_data",
    "get_template",
    "list_templates",
]
