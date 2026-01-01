# MetabolicSuite

Interactive metabolic pathway visualization with multi-omics integration for Jupyter notebooks.

## Features

- **Interactive Pathway Maps**: Pan, zoom, drag nodes, add annotations
- **Multi-Omics Overlay**: Transcriptomics, proteomics, metabolomics, fluxomics
- **Animated Flux Flow**: Visualize metabolic flux direction and magnitude
- **COBRApy Integration**: Direct support for COBRApy models
- **SBML/JSON Support**: Load models from standard formats
- **Pre-built Templates**: Glycolysis, TCA cycle, PPP, E. coli central carbon
- **Publication Export**: SVG and PNG export with legends

## Installation

```bash
pip install metabolicsuite

# With COBRApy support
pip install metabolicsuite[cobra]
```

## Quick Start

### From COBRApy Model

```python
from metabolicsuite import PathwayMap
import cobra

# Load model and run FBA
model = cobra.io.load_model("textbook")
solution = model.optimize()

# Create interactive map
map = PathwayMap(model, fluxes=solution.fluxes)
map  # Display in Jupyter
```

### From Template

```python
from metabolicsuite import PathwayMap, list_templates

# See available templates
print(list_templates())

# Load glycolysis template
map = PathwayMap(template="glycolysis")
map
```

### With Multi-Omics Data

```python
from metabolicsuite import PathwayMap
import pandas as pd

# Create map from model
map = PathwayMap(model, fluxes=solution.fluxes)

# Add transcriptomics (DESeq2 output)
expression_df = pd.read_csv("deseq2_results.csv")
map.add_transcriptomics(expression_df, id_col="gene", value_col="log2FoldChange")

# Add proteomics
protein_df = pd.read_csv("maxquant_proteins.csv")
map.add_proteomics(protein_df, id_col="gene", value_col="LFQ_intensity")

# Add metabolomics
metabolite_df = pd.read_csv("metabolomics.csv")
map.add_metabolomics(metabolite_df, id_col="metabolite_id", value_col="fold_change")

# Display with all overlays
map
```

### Customize Visualization

```python
# Change visualization settings
map.set_vis_setting('transcriptomics', property='color', colorScale='diverging')
map.set_vis_setting('proteomics', property='width')
map.set_vis_setting('metabolomics', property='size')

# Toggle animation
map.animation_enabled = False

# Export
map.save_svg("pathway_map.svg")
```

## Data Format Requirements

### Transcriptomics
- Gene IDs matching model genes
- log2 fold change values recommended
- Example: DESeq2, edgeR output

### Proteomics
- Gene/protein IDs
- Abundance or intensity values
- Example: MaxQuant, Proteome Discoverer output

### Metabolomics
- BiGG IDs (e.g., `glc__D_c`) or KEGG IDs
- Concentration or fold change values
- Example: MetaboAnalyst export

### Fluxomics
- Reaction IDs from model
- Measured flux values
- Example: 13C-MFA results

## Templates

| Template | Description |
|----------|-------------|
| `glycolysis` | Embden-Meyerhof-Parnas pathway |
| `tca_cycle` | Tricarboxylic acid cycle |
| `ppp` | Pentose phosphate pathway |
| `ecoli_central_carbon` | E. coli core metabolism |

## API Reference

### PathwayMap

```python
PathwayMap(
    model=None,           # COBRApy model, dict, or file path
    fluxes=None,          # Flux values dict or pandas Series
    template=None,        # Pre-built template name
    width=900,            # Widget width in pixels
    height=600            # Widget height in pixels
)
```

#### Methods

- `set_fluxes(fluxes)` - Update flux overlay
- `add_transcriptomics(data, id_col, value_col)` - Add gene expression overlay
- `add_proteomics(data, id_col, value_col)` - Add protein abundance overlay
- `add_metabolomics(data, id_col, value_col)` - Add metabolite concentration overlay
- `add_fluxomics(data, id_col, value_col)` - Add measured flux overlay
- `set_vis_setting(omics_type, **kwargs)` - Update visualization settings
- `save_svg(path)` - Export map as SVG

### OmicsOverlay

Utility class for loading omics data from common tools:

```python
from metabolicsuite import OmicsOverlay

# DESeq2
data = OmicsOverlay.from_deseq2("deseq2_results.csv")
map.add_transcriptomics(**data)

# MaxQuant
data = OmicsOverlay.from_maxquant("proteinGroups.txt")
map.add_proteomics(**data)

# MetaboAnalyst
data = OmicsOverlay.from_metaboanalyst("metaboanalyst_results.csv")
map.add_metabolomics(**data)
```

## Comparison with Escher

| Feature | Escher | MetabolicSuite |
|---------|--------|----------------|
| Interactive editing | Yes | Yes |
| Multi-omics overlay | Gene only | All 4 types |
| Animated flux | Yes | Yes |
| SBML support | No (JSON only) | Yes |
| Zero-install web app | No | Yes |
| Educational content | No | Yes |
| Colorblind accessible | No | Yes |

## Citation

If you use MetabolicSuite in your research, please cite:

```bibtex
@software{metabolicsuite2024,
  title = {MetabolicSuite: Interactive Multi-Omics Pathway Visualization},
  year = {2024},
  url = {https://github.com/metabolicsuite/metabolicsuite}
}
```

## License

MIT License
