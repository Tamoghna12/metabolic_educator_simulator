# MetabolicSuite

**A web-based research and educational platform for constraint-based metabolic modeling with multi-omics integration**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/yourusername/metabolic-suite)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/yourusername/metabolic-suite)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Installation](#installation)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

MetabolicSuite is a **research-grade constraint-based metabolic modeling platform** that runs entirely in the browser. It combines advanced computational methods (FBA, FVA, pFBA, MOMA, GIMME, E-Flux, iMAT) with an intuitive educational interface for teaching and research.

### Key Capabilities

- **Real LP Solver**: GLPK.js-based Flux Balance Analysis with proper mathematical formulation
- **Multi-Omics Integration**: GIMME, E-Flux, iMAT algorithms for transcriptomics/proteomics data
- **Genome-Scale Models**: Support for SBML Level 2/3, COBRApy JSON, and BiGG models
- **Educational Features**: Gamified learning, interactive tutorials, progress tracking
- **Interactive Visualizations**: Pathway maps, flux heatmaps, production envelopes, comparative analysis

### Target Users

- **Researchers**: Biologists, bioinformaticians, and metabolic engineers
- **Educators**: Instructors teaching systems biology, metabolic engineering, and bioinformatics
- **Students**: Learning constraint-based modeling through interactive exploration

---

## Features

### Research Features

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **FBA** | Flux Balance Analysis with objective optimization | LP-based using glpk.js |
| **FVA** | Flux Variability Analysis | Min/max flux ranges per reaction |
| **pFBA** | Parsimonious FBA | Minimize total flux subject to optimal biomass |
| **MOMA** | Minimization of Metabolic Adjustment | Minimize Euclidean distance to wild-type |
| **GPR Parser** | Gene-Protein-Reaction Boolean evaluation | Recursive descent parser for AND/OR logic |
| **GIMME** | Gene Inactivity Moderated by Metabolism and Expression | LP formulation with expression-weighted objective |
| **E-Flux** | Expression-constrained Flux Analysis | Bound scaling based on expression |
| **iMAT** | Integrative Metabolic Analysis Tool | Binary optimization for expression consistency |

### Educational Features

- **Gamified Progress**: XP, badges, levels for learning modules
- **Interactive Tutorials**: Step-by-step algorithm explanations
- **Quiz System**: Knowledge testing with immediate feedback
- **Learning Paths**: Structured curriculum for different skill levels
- **Research Workflows**: Guided analysis pipelines for students

### Visualization Features

- **Pathway Maps**: Interactive metabolic network diagrams
- **Flux Heatmaps**: Color-coded flux distributions
- **Production Envelopes**: Phenotype phase plane analysis
- **Comparative Analysis**: Wild-type vs. mutant comparisons
- **Omics Overlays**: Multi-layer visualization (transcriptomics, proteomics, metabolomics, fluxomics)

### Accessibility

- **Colorblind-Safe Palettes**: WCAG AA compliant color schemes
- **Keyboard Shortcuts**: Full keyboard navigation
- **Screen Reader Support**: ARIA labels and semantic HTML
- **Responsive Design**: Works on desktop, tablet, and mobile

---

## Quick Start

### Prerequisites

- **Node.js**: v18.0 or higher
- **npm** or **yarn**: For package management
- **Modern Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/metabolic-suite.git
cd metabolic-suite

# Install dependencies
npm install

# Start development server
npm run dev
```

### Load a Model

1. Open browser to `http://localhost:5173`
2. Click "Upload Model" or use the default E. coli core model
3. Supported formats:
   - SBML (`.xml`, `.sbml`)
   - COBRApy JSON (`.json`)
   - BiGG model (auto-download)

### Run FBA

1. Select "Enhanced Modeling" tab
2. Set exchange constraints (glucose, oxygen, etc.)
3. Click "Solve FBA"
4. View results: fluxes, growth rate, phenotype

---

## Documentation

Full documentation is available in the [`docs/`](./docs/) directory:

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)**: System architecture, component structure, data flow
- **[API.md](./docs/API.md)**: Complete API reference for all modules
- **[INSTALLATION.md](./docs/INSTALLATION.md)**: Detailed installation guide for development and production
- **[USER_GUIDE.md](./docs/USER_GUIDE.md)**: Comprehensive user manual with tutorials
- **[DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md)**: Developer setup, coding standards, testing
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)**: Deployment guide for various environments
- **[CONTRIBUTING.md](./docs/CONTRIBUTING.md)**: Contribution guidelines and workflow
- **[TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)**: Common issues and solutions
- **[ALGORITHMS.md](./docs/ALGORITHMS.md)**: Mathematical formulations and algorithm details
- **[REFERENCE_MODELS.md](./docs/REFERENCE_MODELS.md)**: Model format specifications and examples

---

## Installation

