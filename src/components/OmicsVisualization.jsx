/**
 * OmicsVisualization - Integrated Multi-Omics Network Visualization
 *
 * Features:
 * - Dynamic network from model data (not static)
 * - Flux overlay from FBA/omics integration results
 * - Expression overlay on edges (GPR-mapped)
 * - Data validation feedback (matched/unmatched IDs)
 * - Export to CSV, JSON, PNG
 * - Color legends and scale bars
 *
 * @module OmicsVisualization
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useModel } from '../contexts/ModelContext';
import { useOmics, OMICS_TYPES } from '../contexts/OmicsContext';
import { useTheme } from '../contexts/ThemeContext';
import { gprToReactionExpression } from '../lib/OmicsIntegration';

// Color scales for different data types
const COLOR_SCALES = {
  flux: {
    positive: ['#f0fdf4', '#86efac', '#22c55e', '#15803d'], // Green gradient
    negative: ['#fef2f2', '#fca5a5', '#ef4444', '#b91c1c'], // Red gradient
    zero: '#e5e7eb'
  },
  expression: {
    low: '#3b82f6',      // Blue (downregulated)
    medium: '#f5f5f5',   // Neutral
    high: '#ef4444'      // Red (upregulated)
  },
  validation: {
    matched: '#22c55e',
    unmatched: '#f59e0b',
    missing: '#ef4444'
  }
};

/**
 * Data Validation Panel - Shows ID mapping statistics
 */
const DataValidationPanel = ({ model, expressionData, onExport }) => {
  const validationStats = useMemo(() => {
    if (!model?.genes || !expressionData) {
      return { matched: 0, unmatched: 0, total: 0, modelGenes: 0, coverage: 0 };
    }

    const modelGeneIds = new Set(Object.keys(model.genes));
    const expressionGeneIds = new Set(expressionData.keys());

    let matched = 0;
    let unmatched = 0;
    const unmatchedList = [];

    expressionGeneIds.forEach(geneId => {
      if (modelGeneIds.has(geneId)) {
        matched++;
      } else {
        unmatched++;
        if (unmatchedList.length < 10) unmatchedList.push(geneId);
      }
    });

    return {
      matched,
      unmatched,
      total: expressionGeneIds.size,
      modelGenes: modelGeneIds.size,
      coverage: modelGeneIds.size > 0 ? (matched / modelGeneIds.size * 100).toFixed(1) : 0,
      unmatchedList
    };
  }, [model, expressionData]);

  if (!expressionData) return null;

  return (
    <div className="p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-[var(--text-primary)]">Data Validation</h4>
        <button
          onClick={() => onExport?.('validation')}
          className="text-xs text-[var(--primary)] hover:underline"
        >
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3 text-center">
        <div className="p-2 bg-[var(--success-bg)] rounded">
          <p className="text-lg font-bold text-[var(--success-text)]">{validationStats.matched}</p>
          <p className="text-xs text-[var(--text-muted)]">Matched</p>
        </div>
        <div className="p-2 bg-[var(--warning-bg)] rounded">
          <p className="text-lg font-bold text-[var(--warning-text)]">{validationStats.unmatched}</p>
          <p className="text-xs text-[var(--text-muted)]">Unmatched</p>
        </div>
        <div className="p-2 bg-[var(--bg-primary)] rounded">
          <p className="text-lg font-bold">{validationStats.modelGenes}</p>
          <p className="text-xs text-[var(--text-muted)]">Model Genes</p>
        </div>
        <div className="p-2 bg-[var(--info-bg)] rounded">
          <p className="text-lg font-bold text-[var(--info-text)]">{validationStats.coverage}%</p>
          <p className="text-xs text-[var(--text-muted)]">Coverage</p>
        </div>
      </div>

      {validationStats.unmatched > 0 && validationStats.unmatchedList.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-[var(--warning-text)]">
            Show unmatched IDs ({validationStats.unmatched})
          </summary>
          <div className="mt-2 p-2 bg-[var(--bg-primary)] rounded font-mono">
            {validationStats.unmatchedList.join(', ')}
            {validationStats.unmatched > 10 && <span className="text-[var(--text-muted)]"> ... and {validationStats.unmatched - 10} more</span>}
          </div>
        </details>
      )}
    </div>
  );
};

