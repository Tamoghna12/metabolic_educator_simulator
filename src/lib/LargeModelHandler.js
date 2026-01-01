/**
 * LargeModelHandler - Genome-Scale Model Performance Optimization
 *
 * Addresses the "Recon3D Problem": genome-scale human models (10k+ reactions)
 * can crash or freeze browser-based visualizations.
 *
 * Strategies:
 * 1. Subsystem filtering - Focus on pathways of interest
 * 2. Hub metabolite removal - Remove cofactors for cleaner graphs
 * 3. Progressive rendering - Load visible elements first
 * 4. Downsampling - Reduce complexity for overview
 * 5. FVA chunking - Split expensive operations
 *
 * Reference:
 * - Brunk et al. (2018) "Recon3D enables a three-dimensional view of
 *   gene variation in human metabolism" Nat Biotechnol
 *
 * @module LargeModelHandler
 */

// Thresholds for model size categories
const MODEL_SIZE = {
  SMALL: 500,     // <500 reactions: full visualization
  MEDIUM: 2000,   // 500-2000: selective rendering
  LARGE: 5000,    // 2000-5000: subsystem focus
  GENOME_SCALE: Infinity,  // >5000: aggressive downsampling
};

// Hub metabolites to filter for cleaner visualization
const HUB_METABOLITES = new Set([
  'h_c', 'h_e', 'h_m', 'h_x', 'h_r', 'h_n', 'h_g', 'h_l',  // Protons
  'h2o_c', 'h2o_e', 'h2o_m', 'h2o_x', 'h2o_r', 'h2o_n',    // Water
  'atp_c', 'atp_m', 'adp_c', 'adp_m', 'amp_c',              // ATP cycle
  'nad_c', 'nad_m', 'nadh_c', 'nadh_m',                     // NAD+/NADH
  'nadp_c', 'nadp_m', 'nadph_c', 'nadph_m',                 // NADP+/NADPH
  'coa_c', 'coa_m',                                          // CoA
  'pi_c', 'pi_m', 'ppi_c', 'ppi_m',                          // Phosphate
  'co2_c', 'co2_e', 'co2_m',                                 // CO2
  'o2_c', 'o2_e', 'o2_m',                                    // O2
  'nh4_c', 'nh4_e',                                          // Ammonium
]);

// Common subsystems for filtering
const CORE_SUBSYSTEMS = [
  'Glycolysis/Gluconeogenesis',
  'Citric acid cycle',
  'Pentose phosphate pathway',
  'Fatty acid biosynthesis',
  'Fatty acid oxidation',
  'Amino acid metabolism',
  'Nucleotide metabolism',
  'Oxidative phosphorylation',
];

/**
 * LargeModelHandler class
 */
class LargeModelHandler {
  constructor() {
    this.originalModel = null;
    this.filteredModel = null;
    this.viewMode = 'full';
    this.activeSubsystems = new Set();
    this.hiddenMetabolites = new Set(HUB_METABOLITES);
  }