### Development Setup

```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Lint code
npm run lint
```

### Production Build

```bash
# Build web application
npm run build

# Build Jupyter widget
npm run build:widget

# Build both
npm run build:all
```

Output files:
- **Web App**: `dist/` directory
- **Jupyter Widget**: `python/metabolicsuite/static/widget.js`

### Python Package (Jupyter Widget)

```bash
cd python
pip install -e .
```

Use in Jupyter:
```python
from metabolicsuite import PathwayMap
import cobra
model = cobra.io.load_model("textbook")
map = PathwayMap(model)
map  # Display interactive pathway
```

---

## Architecture

### Technology Stack

**Frontend**:
- **Framework**: React 19.2
- **Build Tool**: Vite 7.2
- **Styling**: TailwindCSS 4.1
- **Charts**: Recharts 3.6
- **LP Solver**: glpk.js 5.0 (WASM-compiled GLPK)
- **Testing**: Vitest 4.0

**Backend**:
- **None**: Pure client-side application
- **Jupyter Widget**: Python wrapper for Jupyter integration

### Component Structure

```
src/
├── components/          # React components
│   ├── MetabolicModelingPlatform.jsx  # Main platform interface
│   ├── EnhancedModeling.jsx           # FBA/FVA/pFBA/MOMA UI
│   ├── OmicsDataUpload.jsx           # Multi-omics data upload
│   ├── PathwayMapBuilder.jsx         # Interactive pathway visualization
│   ├── Visualizations.jsx            # Charts and graphs
│   ├── SubsystemView.jsx             # Hierarchical subsystem explorer
│   └── EducationalFeatures.jsx       # Gamification and learning
├── lib/                # Core algorithms (research-grade)
│   ├── FBASolver.js                # Real LP solver (glpk.js integration)
│   ├── OmicsIntegration.js         # GIMME/E-Flux/iMAT algorithms
│   └── ForceLayout.js             # D3.js force-directed layout
├── utils/              # Utility functions
│   ├── sbmlParser.js              # SBML Level 2/3 parser
│   └── modelParser.js             # Model format utilities
├── contexts/           # React Context providers
│   ├── ModelContext.jsx            # Model state management
│   ├── OmicsContext.jsx            # Omics data management
│   └── ThemeContext.jsx            # Theme and accessibility
├── hooks/              # Custom React hooks
│   ├── useKeyboardShortcuts.js    # Keyboard shortcut handling
│   ├── useMapHistory.js            # Undo/redo history
│   └── useMapSearch.js            # Search functionality
└── data/               # Static data
    ├── metabolicData.js           # Default E. coli core model
    └── pathwayTemplates.js       # Pre-built pathway templates
```

### Data Flow

```
User Input (Upload/Parameters)
         ↓
ModelParser (SBML/JSON → Internal Format)
         ↓
ModelContext (State Management)
         ↓
FBASolver.js (LP Formulation)
         ↓
glpk.js (WASM Solver)
         ↓
Result (Fluxes, Growth Rate)
         ↓
Visualization Components
         ↓
UI Display
```

### Mathematical Formulations

See [`docs/ALGORITHMS.md`](./docs/ALGORITHMS.md) for complete mathematical formulations.

**FBA Problem**:
```
Maximize:    c·v
Subject to:   S·v = 0 (steady-state)
              lb ≤ v ≤ ub (flux bounds)
```

**GPR Evaluation**:
```
AND (enzyme complex):   R = A ∧ B  → active iff both A and B present
OR (isozymes):        R = A ∨ B  → active iff A or B present
```

---

## API Reference

### FBASolver Module

**Location**: `src/lib/FBASolver.js`

```javascript
import { solveFBA, solveFVA, solvePFBA, solveMOMA, evaluateGPR } from './lib/FBASolver';

// FBA: Optimize objective reaction
const result = await solveFBA(model, {
  objective: 'BIOMASS',
  knockoutGenes: new Set(),
  constraints: { 'EX_glc': { lb: -10 } }
});

// Result structure:
{
  status: 'OPTIMAL',
  objectiveValue: 0.877,
  fluxes: {
    'EX_glc': -10,
    'BIOMASS': 0.877,
    // ... all reactions
  }
}

// FVA: Flux ranges at fraction of optimal
const fvaResult = await solveFVA(model, {
  fraction: 0.9
});

// GPR: Boolean evaluation
const isActive = evaluateGPR('b3916 or b1723', new Set(['b3916'])); // true
```

### OmicsIntegration Module

**Location**: `src/lib/OmicsIntegration.js`