/**
 * Color Legend Component
 */
const ColorLegend = ({ type, title, min, max }) => {
  const gradientId = `legend-gradient-${type}`;

  const getGradient = () => {
    if (type === 'flux') {
      return (
        <>
          <stop offset="0%" stopColor={COLOR_SCALES.flux.negative[3]} />
          <stop offset="25%" stopColor={COLOR_SCALES.flux.negative[1]} />
          <stop offset="50%" stopColor={COLOR_SCALES.flux.zero} />
          <stop offset="75%" stopColor={COLOR_SCALES.flux.positive[1]} />
          <stop offset="100%" stopColor={COLOR_SCALES.flux.positive[3]} />
        </>
      );
    }
    return (
      <>
        <stop offset="0%" stopColor={COLOR_SCALES.expression.low} />
        <stop offset="50%" stopColor={COLOR_SCALES.expression.medium} />
        <stop offset="100%" stopColor={COLOR_SCALES.expression.high} />
      </>
    );
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--text-muted)]">{title}:</span>
      <div className="flex items-center gap-1">
        <span className="text-xs font-mono">{min?.toFixed(1) || '0'}</span>
        <svg width="80" height="12">
          <defs>
            <linearGradient id={gradientId}>{getGradient()}</linearGradient>
          </defs>
          <rect x="0" y="2" width="80" height="8" rx="2" fill={`url(#${gradientId})`} />
        </svg>
        <span className="text-xs font-mono">{max?.toFixed(1) || '1'}</span>
      </div>
    </div>
  );
};

/**
 * Export Panel Component
 */
const ExportPanel = ({ onExport }) => (
  <div className="flex gap-2">
    <button
      onClick={() => onExport('csv')}
      className="px-3 py-1.5 text-xs bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded transition-colors"
    >
      Export CSV
    </button>
    <button
      onClick={() => onExport('json')}
      className="px-3 py-1.5 text-xs bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded transition-colors"
    >
      Export JSON
    </button>
    <button
      onClick={() => onExport('png')}
      className="px-3 py-1.5 text-xs bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] rounded transition-colors"
    >
      Export PNG
    </button>
  </div>
);

/**
 * Network Node Component
 */
const NetworkNode = ({ node, x, y, radius, color, expression, isHighlighted, onHover, onClick }) => {
  const strokeWidth = isHighlighted ? 3 : 1.5;
  const strokeColor = isHighlighted ? 'var(--primary)' : 'var(--border-color)';

  return (
    <g
      className="cursor-pointer transition-opacity"
      opacity={isHighlighted === false ? 0.3 : 1}
      onMouseEnter={() => onHover?.(node)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onClick?.(node)}
    >
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={color}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      {expression !== undefined && (
        <circle
          cx={x + radius - 4}
          cy={y - radius + 4}
          r={6}
          fill={expression > 0.5 ? COLOR_SCALES.expression.high : COLOR_SCALES.expression.low}
          stroke="white"
          strokeWidth={1}
        />
      )}
      <text
        x={x}
        y={y + radius + 12}
        textAnchor="middle"
        className="text-[10px] fill-[var(--text-primary)] font-medium pointer-events-none"
      >
        {node.label || node.id}
      </text>
    </g>
  );
};

/**
 * Network Edge Component
 */