  /**
   * Analyze model and determine optimal handling strategy
   *
   * @param {Object} model - Metabolic model
   * @returns {Object} Analysis result with recommendations
   */
  analyzeModel(model) {
    const numReactions = Object.keys(model.reactions || {}).length;
    const numMetabolites = Object.keys(model.metabolites || {}).length;
    const numGenes = Object.keys(model.genes || {}).length;

    // Collect subsystems
    const subsystems = new Set();
    Object.values(model.reactions || {}).forEach(rxn => {
      if (rxn.subsystem) {
        subsystems.add(rxn.subsystem);
      }
    });

    // Determine size category
    let sizeCategory;
    if (numReactions < MODEL_SIZE.SMALL) {
      sizeCategory = 'small';
    } else if (numReactions < MODEL_SIZE.MEDIUM) {
      sizeCategory = 'medium';
    } else if (numReactions < MODEL_SIZE.LARGE) {
      sizeCategory = 'large';
    } else {
      sizeCategory = 'genome-scale';
    }

    // Generate recommendations
    const recommendations = [];

    if (sizeCategory === 'genome-scale') {
      recommendations.push({
        type: 'critical',
        message: 'Genome-scale model detected. Enable subsystem filtering for visualization.',
        action: 'filterBySubsystem',
      });
      recommendations.push({
        type: 'warning',
        message: 'FVA will require chunking (2×n LP solves).',
        action: 'useFvaChunking',
      });
    }

    if (sizeCategory === 'large') {
      recommendations.push({
        type: 'info',
        message: 'Large model. Consider hiding hub metabolites.',
        action: 'hideHubMetabolites',
      });
    }

    if (numReactions > 1500) {
      recommendations.push({
        type: 'info',
        message: 'Consider using Python backend for faster solving.',
        action: 'useBackend',
      });
    }

    return {
      numReactions,
      numMetabolites,
      numGenes,
      numSubsystems: subsystems.size,
      subsystems: Array.from(subsystems).sort(),
      sizeCategory,
      recommendations,
      estimatedFvaTime: this.estimateFvaTime(numReactions),
      memoryEstimate: this.estimateMemory(numReactions, numMetabolites),
    };
  }

