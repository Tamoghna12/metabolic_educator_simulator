/**
 * OmicsContext - Multi-omics Data Management
 *
 * Manages transcriptomics, proteomics, and metabolomics data overlays
 * for pathway visualization. Supports multiple conditions/timepoints.
 *
 * Data Types Supported:
 * - Transcriptomics: Gene expression (RNA-seq, microarray)
 * - Proteomics: Protein abundance
 * - Metabolomics: Metabolite concentrations
 * - Fluxomics: Flux measurements (13C-MFA)
 *
 * File Formats:
 * - CSV/TSV with headers
 * - Excel (.xlsx)
 * - JSON (structured)
 *
 * References:
 * - Kuo et al. (2019) Integration of multi-omics data
 * - Blazier & Papin (2012) Integration of expression data in GEMs
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const OmicsContext = createContext(null);

// Supported omics data types
export const OMICS_TYPES = {
  TRANSCRIPTOMICS: 'transcriptomics',
  PROTEOMICS: 'proteomics',
  METABOLOMICS: 'metabolomics',
  FLUXOMICS: 'fluxomics'
};

// Default visualization settings per omics type
const DEFAULT_VIS_SETTINGS = {
  [OMICS_TYPES.TRANSCRIPTOMICS]: {
    enabled: true,
    target: 'edge',           // edges (reactions via GPR)
    property: 'color',        // color, width, opacity
    colorScale: 'diverging',  // diverging (up/down), sequential, categorical
    colorScheme: 'RdBu',      // Red-Blue for up/down regulation
    logTransform: true,
    centerValue: 0,           // For log2FC, center at 0
    minValue: -4,
    maxValue: 4
  },
  [OMICS_TYPES.PROTEOMICS]: {
    enabled: true,
    target: 'edge',
    property: 'width',
    colorScale: 'sequential',
    colorScheme: 'Blues',
    logTransform: true,
    centerValue: null,
    minValue: 0,
    maxValue: null  // Auto-scale
  },
  [OMICS_TYPES.METABOLOMICS]: {
    enabled: true,
    target: 'node',           // nodes (metabolites)
    property: 'size',
    colorScale: 'diverging',
    colorScheme: 'PuOr',      // Purple-Orange
    logTransform: true,
    centerValue: 0,
    minValue: -3,
    maxValue: 3
  },
  [OMICS_TYPES.FLUXOMICS]: {
    enabled: true,
    target: 'edge',
    property: 'animation',    // Animation speed/direction
    colorScale: 'diverging',
    colorScheme: 'BrBG',
    logTransform: false,
    centerValue: 0,
    minValue: null,
    maxValue: null
  }
};

// Parse CSV/TSV content
const parseDelimitedText = (content, delimiter = ',') => {
  const lines = content.trim().split('\n');
  if (lines.length < 2) throw new Error('File must have header and at least one data row');

  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
    if (values.length !== headers.length) continue;

    const row = {};
    headers.forEach((h, idx) => {
      const val = values[idx];
      // Try to parse as number
      const num = parseFloat(val);
      row[h] = isNaN(num) ? val : num;
    });
    data.push(row);
  }

  return { headers, data };
};

// Detect ID column (gene, protein, metabolite identifiers)
const detectIdColumn = (headers, omicsType) => {
  const patterns = {
    [OMICS_TYPES.TRANSCRIPTOMICS]: [/gene/i, /locus/i, /id/i, /name/i, /symbol/i],
    [OMICS_TYPES.PROTEOMICS]: [/protein/i, /gene/i, /uniprot/i, /id/i, /accession/i],
    [OMICS_TYPES.METABOLOMICS]: [/metabolite/i, /compound/i, /id/i, /name/i, /kegg/i, /bigg/i],
    [OMICS_TYPES.FLUXOMICS]: [/reaction/i, /flux/i, /id/i, /name/i]
  };

  const typePatterns = patterns[omicsType] || [/id/i, /name/i];

  for (const pattern of typePatterns) {
    const match = headers.find(h => pattern.test(h));
    if (match) return match;
  }

  return headers[0]; // Default to first column
};

// Detect value columns (numeric data)
const detectValueColumns = (headers, data, idColumn) => {
  return headers.filter(h => {
    if (h === idColumn) return false;
    // Check if column has numeric values
    const hasNumeric = data.some(row => typeof row[h] === 'number' && !isNaN(row[h]));
    return hasNumeric;
  });
};

// Normalize data
export const normalizeData = (values, method = 'zscore') => {
  const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (numericValues.length === 0) return values;

  switch (method) {
    case 'zscore': {
      const mean = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
      const std = Math.sqrt(
        numericValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / numericValues.length
      );
      return values.map(v => typeof v === 'number' ? (v - mean) / (std || 1) : v);
    }
    case 'minmax': {
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);
      const range = max - min || 1;
      return values.map(v => typeof v === 'number' ? (v - min) / range : v);
    }
    case 'log2': {
      return values.map(v => typeof v === 'number' && v > 0 ? Math.log2(v) : v);
    }
    case 'log2fc': {
      // Assumes data is already fold-change, just log2 transform
      return values.map(v => typeof v === 'number' && v > 0 ? Math.log2(v) : v);
    }
    case 'none':
    default:
      return values;
  }
};

// Calculate statistics for a dataset
const calculateStats = (data, valueColumns) => {
  const allValues = [];
  valueColumns.forEach(col => {
    data.forEach(row => {
      if (typeof row[col] === 'number' && !isNaN(row[col])) {
        allValues.push(row[col]);
      }
    });
  });

  if (allValues.length === 0) return null;

  allValues.sort((a, b) => a - b);
  const n = allValues.length;

  return {
    min: allValues[0],
    max: allValues[n - 1],
    mean: allValues.reduce((a, b) => a + b, 0) / n,
    median: n % 2 === 0 ? (allValues[n/2 - 1] + allValues[n/2]) / 2 : allValues[Math.floor(n/2)],
    q1: allValues[Math.floor(n * 0.25)],
    q3: allValues[Math.floor(n * 0.75)],
    std: Math.sqrt(allValues.reduce((sum, v) => sum + Math.pow(v - allValues.reduce((a, b) => a + b, 0) / n, 2), 0) / n),
    count: n
  };
};

export const OmicsProvider = ({ children }) => {
  // Stored datasets
  const [datasets, setDatasets] = useState({
    [OMICS_TYPES.TRANSCRIPTOMICS]: null,
    [OMICS_TYPES.PROTEOMICS]: null,
    [OMICS_TYPES.METABOLOMICS]: null,
    [OMICS_TYPES.FLUXOMICS]: null
  });

  // Visualization settings per omics type
  const [visSettings, setVisSettings] = useState({ ...DEFAULT_VIS_SETTINGS });

  // Currently selected condition (for multi-condition data)
  const [selectedCondition, setSelectedCondition] = useState({
    [OMICS_TYPES.TRANSCRIPTOMICS]: null,
    [OMICS_TYPES.PROTEOMICS]: null,
    [OMICS_TYPES.METABOLOMICS]: null,
    [OMICS_TYPES.FLUXOMICS]: null
  });

  // Loading/error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load omics data from file
  const loadOmicsData = useCallback(async (file, omicsType, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const content = await file.text();
      const fileName = file.name.toLowerCase();

      let parsed;
      if (fileName.endsWith('.csv')) {
        parsed = parseDelimitedText(content, ',');
      } else if (fileName.endsWith('.tsv') || fileName.endsWith('.txt')) {
        parsed = parseDelimitedText(content, '\t');
      } else if (fileName.endsWith('.json')) {
        const json = JSON.parse(content);
        if (Array.isArray(json)) {
          parsed = { headers: Object.keys(json[0] || {}), data: json };
        } else {
          throw new Error('JSON must be an array of objects');
        }
      } else {
        throw new Error('Unsupported file format. Use CSV, TSV, or JSON.');
      }

      // Detect columns
      const idColumn = options.idColumn || detectIdColumn(parsed.headers, omicsType);
      const valueColumns = options.valueColumns || detectValueColumns(parsed.headers, parsed.data, idColumn);

      if (valueColumns.length === 0) {
        throw new Error('No numeric value columns detected');
      }

      // Build indexed data
      const indexed = {};
      parsed.data.forEach(row => {
        const id = String(row[idColumn]).trim();
        if (id) {
          indexed[id] = {};
          valueColumns.forEach(col => {
            indexed[id][col] = row[col];
          });
        }
      });

      // Calculate statistics
      const stats = calculateStats(parsed.data, valueColumns);

      const dataset = {
        fileName: file.name,
        omicsType,
        idColumn,
        valueColumns,
        conditions: valueColumns, // Each value column is a condition
        data: indexed,
        rawData: parsed.data,
        headers: parsed.headers,
        stats,
        loadedAt: new Date().toISOString()
      };

      setDatasets(prev => ({ ...prev, [omicsType]: dataset }));
      setSelectedCondition(prev => ({
        ...prev,
        [omicsType]: valueColumns[0] // Select first condition
      }));

      setLoading(false);
      return dataset;
    } catch (err) {
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);

  // Load from JSON object (for programmatic use)
  const loadOmicsFromObject = useCallback((data, omicsType, idField, valueFields) => {
    const indexed = {};
    data.forEach(row => {
      const id = String(row[idField]).trim();
      if (id) {
        indexed[id] = {};
        valueFields.forEach(field => {
          indexed[id][field] = row[field];
        });
      }
    });

    const stats = calculateStats(data, valueFields);

    const dataset = {
      fileName: 'programmatic',
      omicsType,
      idColumn: idField,
      valueColumns: valueFields,
      conditions: valueFields,
      data: indexed,
      rawData: data,
      headers: [idField, ...valueFields],
      stats,
      loadedAt: new Date().toISOString()
    };

    setDatasets(prev => ({ ...prev, [omicsType]: dataset }));
    setSelectedCondition(prev => ({ ...prev, [omicsType]: valueFields[0] }));

    return dataset;
  }, []);

  // Remove dataset
  const removeDataset = useCallback((omicsType) => {
    setDatasets(prev => ({ ...prev, [omicsType]: null }));
    setSelectedCondition(prev => ({ ...prev, [omicsType]: null }));
  }, []);

  // Update visualization settings
  const updateVisSettings = useCallback((omicsType, updates) => {
    setVisSettings(prev => ({
      ...prev,
      [omicsType]: { ...prev[omicsType], ...updates }
    }));
  }, []);

  // Get value for a specific ID and omics type
  const getValue = useCallback((id, omicsType, condition = null) => {
    const dataset = datasets[omicsType];
    if (!dataset) return null;

    const cond = condition || selectedCondition[omicsType];
    if (!cond) return null;

    // Try exact match first
    if (dataset.data[id]) {
      return dataset.data[id][cond];
    }

    // Try case-insensitive match
    const lowerID = id.toLowerCase();
    for (const key of Object.keys(dataset.data)) {
      if (key.toLowerCase() === lowerID) {
        return dataset.data[key][cond];
      }
    }

    return null;
  }, [datasets, selectedCondition]);

  // Get all values for visualization
  const getVisualizationData = useCallback((ids, omicsType, condition = null) => {
    const dataset = datasets[omicsType];
    if (!dataset) return null;

    const cond = condition || selectedCondition[omicsType];
    const settings = visSettings[omicsType];

    const result = {};
    ids.forEach(id => {
      let value = getValue(id, omicsType, cond);
      if (value === null || value === undefined) return;

      // Apply log transform if enabled
      if (settings.logTransform && typeof value === 'number' && value > 0) {
        value = Math.log2(value);
      }

      result[id] = value;
    });

    return result;
  }, [datasets, selectedCondition, visSettings, getValue]);

  // Compute combined visualization properties for an element
  const getElementStyle = useCallback((id, elementType) => {
    const style = {
      color: null,
      width: null,
      size: null,
      opacity: null,
      animation: null
    };

    Object.values(OMICS_TYPES).forEach(omicsType => {
      const settings = visSettings[omicsType];
      if (!settings.enabled) return;
      if (settings.target !== elementType) return;

      const value = getValue(id, omicsType);
      if (value === null || value === undefined) return;

      let normalizedValue = value;
      if (settings.logTransform && typeof value === 'number' && value > 0) {
        normalizedValue = Math.log2(value);
      }

      // Apply to the appropriate property
      switch (settings.property) {
        case 'color':
          style.color = { value: normalizedValue, settings };
          break;
        case 'width':
          style.width = { value: normalizedValue, settings };
          break;
        case 'size':
          style.size = { value: normalizedValue, settings };
          break;
        case 'opacity':
          style.opacity = { value: normalizedValue, settings };
          break;
        case 'animation':
          style.animation = { value: normalizedValue, settings };
          break;
      }
    });

    return style;
  }, [visSettings, getValue]);

  // Summary of loaded data
  const summary = useMemo(() => {
    const loaded = [];
    Object.entries(datasets).forEach(([type, dataset]) => {
      if (dataset) {
        loaded.push({
          type,
          fileName: dataset.fileName,
          conditions: dataset.conditions.length,
          entries: Object.keys(dataset.data).length,
          stats: dataset.stats
        });
      }
    });
    return loaded;
  }, [datasets]);

  const value = {
    // Data
    datasets,
    selectedCondition,
    visSettings,
    summary,
    loading,
    error,

    // Actions
    loadOmicsData,
    loadOmicsFromObject,
    removeDataset,
    setSelectedCondition,
    updateVisSettings,

    // Getters
    getValue,
    getVisualizationData,
    getElementStyle,

    // Constants
    OMICS_TYPES
  };

  return (
    <OmicsContext.Provider value={value}>
      {children}
    </OmicsContext.Provider>
  );
};

export const useOmics = () => {
  const context = useContext(OmicsContext);
  if (!context) {
    throw new Error('useOmics must be used within an OmicsProvider');
  }
  return context;
};

export default OmicsContext;
