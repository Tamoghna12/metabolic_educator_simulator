/**
 * StateManager - Session State Serialization & Sharing
 *
 * Enables reproducibility by capturing and restoring complete session state:
 * - Model (reactions, metabolites, genes)
 * - Constraints (bounds modifications)
 * - Knockouts (gene/reaction deletions)
 * - Simulation results (fluxes, objective values)
 * - Map layout (node positions, visualization settings)
 * - Omics data (expression values, thresholds)
 *
 * Export formats:
 * - .suite JSON file (full state)
 * - Shareable URL (compressed state in URL hash)
 * - Clipboard (for quick sharing)
 *
 * Critical for publication reproducibility:
 * "How can another scientist see exactly what the author saw?"
 *
 * @module StateManager
 */

import pako from 'pako';

// State version for compatibility checking
const STATE_VERSION = '1.0.0';

// Maximum URL length (most browsers support ~2000 chars)
const MAX_URL_LENGTH = 2000;

/**
 * Session state schema
 * @typedef {Object} SessionState
 * @property {string} version - State format version
 * @property {string} timestamp - ISO timestamp of state capture
 * @property {Object} model - Metabolic model
 * @property {Object} constraints - Modified reaction bounds
 * @property {string[]} knockouts - Knocked out reactions
 * @property {Object} simulation - Last simulation results
 * @property {Object} mapLayout - Visualization positions
 * @property {Object} omicsData - Expression/proteomics data
 * @property {Object} settings - User preferences
 */

/**
 * StateManager class
 */
class StateManager {
  constructor() {
    this.currentState = null;
    this.stateHistory = [];
    this.maxHistory = 10;
  }

  /**
   * Capture current session state
   *
   * @param {Object} options - State components to capture
   * @returns {SessionState} Complete session state
   */
  captureState(options = {}) {
    const {
      model = null,
      constraints = {},
      knockouts = [],
      simulation = null,
      mapLayout = null,
      omicsData = null,
      settings = {},
      metadata = {},
    } = options;

    const state = {
      version: STATE_VERSION,
      timestamp: new Date().toISOString(),
      metadata: {
        title: metadata.title || 'Untitled Session',
        description: metadata.description || '',
        author: metadata.author || '',
        tags: metadata.tags || [],
        ...metadata,
      },
      model: this.serializeModel(model),
      constraints: this.serializeConstraints(constraints),
      knockouts: [...knockouts],
      simulation: this.serializeSimulation(simulation),
      mapLayout: this.serializeMapLayout(mapLayout),
      omicsData: this.serializeOmicsData(omicsData),
      settings: { ...settings },
    };

    // Add to history
    this.stateHistory.push({
      timestamp: state.timestamp,
      checksum: this.computeChecksum(state),
    });

    if (this.stateHistory.length > this.maxHistory) {
      this.stateHistory.shift();
    }

    this.currentState = state;
    return state;
  }

  /**
   * Serialize model for state storage
   */
  serializeModel(model) {
    if (!model) return null;

    // Only store essential model data
    return {
      id: model.id || 'model',
      name: model.name || model.id,
      reactions: Object.entries(model.reactions || {}).map(([id, rxn]) => ({
        id,
        name: rxn.name,
        lower_bound: rxn.lower_bound,
        upper_bound: rxn.upper_bound,
        metabolites: rxn.metabolites,
        gene_reaction_rule: rxn.gene_reaction_rule || rxn.gpr,
        objective_coefficient: rxn.objective_coefficient || 0,
        subsystem: rxn.subsystem,
      })),
      metabolites: Object.entries(model.metabolites || {}).map(([id, met]) => ({
        id,
        name: met.name,
        compartment: met.compartment,
        formula: met.formula,
      })),
      genes: Object.entries(model.genes || {}).map(([id, gene]) => ({
        id,
        name: gene.name,
      })),
    };
  }

  /**
   * Serialize constraints
   */
  serializeConstraints(constraints) {
    if (!constraints || Object.keys(constraints).length === 0) return {};

    const serialized = {};
    Object.entries(constraints).forEach(([rxnId, bounds]) => {
      serialized[rxnId] = {
        lower_bound: bounds.lower_bound ?? bounds.lb,
        upper_bound: bounds.upper_bound ?? bounds.ub,
      };
    });
    return serialized;
  }