const NetworkEdge = ({ edge, fromX, fromY, toX, toY, flux, expression, isHighlighted, onHover }) => {
  // Calculate edge color based on flux
  const getFluxColor = () => {
    if (flux === undefined || flux === null) return 'var(--border-color)';
    if (Math.abs(flux) < 0.001) return COLOR_SCALES.flux.zero;

    const intensity = Math.min(Math.abs(flux) / 10, 1);
    const idx = Math.floor(intensity * 3);

    if (flux > 0) return COLOR_SCALES.flux.positive[idx];
    return COLOR_SCALES.flux.negative[idx];
  };

  // Calculate edge width based on flux magnitude
  const getEdgeWidth = () => {
    if (flux === undefined) return 1.5;
    return Math.max(1, Math.min(Math.abs(flux) / 2, 8));
  };

  // Calculate arrow position
  const angle = Math.atan2(toY - fromY, toX - fromX);
  const nodeRadius = 15;
  const endX = toX - Math.cos(angle) * nodeRadius;
  const endY = toY - Math.sin(angle) * nodeRadius;
  const startX = fromX + Math.cos(angle) * nodeRadius;
  const startY = fromY + Math.sin(angle) * nodeRadius;

  // Midpoint for label
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  return (
    <g
      className="transition-opacity"
      opacity={isHighlighted === false ? 0.2 : 1}
      onMouseEnter={() => onHover?.(edge)}
      onMouseLeave={() => onHover?.(null)}
    >
      <line
        x1={startX}
        y1={startY}
        x2={endX}
        y2={endY}
        stroke={getFluxColor()}
        strokeWidth={getEdgeWidth()}
        markerEnd="url(#arrowhead)"
        className="cursor-pointer"
      />
      {/* Expression indicator on edge */}
      {expression !== undefined && (
        <circle
          cx={midX}
          cy={midY}
          r={4}
          fill={expression > 0.5 ? COLOR_SCALES.expression.high : expression < 0.25 ? COLOR_SCALES.expression.low : COLOR_SCALES.expression.medium}
          stroke="white"
          strokeWidth={1}
        />
      )}
      {/* Flux label */}
      {flux !== undefined && Math.abs(flux) > 0.01 && (
        <text
          x={midX}
          y={midY - 8}
          textAnchor="middle"
          className="text-[9px] fill-[var(--text-secondary)] font-mono pointer-events-none"
        >
          {flux.toFixed(1)}
        </text>
      )}
    </g>
  );
};

/**
 * Main OmicsVisualization Component
 */