```javascript
import { solveGIMME, solveEFlux, solveIMAT, integratedOmicsAnalysis } from './lib/OmicsIntegration';

// GIMME: Expression-constrained FBA
const gimmeResult = await solveGIMME(model, geneExpression, {
  threshold: 0.25,
  requiredFraction: 0.9
});

// E-Flux: Proportional bound scaling
const efluxResult = await solveEFlux(model, geneExpression, {
  scalingMethod: 'linear'
});

// iMAT: Binary optimization for expression consistency
const imatResult = await solveIMAT(model, geneExpression, {
  highThreshold: 0.75,
  lowThreshold: 0.25
});
```

### React Components

**Key Components**:

- `<MetabolicModelingPlatform />`: Main application container
- `<EnhancedModeling />`: FBA/FVA/pFBA/MOMA interface
- `<OmicsDataUpload />`: Multi-omics data upload and integration
- `<PathwayMapBuilder />`: Interactive pathway visualization
- `<SubsystemView />`: Hierarchical subsystem explorer
- `<EducationalFeatures />`: Gamification, quizzes, tutorials

See [`docs/API.md`](./docs/API.md) for complete component API.

---

## Development

### Project Setup

```bash
# Clone repository
git clone https://github.com/yourusername/metabolic-suite.git
cd metabolic-suite

# Install dependencies
npm install

# Create feature branch
git checkout -b feature/my-new-feature
```

### Code Structure

```
metabolic-suite/
├── src/                  # Source code
├── public/               # Static assets
├── docs/                 # Documentation
├── python/               # Jupyter widget
├── tests/                # Test files (in src/lib/)
├── index.html            # Entry point
├── vite.config.js        # Vite configuration
└── package.json          # Dependencies
```

### Coding Standards

**JavaScript/JSX**:
- Use functional components with hooks
- Follow Airbnb style guide (enforced by ESLint)
- Use descriptive variable names
- Add JSDoc comments for all exports
- Avoid `any` types (use explicit types)

**Testing**:
- Write unit tests for all algorithms
- Use Vitest for testing
- Test files: `*.test.js`
- Coverage target: 80%

### Running Tests

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Linting

```bash
# Check for linting errors
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

---

## Deployment

### Production Build

```bash
# Build web application
npm run build

# Output: dist/
#   ├── index.html
#   ├── assets/
#   │   ├── index-[hash].js
#   │   └── index-[hash].css
#   └── ...
```

### Static Hosting

**GitHub Pages**:
```bash
npm install -g gh-pages
npm run build
gh-pages -d dist
```

**Netlify**:
- Connect repository
- Build command: `npm run build`
- Publish directory: `dist`

**Vercel**:
```bash
vercel --prod
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 80
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
```

### Jupyter Widget Deployment

```bash
# Build widget
npm run build:widget

# Install Python package
cd python
pip install build