  /**
   * Serialize simulation results
   */
  serializeSimulation(simulation) {
    if (!simulation) return null;

    return {
      status: simulation.status,
      objectiveValue: simulation.objectiveValue,
      method: simulation.method,
      // Store fluxes compactly (only non-zero)
      fluxes: Object.entries(simulation.fluxes || {})
        .filter(([_, v]) => Math.abs(v) > 1e-10)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: parseFloat(v.toPrecision(8)) }), {}),
      // FVA ranges if present
      ranges: simulation.ranges,
      timestamp: simulation.timestamp || new Date().toISOString(),
    };
  }

  /**
   * Serialize map layout
   */
  serializeMapLayout(layout) {
    if (!layout) return null;

    return {
      nodes: layout.nodes?.map(n => ({
        id: n.id,
        x: parseFloat(n.x?.toPrecision(6) || 0),
        y: parseFloat(n.y?.toPrecision(6) || 0),
        visible: n.visible !== false,
      })),
      edges: layout.edges?.map(e => ({
        id: e.id,
        visible: e.visible !== false,
      })),
      viewport: layout.viewport,
      zoom: layout.zoom,
      center: layout.center,
    };
  }

  /**
   * Serialize omics data
   */
  serializeOmicsData(omicsData) {
    if (!omicsData) return null;

    return {
      type: omicsData.type || 'transcriptomics',
      // Store as array of [gene, value] for compression
      values: Object.entries(omicsData.values || omicsData)
        .map(([k, v]) => [k, parseFloat(v?.toPrecision(6) || 0)]),
      thresholds: omicsData.thresholds,
      normalization: omicsData.normalization,
    };
  }

  /**
   * Restore session from state
   *
   * @param {SessionState} state - State to restore
   * @returns {Object} Parsed state components
   */
  restoreState(state) {
    if (!state) {
      throw new Error('No state provided');
    }

    // Version compatibility check
    if (state.version !== STATE_VERSION) {
      console.warn(`State version mismatch: ${state.version} vs ${STATE_VERSION}`);
      // Attempt migration if needed
      state = this.migrateState(state);
    }

    return {
      model: this.deserializeModel(state.model),
      constraints: state.constraints || {},
      knockouts: state.knockouts || [],
      simulation: state.simulation,
      mapLayout: state.mapLayout,
      omicsData: this.deserializeOmicsData(state.omicsData),
      settings: state.settings || {},
      metadata: state.metadata || {},
    };
  }

  /**
   * Deserialize model
   */
  deserializeModel(modelData) {
    if (!modelData) return null;

    const reactions = {};
    const metabolites = {};
    const genes = {};

    modelData.reactions?.forEach(rxn => {
      reactions[rxn.id] = {
        id: rxn.id,
        name: rxn.name,
        lower_bound: rxn.lower_bound,
        upper_bound: rxn.upper_bound,
        metabolites: rxn.metabolites,
        gene_reaction_rule: rxn.gene_reaction_rule,
        objective_coefficient: rxn.objective_coefficient,
        subsystem: rxn.subsystem,
      };
    });

    modelData.metabolites?.forEach(met => {
      metabolites[met.id] = {
        id: met.id,
        name: met.name,
        compartment: met.compartment,
        formula: met.formula,
      };
    });

    modelData.genes?.forEach(gene => {
      genes[gene.id] = {
        id: gene.id,
        name: gene.name,
      };
    });

    return {
      id: modelData.id,
      name: modelData.name,
      reactions,
      metabolites,
      genes,
    };
  }

  /**
   * Deserialize omics data
   */
  deserializeOmicsData(omicsData) {
    if (!omicsData) return null;

    const values = {};
    omicsData.values?.forEach(([key, value]) => {
      values[key] = value;
    });

    return {
      type: omicsData.type,
      values,
      thresholds: omicsData.thresholds,
      normalization: omicsData.normalization,
    };
  }

  /**
   * Migrate state from older version
   */
  migrateState(state) {
    // Add migration logic as versions evolve
    return state;
  }

  /**
   * Compute checksum for state integrity
   */
  computeChecksum(state) {
    const str = JSON.stringify(state);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Export state to .suite JSON file
   *
   * @param {SessionState} state - State to export
   * @param {string} filename - Output filename
   */
  exportToFile(state, filename = 'session.suite') {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.suite') ? filename : `${filename}.suite`;
    a.click();

    URL.revokeObjectURL(url);
    return true;
  }

  /**
   * Import state from .suite JSON file
   *
   * @param {File} file - File to import
   * @returns {Promise<SessionState>} Parsed state
   */
  async importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const state = JSON.parse(e.target.result);
          if (!state.version) {
            throw new Error('Invalid .suite file: missing version');
          }
          resolve(state);
        } catch (err) {
          reject(new Error(`Failed to parse .suite file: ${err.message}`));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Generate shareable URL with compressed state
   *
   * @param {SessionState} state - State to encode
   * @param {string} baseUrl - Base URL for sharing
   * @returns {string} Shareable URL
   */
  generateShareableUrl(state, baseUrl = window.location.origin) {
    // Create minimal state for URL (large models won't fit)
    const minimalState = this.createMinimalState(state);

    // Compress with pako
    const jsonStr = JSON.stringify(minimalState);
    const compressed = pako.deflate(jsonStr);

    // Base64 encode
    const base64 = btoa(String.fromCharCode.apply(null, compressed));

    // URL-safe encoding
    const urlSafe = base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const url = `${baseUrl}#state=${urlSafe}`;

    if (url.length > MAX_URL_LENGTH) {
      console.warn('State too large for URL sharing, use file export instead');
      return null;
    }

    return url;
  }

  /**
   * Create minimal state for URL sharing
   */
  createMinimalState(state) {
    return {
      v: STATE_VERSION,
      t: state.timestamp,
      // Only include constraints and knockouts (not full model)
      c: state.constraints,
      k: state.knockouts,
      // Include model ID for reference
      m: state.model?.id,
      // Minimal simulation results
      s: state.simulation ? {
        st: state.simulation.status,
        obj: state.simulation.objectiveValue,
        mt: state.simulation.method,
      } : null,
      // Omics thresholds only
      o: state.omicsData?.thresholds,
    };
  }

  /**
   * Parse state from URL hash
   *
   * @param {string} urlHash - URL hash containing state
   * @returns {Object} Parsed minimal state
   */
  parseUrlState(urlHash) {
    if (!urlHash || !urlHash.includes('state=')) {
      return null;
    }

    try {
      // Extract state parameter
      const stateParam = urlHash.split('state=')[1]?.split('&')[0];
      if (!stateParam) return null;

      // URL-safe decode
      const base64 = stateParam
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      // Pad if needed
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);

      // Decode base64
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      // Decompress
      const decompressed = pako.inflate(bytes, { to: 'string' });

      return JSON.parse(decompressed);
    } catch (err) {
      console.error('Failed to parse URL state:', err);
      return null;
    }
  }

  /**
   * Copy state to clipboard as JSON
   *
   * @param {SessionState} state - State to copy
   * @returns {Promise<boolean>} Success status
   */
  async copyToClipboard(state) {
    try {
      const json = JSON.stringify(state, null, 2);
      await navigator.clipboard.writeText(json);
      return true;
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      return false;
    }
  }

  /**
   * Generate reproducibility citation
   *
   * @param {SessionState} state - Session state
   * @returns {string} Citation text
   */
  generateCitation(state) {
    const date = new Date(state.timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const modelName = state.model?.name || 'Unknown Model';
    const checksum = this.computeChecksum(state);

    return `MetabolicSuite Session [${modelName}], captured ${date}. ` +
      `State checksum: ${checksum}. ` +
      `Reproducibility file available in Supplementary Materials.`;
  }

  /**
   * Validate state integrity
   *
   * @param {SessionState} state - State to validate
   * @returns {Object} Validation result
   */
  validateState(state) {
    const errors = [];
    const warnings = [];

    // Check version
    if (!state.version) {
      errors.push('Missing state version');
    }

    // Check model
    if (!state.model) {
      warnings.push('No model in state');
    } else {
      if (!state.model.reactions || state.model.reactions.length === 0) {
        warnings.push('Model has no reactions');
      }
    }

    // Check constraints reference valid reactions
    if (state.constraints && state.model) {
      const rxnIds = new Set(state.model.reactions?.map(r => r.id) || []);
      Object.keys(state.constraints).forEach(cId => {
        if (!rxnIds.has(cId)) {
          warnings.push(`Constraint references unknown reaction: ${cId}`);
        }
      });
    }

    // Check knockouts reference valid reactions
    if (state.knockouts && state.model) {
      const rxnIds = new Set(state.model.reactions?.map(r => r.id) || []);
      state.knockouts.forEach(koId => {
        if (!rxnIds.has(koId)) {
          warnings.push(`Knockout references unknown reaction: ${koId}`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      checksum: this.computeChecksum(state),
    };
  }

  /**
   * Compare two states for differences
   *
   * @param {SessionState} stateA - First state
   * @param {SessionState} stateB - Second state
   * @returns {Object} Difference summary
   */
  compareStates(stateA, stateB) {
    const diff = {
      modelChanged: stateA.model?.id !== stateB.model?.id,
      constraintsChanged: JSON.stringify(stateA.constraints) !== JSON.stringify(stateB.constraints),
      knockoutsChanged: JSON.stringify(stateA.knockouts) !== JSON.stringify(stateB.knockouts),
      simulationChanged: stateA.simulation?.objectiveValue !== stateB.simulation?.objectiveValue,
      omicsChanged: JSON.stringify(stateA.omicsData) !== JSON.stringify(stateB.omicsData),
    };

    diff.anyChange = Object.values(diff).some(v => v === true);
    return diff;
  }
}

// Export singleton instance
export const stateManager = new StateManager();

// Export class for testing
export { StateManager };

export default stateManager;