export const OmicsVisualization = ({
  fluxes,
  expressionData,
  width = 800,
  height = 500,
  showValidation = true,
  showLegend = true,
  showExport = true
}) => {
  const { currentModel } = useModel();
  const { datasets, selectedCondition } = useOmics();
  const { accessibleColors } = useTheme();
  const svgRef = useRef(null);

  const [hoveredElement, setHoveredElement] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [visualizationMode, setVisualizationMode] = useState('flux'); // 'flux', 'expression', 'both'
  const [lodLevel, setLodLevel] = useState('auto'); // 'auto', 'full', 'medium', 'low'
  const [activeSubsystem, setActiveSubsystem] = useState(null); // For subsystem filtering

  // Get expression data from context if not provided directly
  const activeExpressionData = useMemo(() => {
    if (expressionData) return expressionData;

    const transcriptomics = datasets?.[OMICS_TYPES.TRANSCRIPTOMICS];
    if (!transcriptomics) return null;

    const condition = selectedCondition?.[OMICS_TYPES.TRANSCRIPTOMICS] || transcriptomics.conditions?.[0];
    const expressionMap = new Map();

    Object.entries(transcriptomics.data || {}).forEach(([geneId, values]) => {
      const value = typeof values === 'object' ? (values[condition] ?? Object.values(values)[0]) : values;
      if (typeof value === 'number' && !isNaN(value)) {
        // Normalize to 0-1
        const min = transcriptomics.stats?.min || 0;
        const max = transcriptomics.stats?.max || 1;
        const normalized = (value - min) / (max - min || 1);
        expressionMap.set(geneId, Math.max(0, Math.min(1, normalized)));
      }
    });

    return expressionMap;
  }, [expressionData, datasets, selectedCondition]);

  // Build network layout from model
  const networkData = useMemo(() => {
    if (!currentModel?.reactions) {
      return { nodes: [], edges: [], metabolitePositions: new Map() };
    }

    const metabolites = new Set();
    const edges = [];

    // Collect metabolites and build edges
    Object.entries(currentModel.reactions).forEach(([rxnId, rxn]) => {
      if (!rxn.metabolites) return;

      const substrates = [];
      const products = [];

      Object.entries(rxn.metabolites).forEach(([metId, coeff]) => {
        metabolites.add(metId);
        if (coeff < 0) substrates.push(metId);
        else products.push(metId);
      });

      // Calculate reaction expression from GPR
      let reactionExpression = undefined;
      if (activeExpressionData && (rxn.gpr || rxn.gene_reaction_rule)) {
        reactionExpression = gprToReactionExpression(
          rxn.gpr || rxn.gene_reaction_rule,
          activeExpressionData
        );
      }

      // Create edges from substrates to products (simplified)
      substrates.forEach(sub => {
        products.forEach(prod => {
          edges.push({
            id: rxnId,
            from: sub,
            to: prod,
            flux: fluxes?.[rxnId],
            expression: reactionExpression,
            gpr: rxn.gpr || rxn.gene_reaction_rule
          });
        });
      });
    });

    // Simple force-directed layout (simplified for performance)
    const nodes = [];
    const metabolitePositions = new Map();
    const metArray = Array.from(metabolites);
    const numMets = metArray.length;

    // Arrange in grid with deterministic offset based on ID hash
    const cols = Math.ceil(Math.sqrt(numMets));
    const cellWidth = (width - 100) / cols;
    const cellHeight = (height - 100) / Math.ceil(numMets / cols);

    // Simple hash function for deterministic positioning
    const hashCode = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    };

    metArray.forEach((metId, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      // Use deterministic offset based on metId hash
      const hash = hashCode(metId);
      const offsetX = ((hash % 100) / 100 - 0.5) * 20;
      const offsetY = (((hash >> 8) % 100) / 100 - 0.5) * 20;
      const x = 50 + col * cellWidth + cellWidth / 2 + offsetX;
      const y = 50 + row * cellHeight + cellHeight / 2 + offsetY;

      metabolitePositions.set(metId, { x, y });

      const met = currentModel.metabolites?.[metId];
      nodes.push({
        id: metId,
        label: met?.name || metId,
        compartment: met?.compartment || 'c',
        x,
        y,
        type: metId.startsWith('EX_') || metId.endsWith('_e') ? 'external' : 'internal'
      });
    });

    return { nodes, edges, metabolitePositions };
  }, [currentModel, fluxes, activeExpressionData, width, height]);

  // Calculate flux statistics for legend
  const fluxStats = useMemo(() => {
    if (!fluxes) return { min: 0, max: 0 };
    const values = Object.values(fluxes).filter(v => v !== undefined);
    return {
      min: Math.min(...values, 0),
      max: Math.max(...values, 0)
    };
  }, [fluxes]);

  // Export handler
  const handleExport = useCallback((format) => {
    if (!currentModel || !fluxes) return;

    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'csv') {
      const headers = ['reaction_id', 'reaction_name', 'flux', 'expression', 'gpr', 'subsystem'];
      const rows = Object.entries(currentModel.reactions).map(([rxnId, rxn]) => {
        const expression = activeExpressionData && (rxn.gpr || rxn.gene_reaction_rule)
          ? gprToReactionExpression(rxn.gpr || rxn.gene_reaction_rule, activeExpressionData)
          : '';
        return [
          rxnId,
          rxn.name || '',
          fluxes[rxnId]?.toFixed(6) || '0',
          typeof expression === 'number' ? expression.toFixed(4) : '',
          rxn.gpr || rxn.gene_reaction_rule || '',
          rxn.subsystem || ''
        ].join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omics_integration_${timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }

    if (format === 'json') {
      const data = {
        timestamp,
        model: currentModel.name || 'unknown',
        reactions: Object.entries(currentModel.reactions).map(([rxnId, rxn]) => ({
          id: rxnId,
          name: rxn.name,
          flux: fluxes[rxnId] || 0,
          expression: activeExpressionData && (rxn.gpr || rxn.gene_reaction_rule)
            ? gprToReactionExpression(rxn.gpr || rxn.gene_reaction_rule, activeExpressionData)
            : null,
          gpr: rxn.gpr || rxn.gene_reaction_rule,
          subsystem: rxn.subsystem
        }))
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omics_integration_${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }

    if (format === 'png' && svgRef.current) {
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);

      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);

        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `network_visualization_${timestamp}.png`;
        a.click();
      };
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    }

    if (format === 'validation' && activeExpressionData) {
      const modelGenes = new Set(Object.keys(currentModel.genes || {}));
      const report = {
        timestamp,
        summary: {
          matched: 0,
          unmatched: 0,
          modelGenes: modelGenes.size
        },
        matched: [],
        unmatched: []
      };

      activeExpressionData.forEach((value, geneId) => {
        if (modelGenes.has(geneId)) {
          report.matched.push({ id: geneId, expression: value });
          report.summary.matched++;
        } else {
          report.unmatched.push({ id: geneId, expression: value });
          report.summary.unmatched++;
        }
      });

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `validation_report_${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [currentModel, fluxes, activeExpressionData, width, height]);

  // Dynamic Level-of-Detail (LoD) rendering for genome-scale models
  const { displayNodes, displayEdges, lodInfo, subsystems } = useMemo(() => {
    const nodes = networkData.nodes;
    const edges = networkData.edges;
    const totalNodes = nodes.length;
    const totalEdges = edges.length;

    // Collect subsystems for filtering
    const subsystemSet = new Set();
    Object.values(currentModel?.reactions || {}).forEach(rxn => {
      if (rxn.subsystem) subsystemSet.add(rxn.subsystem);
    });
    const subsystems = Array.from(subsystemSet).sort();

    // Determine LoD level
    let effectiveLod = lodLevel;
    if (lodLevel === 'auto') {
      if (totalNodes <= 100) effectiveLod = 'full';
      else if (totalNodes <= 500) effectiveLod = 'medium';
      else effectiveLod = 'low';
    }

    // Filter by subsystem if selected
    let filteredNodes = nodes;
    let filteredEdges = edges;

    if (activeSubsystem) {
      // Find reactions in this subsystem
      const subsystemRxns = new Set();
      Object.entries(currentModel?.reactions || {}).forEach(([rxnId, rxn]) => {
        if (rxn.subsystem === activeSubsystem) {
          subsystemRxns.add(rxnId);
        }
      });

      // Keep only edges (reactions) in subsystem
      filteredEdges = edges.filter(e => subsystemRxns.has(e.id));

      // Keep only metabolites involved in those reactions
      const involvedMets = new Set();
      filteredEdges.forEach(e => {
        involvedMets.add(e.from);
        involvedMets.add(e.to);
      });
      filteredNodes = nodes.filter(n => involvedMets.has(n.id));
    }

    // Apply LoD limits
    let maxNodes, maxEdges;
    switch (effectiveLod) {
      case 'full':
        maxNodes = Infinity;
        maxEdges = Infinity;
        break;
      case 'medium':
        maxNodes = 200;
        maxEdges = 400;
        break;
      case 'low':
      default:
        maxNodes = 75;
        maxEdges = 150;
        break;
    }

    // Priority-based node selection for LoD
    let displayNodes = filteredNodes;
    let displayEdges = filteredEdges;

    if (filteredNodes.length > maxNodes) {
      // Prioritize: 1) External metabolites, 2) High-flux connections, 3) Random sample
      const external = filteredNodes.filter(n => n.type === 'external');
      const internal = filteredNodes.filter(n => n.type !== 'external');

      // Score internal nodes by edge connectivity
      const nodeScores = new Map();
      filteredEdges.forEach(e => {
        nodeScores.set(e.from, (nodeScores.get(e.from) || 0) + Math.abs(e.flux || 1));
        nodeScores.set(e.to, (nodeScores.get(e.to) || 0) + Math.abs(e.flux || 1));
      });

      // Sort internal by score
      internal.sort((a, b) => (nodeScores.get(b.id) || 0) - (nodeScores.get(a.id) || 0));

      // Take all external + top internal up to limit
      const remaining = maxNodes - Math.min(external.length, maxNodes * 0.3);
      displayNodes = [
        ...external.slice(0, Math.floor(maxNodes * 0.3)),
        ...internal.slice(0, remaining)
      ];
    }

    // Filter edges to only include visible nodes
    const visibleNodeIds = new Set(displayNodes.map(n => n.id));
    displayEdges = displayEdges.filter(e =>
      visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)
    );

    // Further limit edges if needed
    if (displayEdges.length > maxEdges) {
      // Prioritize by flux magnitude
      displayEdges.sort((a, b) => Math.abs(b.flux || 0) - Math.abs(a.flux || 0));
      displayEdges = displayEdges.slice(0, maxEdges);
    }

    return {
      displayNodes,
      displayEdges,
      lodInfo: {
        level: effectiveLod,
        totalNodes,
        totalEdges,
        displayedNodes: displayNodes.length,
        displayedEdges: displayEdges.length,
        isFiltered: activeSubsystem !== null,
      },
      subsystems,
    };
  }, [networkData, lodLevel, activeSubsystem, currentModel, fluxes]);

  if (!currentModel?.reactions) {
    return (
      <div className="p-8 text-center text-[var(--text-muted)]">
        <p>Load a metabolic model to visualize the network.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Mode:</span>
            <div className="flex gap-1 bg-[var(--bg-primary)] rounded p-1">
              {['flux', 'expression', 'both'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setVisualizationMode(mode)}
                  className={`px-3 py-1 text-xs rounded capitalize transition-colors ${
                    visualizationMode === mode
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Level of Detail Control */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Detail:</span>
            <div className="flex gap-1 bg-[var(--bg-primary)] rounded p-1">
              {['auto', 'full', 'medium', 'low'].map(level => (
                <button
                  key={level}
                  onClick={() => setLodLevel(level)}
                  className={`px-2 py-1 text-xs rounded capitalize transition-colors ${
                    lodLevel === level
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                  title={level === 'auto' ? 'Automatic based on model size' :
                         level === 'full' ? 'Show all nodes (may be slow)' :
                         level === 'medium' ? 'Up to 200 nodes' : 'Up to 75 nodes'}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Subsystem Filter */}
          {subsystems.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">Subsystem:</span>
              <select
                value={activeSubsystem || ''}
                onChange={(e) => setActiveSubsystem(e.target.value || null)}
                className="px-2 py-1 text-xs bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-[var(--text-primary)] max-w-[180px]"
              >
                <option value="">All ({lodInfo.totalNodes} metabolites)</option>
                {subsystems.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
              {activeSubsystem && (
                <button
                  onClick={() => setActiveSubsystem(null)}
                  className="text-xs text-[var(--danger)] hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {showExport && <ExportPanel onExport={handleExport} />}
      </div>

      {/* Performance Warning for Large Models */}
      {lodInfo.totalNodes > 500 && lodLevel === 'full' && (
        <div className="p-3 bg-[var(--warning-bg)] border border-[var(--warning)] rounded-lg flex items-center gap-2">
          <span className="text-sm text-[var(--warning-text)]">
            Large model ({lodInfo.totalNodes} metabolites). Consider using Medium or Low detail, or filter by subsystem for better performance.
          </span>
        </div>
      )}

      {/* Data Validation */}
      {showValidation && (
        <DataValidationPanel
          model={currentModel}
          expressionData={activeExpressionData}
          onExport={handleExport}
        />
      )}

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center gap-6 p-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
          {(visualizationMode === 'flux' || visualizationMode === 'both') && (
            <ColorLegend type="flux" title="Flux" min={fluxStats.min} max={fluxStats.max} />
          )}
          {(visualizationMode === 'expression' || visualizationMode === 'both') && (
            <ColorLegend type="expression" title="Expression" min={0} max={1} />
          )}
          <div className="flex-1" />
          <span className="text-xs text-[var(--text-muted)]">
            Showing {lodInfo.displayedNodes} / {lodInfo.totalNodes} metabolites, {lodInfo.displayedEdges} / {lodInfo.totalEdges} reactions
            {lodInfo.isFiltered && <span className="text-[var(--info-text)] ml-1">(filtered)</span>}
            <span className="ml-2 px-1.5 py-0.5 bg-[var(--bg-primary)] rounded text-[10px] uppercase">{lodInfo.level}</span>
          </span>
        </div>
      )}

      {/* Network Graph */}
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg overflow-hidden">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--text-secondary)" />
            </marker>
          </defs>

          {/* Edges */}
          {displayEdges.map((edge, i) => {
            const fromPos = networkData.metabolitePositions.get(edge.from);
            const toPos = networkData.metabolitePositions.get(edge.to);
            if (!fromPos || !toPos) return null;

            const isHighlighted = hoveredElement === null
              ? null
              : hoveredElement?.id === edge.id;

            return (
              <NetworkEdge
                key={`${edge.id}-${i}`}
                edge={edge}
                fromX={fromPos.x}
                fromY={fromPos.y}
                toX={toPos.x}
                toY={toPos.y}
                flux={visualizationMode !== 'expression' ? edge.flux : undefined}
                expression={visualizationMode !== 'flux' ? edge.expression : undefined}
                isHighlighted={isHighlighted}
                onHover={setHoveredElement}
              />
            );
          })}

          {/* Nodes */}
          {displayNodes.map(node => {
            const isHighlighted = hoveredElement === null
              ? null
              : hoveredElement?.id === node.id;

            return (
              <NetworkNode
                key={node.id}
                node={node}
                x={node.x}
                y={node.y}
                radius={node.type === 'external' ? 20 : 12}
                color={node.type === 'external' ? accessibleColors.info : 'var(--primary)'}
                isHighlighted={isHighlighted}
                onHover={setHoveredElement}
                onClick={setSelectedElement}
              />
            );
          })}

          {/* Tooltip */}
          {hoveredElement && (
            <foreignObject x={10} y={10} width={250} height={120}>
              <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-lg p-3 text-xs">
                <p className="font-semibold text-[var(--text-primary)] mb-1">
                  {hoveredElement.label || hoveredElement.id}
                </p>
                {hoveredElement.flux !== undefined && (
                  <p className="text-[var(--text-secondary)]">
                    Flux: <span className="font-mono">{hoveredElement.flux?.toFixed(3)}</span> mmol/gDW/h
                  </p>
                )}
                {hoveredElement.expression !== undefined && (
                  <p className="text-[var(--text-secondary)]">
                    Expression: <span className="font-mono">{hoveredElement.expression?.toFixed(3)}</span>
                  </p>
                )}
                {hoveredElement.gpr && (
                  <p className="text-[var(--text-muted)] mt-1 font-mono text-[10px]">
                    GPR: {hoveredElement.gpr}
                  </p>
                )}
              </div>
            </foreignObject>
          )}
        </svg>
      </div>

      {/* Selected Element Details */}
      {selectedElement && (
        <div className="p-4 bg-[var(--info-bg)] border border-[var(--info)] rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-[var(--text-primary)]">
              {selectedElement.label || selectedElement.id}
            </h4>
            <button
              onClick={() => setSelectedElement(null)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            {selectedElement.flux !== undefined && (
              <div>
                <p className="text-[var(--text-muted)]">Flux</p>
                <p className="font-mono font-medium">{selectedElement.flux?.toFixed(4)} mmol/gDW/h</p>
              </div>
            )}
            {selectedElement.expression !== undefined && (
              <div>
                <p className="text-[var(--text-muted)]">Expression</p>
                <p className="font-mono font-medium">{selectedElement.expression?.toFixed(4)}</p>
              </div>
            )}
            {selectedElement.compartment && (
              <div>
                <p className="text-[var(--text-muted)]">Compartment</p>
                <p className="font-mono font-medium">{selectedElement.compartment}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OmicsVisualization;