  /**
   * Estimate FVA computation time
   */
  estimateFvaTime(numReactions) {
    // Rough estimate: ~10ms per reaction pair (min/max)
    const seconds = (numReactions * 2 * 10) / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(0)} seconds`;
    } else if (seconds < 3600) {
      return `${(seconds / 60).toFixed(1)} minutes`;
    } else {
      return `${(seconds / 3600).toFixed(1)} hours`;
    }
  }

  /**
   * Estimate memory usage
   */
  estimateMemory(numReactions, numMetabolites) {
    // Rough estimate: ~1KB per reaction, ~0.5KB per metabolite
    const bytes = numReactions * 1024 + numMetabolites * 512;
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  /**
   * Filter model by subsystems
   *
   * @param {Object} model - Full model
   * @param {string[]} subsystems - Subsystems to include
   * @returns {Object} Filtered model
   */
  filterBySubsystem(model, subsystems) {
    const subsystemSet = new Set(subsystems);

    // Filter reactions
    const filteredReactions = {};
    const involvedMetabolites = new Set();

    Object.entries(model.reactions || {}).forEach(([rxnId, rxn]) => {
      if (subsystemSet.has(rxn.subsystem)) {
        filteredReactions[rxnId] = rxn;

        // Track metabolites
        Object.keys(rxn.metabolites || {}).forEach(metId => {
          involvedMetabolites.add(metId);
        });
      }
    });

    // Filter metabolites
    const filteredMetabolites = {};
    Object.entries(model.metabolites || {}).forEach(([metId, met]) => {
      if (involvedMetabolites.has(metId)) {
        filteredMetabolites[metId] = met;
      }
    });

    // Filter genes (extract from GPR rules)
    const involvedGenes = new Set();
    Object.values(filteredReactions).forEach(rxn => {
      const gpr = rxn.gene_reaction_rule || rxn.gpr || '';
      const geneMatches = gpr.match(/[A-Za-z0-9_]+/g) || [];
      geneMatches.forEach(g => {
        if (model.genes?.[g]) {
          involvedGenes.add(g);
        }
      });
    });

    const filteredGenes = {};
    Object.entries(model.genes || {}).forEach(([geneId, gene]) => {
      if (involvedGenes.has(geneId)) {
        filteredGenes[geneId] = gene;
      }
    });

    this.filteredModel = {
      id: model.id,
      name: `${model.name} (${subsystems.join(', ')})`,
      reactions: filteredReactions,
      metabolites: filteredMetabolites,
      genes: filteredGenes,
      _isFiltered: true,
      _originalSize: Object.keys(model.reactions || {}).length,
      _filteredSubsystems: subsystems,
    };

    return this.filteredModel;
  }

  /**
   * Remove hub metabolites from visualization
   *
   * @param {Object} layout - Map layout
   * @returns {Object} Filtered layout
   */
  removeHubMetabolites(layout) {
    if (!layout) return null;

    const filteredNodes = layout.nodes?.filter(node => {
      const id = node.biggId || node.id;
      return !this.hiddenMetabolites.has(id);
    });

    // Filter edges connected to hub metabolites
    const visibleNodeIds = new Set(filteredNodes?.map(n => n.id));
    const filteredEdges = layout.edges?.filter(edge => {
      return visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to);
    });

    return {
      ...layout,
      nodes: filteredNodes,
      edges: filteredEdges,
      _hubsRemoved: true,
    };
  }

  /**
   * Downsample model for overview visualization
   *
   * Strategy: Keep most "important" reactions based on:
   * - Biomass objective
   * - Exchange reactions
   * - High-flux reactions (if simulation available)
   * - Random sample from remaining
   *
   * @param {Object} model - Full model
   * @param {number} targetSize - Target number of reactions
   * @param {Object} fluxes - Optional flux data for importance ranking
   * @returns {Object} Downsampled model
   */
  downsample(model, targetSize = 500, fluxes = null) {
    const reactions = Object.entries(model.reactions || {});

    if (reactions.length <= targetSize) {
      return model;
    }

    // Priority categories
    const biomass = [];
    const exchange = [];
    const transport = [];
    const highFlux = [];
    const remaining = [];

    reactions.forEach(([rxnId, rxn]) => {
      // Biomass
      if (rxn.objective_coefficient && rxn.objective_coefficient !== 0) {
        biomass.push([rxnId, rxn]);
        return;
      }

      // Exchange (EX_ prefix or single metabolite)
      if (rxnId.startsWith('EX_') || Object.keys(rxn.metabolites || {}).length === 1) {
        exchange.push([rxnId, rxn]);
        return;
      }

      // Transport (contains compartment transfer)
      const mets = Object.keys(rxn.metabolites || {});
      const compartments = new Set(mets.map(m => m.split('_').pop()));
      if (compartments.size > 1) {
        transport.push([rxnId, rxn]);
        return;
      }

      // High flux (if available)
      if (fluxes && Math.abs(fluxes[rxnId] || 0) > 0.1) {
        highFlux.push([rxnId, rxn]);
        return;
      }

      remaining.push([rxnId, rxn]);
    });

    // Build downsampled set
    const selected = [];
    let budget = targetSize;

    // Always include biomass
    biomass.forEach(r => {
      if (budget > 0) {
        selected.push(r);
        budget--;
      }
    });

    // Include exchanges (up to 20%)
    const exchangeBudget = Math.min(exchange.length, Math.floor(targetSize * 0.2));
    exchange.slice(0, exchangeBudget).forEach(r => {
      if (budget > 0) {
        selected.push(r);
        budget--;
      }
    });

    // Include transport (up to 10%)
    const transportBudget = Math.min(transport.length, Math.floor(targetSize * 0.1));
    transport.slice(0, transportBudget).forEach(r => {
      if (budget > 0) {
        selected.push(r);
        budget--;
      }
    });

    // Include high flux
    highFlux.forEach(r => {
      if (budget > 0) {
        selected.push(r);
        budget--;
      }
    });

    // Random sample from remaining
    const shuffled = remaining.sort(() => Math.random() - 0.5);
    shuffled.slice(0, budget).forEach(r => {
      selected.push(r);
    });

    // Build downsampled model
    const downsampledReactions = {};
    const involvedMetabolites = new Set();

    selected.forEach(([rxnId, rxn]) => {
      downsampledReactions[rxnId] = rxn;
      Object.keys(rxn.metabolites || {}).forEach(m => involvedMetabolites.add(m));
    });

    const downsampledMetabolites = {};
    Object.entries(model.metabolites || {}).forEach(([metId, met]) => {
      if (involvedMetabolites.has(metId)) {
        downsampledMetabolites[metId] = met;
      }
    });

    return {
      id: model.id,
      name: `${model.name} (downsampled)`,
      reactions: downsampledReactions,
      metabolites: downsampledMetabolites,
      genes: model.genes,
      _isDownsampled: true,
      _originalSize: reactions.length,
      _downsampledSize: selected.length,
    };
  }

  /**
   * Chunk FVA computation for progress updates
   *
   * @param {Object} model - Model to analyze
   * @param {number} chunkSize - Reactions per chunk
   * @param {Function} onProgress - Progress callback
   * @returns {AsyncGenerator} Yields partial results
   */
  async *chunkFva(model, solver, options = {}) {
    const {
      chunkSize = 50,
      fractionOfOptimum = 0.9,
      onProgress,
    } = options;

    const reactions = Object.keys(model.reactions || {});
    const total = reactions.length;
    const ranges = {};

    for (let i = 0; i < total; i += chunkSize) {
      const chunk = reactions.slice(i, i + chunkSize);

      // Solve chunk
      const chunkResult = await solver.solveFVA(model, {
        reactions: chunk,
        fractionOfOptimum,
      });

      // Merge results
      Object.assign(ranges, chunkResult.ranges);

      // Progress update
      const progress = Math.min((i + chunkSize) / total, 1);
      onProgress?.({
        current: Math.min(i + chunkSize, total),
        total,
        progress,
        completed: Object.keys(ranges).length,
      });

      // Yield partial result
      yield {
        progress,
        ranges: { ...ranges },
        complete: i + chunkSize >= total,
      };

      // Allow UI to update
      await new Promise(r => setTimeout(r, 0));
    }

    return { ranges, complete: true };
  }

  /**
   * Get visualization recommendations for current model
   */
  getVisualizationSettings(analysis) {
    switch (analysis.sizeCategory) {
      case 'small':
        return {
          showAllNodes: true,
          showAllEdges: true,
          showLabels: true,
          nodeSize: 'normal',
          renderMode: 'full',
          maxNodes: Infinity,
        };

      case 'medium':
        return {
          showAllNodes: true,
          showAllEdges: true,
          showLabels: true,
          nodeSize: 'normal',
          renderMode: 'full',
          maxNodes: Infinity,
        };

      case 'large':
        return {
          showAllNodes: true,
          showAllEdges: true,
          showLabels: false, // Labels off by default
          nodeSize: 'small',
          renderMode: 'progressive',
          maxNodes: 2000,
          hideHubs: true,
        };

      case 'genome-scale':
        return {
          showAllNodes: false,
          showAllEdges: false,
          showLabels: false,
          nodeSize: 'tiny',
          renderMode: 'subsystem',
          maxNodes: 500,
          hideHubs: true,
          requireSubsystemFilter: true,
        };

      default:
        return {
          showAllNodes: true,
          showAllEdges: true,
          showLabels: true,
          nodeSize: 'normal',
          renderMode: 'full',
        };
    }
  }

  /**
   * Get core subsystems for quick filtering
   */
  getCoreSubsystems() {
    return CORE_SUBSYSTEMS;
  }

  /**
   * Get hub metabolites list
   */
  getHubMetabolites() {
    return Array.from(HUB_METABOLITES);
  }

  /**
   * Toggle hub metabolite visibility
   */
  toggleHubMetabolite(metId) {
    if (this.hiddenMetabolites.has(metId)) {
      this.hiddenMetabolites.delete(metId);
    } else {
      this.hiddenMetabolites.add(metId);
    }
    return this.hiddenMetabolites;
  }
}

// Export singleton
export const largeModelHandler = new LargeModelHandler();

// Export class for testing
export { LargeModelHandler };

// Export constants
export { MODEL_SIZE, HUB_METABOLITES, CORE_SUBSYSTEMS };

export default largeModelHandler;