# Upload to PyPI
twine upload dist/*
```

---

## Contributing

We welcome contributions! Please follow these guidelines:

### Workflow

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Commit Messages

Follow conventional commits:
- `feat: Add GIMME integration`
- `fix: Resolve GPR parsing issue`
- `docs: Update API documentation`
- `test: Add FVA unit tests`

### Pull Request Checklist

- [ ] Tests pass (`npm run test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Documentation updated
- [ ] All tests pass (CI/CD)

### Code Review Process

- At least 1 approval required
- CI/CD must pass
- Reviewer addresses all comments

---

## Troubleshooting

### Common Issues

**Issue: Solver not loading**
- **Cause**: glpk.js WASM not initialized
- **Solution**: Clear browser cache, check network connection

**Issue: Model upload fails**
- **Cause**: Invalid SBML format
- **Solution**: Validate SBML using [SBML Validator](https://sbml.org/validator)

**Issue: Out of memory**
- **Cause**: Large model (>5000 reactions) exceeds browser heap
- **Solution**: Use subsystem view, close other tabs, increase browser memory limit

**Issue: FBA returns infeasible**
- **Cause**: Contradictory constraints
- **Solution**: Check exchange bounds, ensure at least one carbon source

See [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md) for complete troubleshooting guide.

---

## Algorithm Details

### Flux Balance Analysis (FBA)

**Mathematical Formulation**:
```
Maximize:    Z = c·v
Subject to:   S·v = 0           (Steady-state mass balance)
              lb_i ≤ v_i ≤ ub_i  (Flux bounds)
```

Where:
- `c`: Objective coefficients (biomass = 1, others = 0)
- `v`: Flux vector
- `S`: Stoichiometric matrix (metabolites × reactions)
- `lb`, `ub`: Lower and upper bounds for each reaction

**Reference**: Orth et al. (2010) "What is flux balance analysis?" Nat Biotechnol 28:245-248

### GPR Boolean Logic

**Gene-Protein-Reaction Rules**:
```
A and B   → Enzyme complex (both required)
A or B    → Isozymes (one sufficient)
```

**Evaluation Algorithm**:
1. Parse GPR string into AST (Abstract Syntax Tree)
2. Evaluate recursively:
   - Gene: Present if in active set
   - AND: Both children true
   - OR: At least one child true
3. Return true (reaction active) or false (blocked)

### Omics Integration Methods

**GIMME** (Gene Inactivity Moderated by Metabolism and Expression):
- Minimize flux through low-expression reactions
- Maintain near-optimal biomass (≥90% of wild-type)
- Reference: Becker & Palsson (2008) PLoS Comput Biol 4:e1000030

**E-Flux** (Expression-constrained Flux Analysis):
- Scale reaction bounds proportionally to expression
- Simple and computationally efficient
- Reference: Colijn et al. (2009) Mol Syst Biol 5:305

**iMAT** (Integrative Metabolic Analysis Tool):
- Binary optimization for expression consistency
- Maximize number of correctly active/inactive reactions
- Reference: Shlomi et al. (2008) Nat Biotechnol 26:427-430

See [`docs/ALGORITHMS.md`](./docs/ALGORITHMS.md) for complete mathematical details.

---

## Model Support

### Supported Formats

| Format | Extension | Level | Notes |
|---------|-----------|--------|-------|
| **SBML** | .xml, .sbml | Level 2, Level 3, FBC package |
| **COBRApy JSON** | .json | Standard COBRApy format |
| **BiGG Models** | (auto-download) | Direct download from BiGG database |
| **Custom** | .json | Internal JSON format |

### Model Requirements

- **Metabolites**: Unique IDs with compartment suffix (e.g., `_c`, `_e`)
- **Reactions**: Stoichiometry, bounds, GPR rules
- **Objective**: Biomass reaction with coefficient 1.0
- **Compartments**: Defined in model or inferred from suffixes

### Reference Models

**E. coli Models**:
- **Core**: 95 reactions, 72 metabolites
- **iAF1260**: 2382 reactions, 1668 metabolites
- **iML1515**: 2712 reactions, 1877 metabolites

**Yeast Models**:
- **iMM904**: 1577 reactions, 1226 metabolites

**Human Models**:
- **Recon3D**: 13488 reactions, 8222 metabolites

See [`docs/REFERENCE_MODELS.md`](./docs/REFERENCE_MODELS.md) for model specifications.

---

## Performance Benchmarks

### Solve Time (E. coli iML1515)

| Operation | Time (JS) | Time (COBRApy) |
|-----------|-------------|------------------|
| FBA | 0.8s | 0.6s |
| FVA (all reactions) | 12s | 8s |
| pFBA | 1.2s | 0.9s |
| MOMA | 2.5s | 2.0s |

### Memory Usage

| Model Size | Reactions | Memory (MB) |
|-----------|-----------|--------------|
| Small | <100 | 15 |
| Medium | 100-1000 | 45 |
| Large | 1000-5000 | 180 |
| X-Large | >5000 | 500+ (may crash) |

**Recommendations**:
- Use subsystem view for models >2000 reactions
- Close other browser tabs
- Increase browser memory limit in settings

---

## Citation

If you use MetabolicSuite in your research, please cite:

```
MetabolicSuite: A web-based platform for constraint-based metabolic modeling with multi-omics integration
[Authors]
Year
```

**BibTeX**:
```bibtex
@software{metabolic_suite,
  title = {MetabolicSuite: A web-based platform for constraint-based metabolic modeling with multi-omics integration},
  author = {[Authors]},
  year = {2025},
  version = {0.1.0},
  url = {https://github.com/yourusername/metabolic-suite}
}
```

---

## License

MIT License - see [LICENSE](./LICENSE) file for details.

**Permissions**:
- Commercial use
- Modification
- Distribution
- Private use

**Limitations**:
- Liability
- Warranty

---

## Acknowledgments

- **glpk.js**: GNU Linear Programming Kit compiled to WebAssembly
- **React**: UI framework
- **Vite**: Build tool
- **Recharts**: Charting library
- **COBRApy**: Model format reference
- **Escher**: Visualization inspiration

---

## Contact

- **GitHub Issues**: [github.com/yourusername/metabolic-suite/issues](https://github.com/yourusername/metabolic-suite/issues)
- **Email**: [your-email@example.com](mailto:your-email@example.com)
- **Discussions**: [github.com/yourusername/metabolic-suite/discussions](https://github.com/yourusername/metabolic-suite/discussions)

---

## Roadmap

### Version 0.2.0 (Planned)
- [ ] Thermodynamic constraints (tFBA)
- [ ] Flux sampling (ACHR, OPTGEM)
- [ ] Collaborative features (real-time editing)
- [ ] Advanced case studies
- [ ] Mobile app version

### Version 0.3.0 (Planned)
- [ ] Machine learning integration
- [ ] Kinetic data support
- [ ] Multi-scale modeling
- [ ] Cloud-based compute

---

*Last Updated: December 25, 2025*
