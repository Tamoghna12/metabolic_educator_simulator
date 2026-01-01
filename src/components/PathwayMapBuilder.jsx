/**
 * PathwayMapBuilder - Interactive Metabolic Pathway Visualization
 *
 * An Escher-inspired but enhanced pathway map builder with:
 * - Interactive drag/drop/rotate for nodes and reactions
 * - Animated flux flow visualization
 * - Multiple editing modes (pan, select, add reaction, rotate, text)
 * - Data overlay with customizable color/size scaling
 * - SVG/PNG export with color legends
 * - Pathway suggestion from loaded models
 * - ARIA accessibility support
 *
 * References:
 * - King et al. (2015) Escher: A Web Application for Building, Sharing, and
 *   Embedding Data-Rich Visualizations of Biological Pathways. PLOS Comp Bio.
 * - IBM Design Language color palette for colorblind accessibility
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useModel } from '../contexts/ModelContext';
import { useOmics, OMICS_TYPES } from '../contexts/OmicsContext';
import { pathwayTemplates, templateMetadata } from '../data/pathwayTemplates';
import { useMapHistory } from '../hooks/useMapHistory';
import { useMapSearch } from '../hooks/useMapSearch';
import { useKeyboardShortcuts, SHORTCUTS } from '../hooks/useKeyboardShortcuts';

// Secondary metabolites to hide by default (common cofactors)
const SECONDARY_METABOLITES = new Set([
  'atp', 'adp', 'amp', 'nad', 'nadh', 'nadp', 'nadph',
  'h2o', 'h', 'pi', 'ppi', 'co2', 'o2', 'coa', 'accoa',
  'atp_c', 'adp_c', 'amp_c', 'nad_c', 'nadh_c', 'nadp_c', 'nadph_c',
  'h2o_c', 'h_c', 'pi_c', 'ppi_c', 'co2_c', 'o2_c', 'coa_c', 'accoa_c'
]);

// Color scales for omics data visualization
const DIVERGING_COLORS = {
  negative: ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7'],
  zero: '#f7f7f7',
  positive: ['#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061']
};

const SEQUENTIAL_COLORS = ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594'];

// Map value to color based on settings
const valueToColor = (value, settings, accessibleColors) => {
  if (value === null || value === undefined || isNaN(value)) return null;

  const { colorScale, minValue, maxValue, centerValue } = settings;
  const min = minValue ?? -4;
  const max = maxValue ?? 4;

  if (colorScale === 'diverging') {
    const center = centerValue ?? 0;
    if (value < center) {
      const t = Math.min(1, Math.max(0, (center - value) / (center - min)));
      return accessibleColors.danger; // Use accessible color
    } else {
      const t = Math.min(1, Math.max(0, (value - center) / (max - center)));
      return accessibleColors.success; // Use accessible color
    }
  } else if (colorScale === 'sequential') {
    const t = Math.min(1, Math.max(0, (value - min) / (max - min)));
    const idx = Math.floor(t * (SEQUENTIAL_COLORS.length - 1));
    return SEQUENTIAL_COLORS[idx];
  }

  return null;
};

// Map value to size multiplier
const valueToSize = (value, settings) => {
  if (value === null || value === undefined || isNaN(value)) return 1;

  const { minValue, maxValue } = settings;
  const min = minValue ?? 0;
  const max = maxValue ?? 10;

  const t = Math.min(1, Math.max(0, (Math.abs(value) - min) / (max - min)));
  return 0.5 + t * 1.5; // Scale from 0.5x to 2x
};

// Map value to width
const valueToWidth = (value, settings) => {
  if (value === null || value === undefined || isNaN(value)) return 2;

  const { minValue, maxValue, minEdgeWidth = 1, maxEdgeWidth = 8 } = settings;
  const min = minValue ?? 0;
  const max = maxValue ?? 10;

  const t = Math.min(1, Math.max(0, (Math.abs(value) - min) / (max - min)));
  return minEdgeWidth + t * (maxEdgeWidth - minEdgeWidth);
};

// Map value to opacity
const valueToOpacity = (value, settings) => {
  if (value === null || value === undefined || isNaN(value)) return 1;

  const { minValue, maxValue } = settings;
  const min = minValue ?? 0;
  const max = maxValue ?? 10;

  const t = Math.min(1, Math.max(0, (Math.abs(value) - min) / (max - min)));
  return 0.3 + t * 0.7; // Scale from 0.3 to 1.0
};

// Constants for layout
const NODE_RADIUS = { metabolite: 18, exchange: 24, biomass: 28, reaction: 12 };
const EDGE_COLORS = { positive: '#16a34a', negative: '#dc2626', zero: '#6b7280' };

// Editing modes
const MODES = {
  PAN: 'pan',
  SELECT: 'select',
  ADD_REACTION: 'add_reaction',
  ROTATE: 'rotate',
  TEXT: 'text'
};

export const PathwayMapBuilder = ({
  fluxes = {},
  width = 900,
  height = 600,
  showControls = true,
  onNodeSelect,
  onReactionSelect
}) => {
  const { isDark, accessibleColors } = useTheme();
  const { currentModel } = useModel();
  const { datasets, visSettings, getValue, summary: omicsSummary } = useOmics();

  // Canvas state
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width, height });
  const [zoom, setZoom] = useState(1);

  // Use history hook for undo/redo support
  const history = useMapHistory([], [], []);
  const { nodes, edges, annotations, setNodes, setEdges, setAnnotations,
          undo, redo, canUndo, canRedo, moveNode, addNode, removeNode,
          addEdge, removeEdge, batchUpdate, updateAnnotations } = history;

  // Editing state
  const [mode, setMode] = useState(MODES.PAN);
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [selectedEdges, setSelectedEdges] = useState(new Set());
  const [hoveredElement, setHoveredElement] = useState(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Animation state
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState(1);

  // Data overlay settings
  const [overlaySettings, setOverlaySettings] = useState({
    showFlux: true,
    colorScale: 'diverging',
    sizeScale: true,
    showLabels: true,
    showGPR: false,
    showSecondary: false, // Hide secondary metabolites by default
    minEdgeWidth: 1,
    maxEdgeWidth: 8
  });

  // Text annotations
  const [editingAnnotation, setEditingAnnotation] = useState(null);

  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // Search
  const [showSearch, setShowSearch] = useState(false);
  const search = useMapSearch(nodes, edges, currentModel);

  // Keyboard shortcuts help
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Load a pathway template
  const loadTemplate = useCallback((templateId) => {
    const template = pathwayTemplates[templateId];
    if (template) {
      setNodes(template.nodes.map(n => ({ ...n })));
      setEdges(template.edges.map(e => ({ ...e })));
      setAnnotations(template.annotations || []);
      setSelectedTemplate(templateId);
      setShowTemplateSelector(false);
      // Reset view
      setViewBox({ x: 0, y: 0, width, height });
      setZoom(1);
    }
  }, [width, height]);

  // Initialize from model
  useEffect(() => {
    if (currentModel?.nodes && currentModel?.edges) {
      setNodes(currentModel.nodes.map(n => ({ ...n })));
      setEdges(currentModel.edges.map(e => ({ ...e })));
    }
  }, [currentModel]);

  // Compute flux statistics for scaling
  const fluxStats = useMemo(() => {
    const values = Object.values(fluxes).filter(v => v !== 0);
    if (values.length === 0) return { min: -1, max: 1, absMax: 1 };
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      absMax: Math.max(...values.map(Math.abs))
    };
  }, [fluxes]);

  // Get edge color based on flux and omics data
  const getEdgeColor = useCallback((reactionId, geneIds = []) => {
    // First check omics data for transcriptomics/proteomics
    const transcriptomicsSettings = visSettings[OMICS_TYPES.TRANSCRIPTOMICS];
    const proteomicsSettings = visSettings[OMICS_TYPES.PROTEOMICS];

    // Try transcriptomics first (gene expression affects reaction color)
    if (transcriptomicsSettings?.enabled && transcriptomicsSettings?.property === 'color' && geneIds.length > 0) {
      // Average expression of genes in GPR
      const geneValues = geneIds.map(g => getValue(g, OMICS_TYPES.TRANSCRIPTOMICS)).filter(v => v !== null);
      if (geneValues.length > 0) {
        const avgValue = geneValues.reduce((a, b) => a + b, 0) / geneValues.length;
        const color = valueToColor(avgValue, transcriptomicsSettings, accessibleColors);
        if (color) return color;
      }
    }

    // Try proteomics
    if (proteomicsSettings?.enabled && proteomicsSettings?.property === 'color' && geneIds.length > 0) {
      const proteinValues = geneIds.map(g => getValue(g, OMICS_TYPES.PROTEOMICS)).filter(v => v !== null);
      if (proteinValues.length > 0) {
        const avgValue = proteinValues.reduce((a, b) => a + b, 0) / proteinValues.length;
        const color = valueToColor(avgValue, proteomicsSettings, accessibleColors);
        if (color) return color;
      }
    }

    // Fall back to flux-based coloring
    if (!overlaySettings.showFlux || fluxes[reactionId] === undefined) {
      return isDark ? '#4b5563' : '#9ca3af';
    }

    const flux = fluxes[reactionId];
    if (Math.abs(flux) < 1e-6) return accessibleColors.warning;

    if (overlaySettings.colorScale === 'diverging') {
      return flux > 0 ? accessibleColors.success : accessibleColors.danger;
    }

    // Sequential scale based on absolute value
    const intensity = Math.abs(flux) / fluxStats.absMax;
    return flux > 0
      ? `rgba(${hexToRgb(accessibleColors.success)}, ${0.3 + intensity * 0.7})`
      : `rgba(${hexToRgb(accessibleColors.danger)}, ${0.3 + intensity * 0.7})`;
  }, [fluxes, overlaySettings, fluxStats, accessibleColors, isDark, visSettings, getValue]);

  // Get edge width based on flux and omics data
  const getEdgeWidth = useCallback((reactionId, geneIds = []) => {
    // Check if proteomics should affect width
    const proteomicsSettings = visSettings[OMICS_TYPES.PROTEOMICS];
    if (proteomicsSettings?.enabled && proteomicsSettings?.property === 'width' && geneIds.length > 0) {
      const proteinValues = geneIds.map(g => getValue(g, OMICS_TYPES.PROTEOMICS)).filter(v => v !== null);
      if (proteinValues.length > 0) {
        const avgValue = proteinValues.reduce((a, b) => a + b, 0) / proteinValues.length;
        return valueToWidth(avgValue, proteomicsSettings);
      }
    }

    // Fall back to flux-based width
    if (!overlaySettings.sizeScale || fluxes[reactionId] === undefined) {
      return 2;
    }
    const flux = Math.abs(fluxes[reactionId]);
    const normalized = flux / fluxStats.absMax;
    return overlaySettings.minEdgeWidth +
           normalized * (overlaySettings.maxEdgeWidth - overlaySettings.minEdgeWidth);
  }, [fluxes, overlaySettings, fluxStats, visSettings, getValue]);

  // Get node style based on metabolomics data
  const getNodeOmicsStyle = useCallback((nodeId) => {
    const metabolomicsSettings = visSettings[OMICS_TYPES.METABOLOMICS];
    if (!metabolomicsSettings?.enabled) return {};

    const value = getValue(nodeId, OMICS_TYPES.METABOLOMICS);
    if (value === null || value === undefined) return {};

    const style = {};

    if (metabolomicsSettings.property === 'color') {
      style.fill = valueToColor(value, metabolomicsSettings, accessibleColors);
    }
    if (metabolomicsSettings.property === 'size') {
      style.sizeMultiplier = valueToSize(value, metabolomicsSettings);
    }
    if (metabolomicsSettings.property === 'opacity') {
      style.opacity = valueToOpacity(value, metabolomicsSettings);
    }

    style.value = value;
    return style;
  }, [visSettings, getValue, accessibleColors]);

  // SVG stroke animation for flux flow
  const getAnimationStyle = useCallback((reactionId) => {
    if (!animationEnabled || !fluxes[reactionId]) return {};

    const flux = fluxes[reactionId];
    const speed = Math.max(0.5, 3 - Math.abs(flux) / fluxStats.absMax * 2);

    return {
      strokeDasharray: '8 4',
      animation: `flowAnimation ${speed / animationSpeed}s linear infinite`,
      animationDirection: flux < 0 ? 'reverse' : 'normal'
    };
  }, [animationEnabled, animationSpeed, fluxes, fluxStats]);

  // Pan handling
  const handleMouseDown = (e) => {
    if (e.target === svgRef.current || e.target.tagName === 'rect') {
      if (mode === MODES.PAN) {
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      } else if (mode === MODES.TEXT) {
        const rect = svgRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom + viewBox.x;
        const y = (e.clientY - rect.top) / zoom + viewBox.y;
        addAnnotation(x, y);
      }
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && mode === MODES.PAN) {
      const dx = (e.clientX - dragStart.x) / zoom;
      const dy = (e.clientY - dragStart.y) / zoom;
      setViewBox(prev => ({
        ...prev,
        x: prev.x - dx,
        y: prev.y - dy
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom handling
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(4, zoom * delta));

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoom + viewBox.x;
    const mouseY = (e.clientY - rect.top) / zoom + viewBox.y;

    const newWidth = width / newZoom;
    const newHeight = height / newZoom;

    setViewBox({
      x: mouseX - (e.clientX - rect.left) / newZoom,
      y: mouseY - (e.clientY - rect.top) / newZoom,
      width: newWidth,
      height: newHeight
    });
    setZoom(newZoom);
  };

  // Filter nodes based on secondary metabolite visibility
  const visibleNodes = useMemo(() => {
    if (overlaySettings.showSecondary) return nodes;
    return nodes.filter(n => !SECONDARY_METABOLITES.has(n.id.toLowerCase()));
  }, [nodes, overlaySettings.showSecondary]);

  // Filter edges based on visible nodes
  const visibleEdges = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    return edges.filter(e => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to));
  }, [edges, visibleNodes]);

  // Delete selected elements
  const deleteSelected = useCallback(() => {
    if (selectedNodes.size === 0 && selectedEdges.size === 0) return;

    batchUpdate(({ setNodes, setEdges }) => {
      if (selectedNodes.size > 0) {
        setNodes(prev => prev.filter(n => !selectedNodes.has(n.id)));
        setEdges(prev => prev.filter(e =>
          !selectedNodes.has(e.from) && !selectedNodes.has(e.to)
        ));
      }
      if (selectedEdges.size > 0) {
        setEdges(prev => prev.filter(e => !selectedEdges.has(e.reaction)));
      }
    }, 'Delete selected');

    setSelectedNodes(new Set());
    setSelectedEdges(new Set());
  }, [selectedNodes, selectedEdges, batchUpdate]);

  // Save map to JSON
  const saveMap = useCallback(() => {
    const mapData = {
      version: '1.0',
      name: currentModel?.id || 'pathway_map',
      timestamp: new Date().toISOString(),
      nodes: nodes,
      edges: edges,
      annotations: annotations,
      viewBox: viewBox,
      settings: overlaySettings
    };

    const blob = new Blob([JSON.stringify(mapData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentModel?.id || 'pathway_map'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, annotations, viewBox, overlaySettings, currentModel]);

  // Load map from JSON
  const loadMap = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const mapData = JSON.parse(e.target.result);
        batchUpdate(({ setNodes, setEdges, setAnnotations }) => {
          setNodes(mapData.nodes || []);
          setEdges(mapData.edges || []);
          setAnnotations(mapData.annotations || []);
        }, 'Load map');

        if (mapData.viewBox) setViewBox(mapData.viewBox);
        if (mapData.settings) setOverlaySettings(prev => ({ ...prev, ...mapData.settings }));
      } catch (err) {
        console.error('Failed to load map:', err);
      }
    };
    reader.readAsText(file);
  }, [batchUpdate]);

  // Center view on element
  const centerOnElement = useCallback((elementId) => {
    const node = nodes.find(n => n.id === elementId);
    if (node) {
      setViewBox({
        x: node.x - width / zoom / 2,
        y: node.y - height / zoom / 2,
        width: width / zoom,
        height: height / zoom
      });
    }
  }, [nodes, width, height, zoom]);

  // Fit view to content
  const fitToView = useCallback(() => {
    if (nodes.length === 0) return;

    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 50;
    const maxX = Math.max(...xs) + 50;
    const minY = Math.min(...ys) - 50;
    const maxY = Math.max(...ys) + 50;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const newZoom = Math.min(width / contentWidth, height / contentHeight, 2);

    setZoom(newZoom);
    setViewBox({
      x: minX,
      y: minY,
      width: width / newZoom,
      height: height / newZoom
    });
  }, [nodes, width, height]);

  // Export to SVG
  const exportSVG = useCallback(() => {
    if (!svgRef.current) return;
    const svgData = svgRef.current.outerHTML;
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pathway_map_${currentModel?.id || 'export'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentModel]);

  // Export to PNG
  const exportPNG = useCallback(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scale = 2; // Higher resolution

    canvas.width = width * scale;
    canvas.height = height * scale;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();

    img.onload = () => {
      ctx.fillStyle = isDark ? '#1f2937' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `pathway_map_${currentModel?.id || 'export'}.png`;
      a.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [currentModel, width, height, isDark]);

  // Keyboard shortcut handlers
  const shortcutHandlers = useMemo(() => ({
    mode_select: () => setMode(MODES.SELECT),
    mode_pan: () => setMode(MODES.PAN),
    mode_add: () => setMode(MODES.ADD_REACTION),
    mode_rotate: () => setMode(MODES.ROTATE),
    mode_text: () => setMode(MODES.TEXT),
    delete: deleteSelected,
    undo: () => undo(),
    redo: () => redo(),
    zoom_reset: () => { setZoom(1); setViewBox({ x: 0, y: 0, width, height }); },
    zoom_in: () => setZoom(z => Math.min(4, z + 0.25)),
    zoom_out: () => setZoom(z => Math.max(0.25, z - 0.25)),
    fit_view: fitToView,
    deselect: () => { setSelectedNodes(new Set()); setSelectedEdges(new Set()); search.clearSearch(); },
    search: () => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 100); },
    search_next: () => { const r = search.nextResult(); if (r) centerOnElement(r.id); },
    search_prev: () => { const r = search.prevResult(); if (r) centerOnElement(r.id); },
    toggle_labels: () => setOverlaySettings(p => ({ ...p, showLabels: !p.showLabels })),
    toggle_animation: () => setAnimationEnabled(p => !p),
    toggle_secondary: () => setOverlaySettings(p => ({ ...p, showSecondary: !p.showSecondary })),
    save: saveMap,
    export_svg: exportSVG,
    export_png: exportPNG
  }), [deleteSelected, undo, redo, width, height, fitToView, search, centerOnElement, saveMap, exportSVG, exportPNG]);

  // Initialize keyboard shortcuts
  const { getShortcutLabel, shortcutGroups } = useKeyboardShortcuts(shortcutHandlers, true, containerRef);

  // Node drag handling with history
  const handleNodeDragStart = (e, nodeId) => {
    if (mode !== MODES.SELECT) return;
    e.stopPropagation();

    const rect = svgRef.current.getBoundingClientRect();
    const node = nodes.find(n => n.id === nodeId);
    const startX = node.x;
    const startY = node.y;

    setSelectedNodes(new Set([nodeId]));
    setIsDragging(true);

    const offsetX = (e.clientX - rect.left) / zoom + viewBox.x - node.x;
    const offsetY = (e.clientY - rect.top) / zoom + viewBox.y - node.y;

    const handleDrag = (moveEvent) => {
      const x = (moveEvent.clientX - rect.left) / zoom + viewBox.x - offsetX;
      const y = (moveEvent.clientY - rect.top) / zoom + viewBox.y - offsetY;
      moveNode(nodeId, x, y, false);
    };

    const handleDragEnd = () => {
      setIsDragging(false);
      // Commit to history only if position changed
      const endNode = nodes.find(n => n.id === nodeId);
      if (endNode && (endNode.x !== startX || endNode.y !== startY)) {
        moveNode(nodeId, endNode.x, endNode.y, true);
      }
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleDragEnd);
    };

    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
  };

  // Add text annotation
  const addAnnotation = (x, y) => {
    const newAnnotation = {
      id: `annotation_${Date.now()}`,
      x,
      y,
      text: 'New annotation',
      fontSize: 14,
      color: 'var(--text-primary)'
    };
    setAnnotations(prev => [...prev, newAnnotation]);
    setEditingAnnotation(newAnnotation.id);
  };

  // Pathway suggestion - find connected reactions from a starting point
  const suggestPathway = useCallback((startReaction) => {
    if (!currentModel?.reactions) return [];

    const reactions = currentModel.reactions;
    const visited = new Set([startReaction]);
    const queue = [startReaction];
    const suggested = [startReaction];

    while (queue.length > 0 && suggested.length < 15) {
      const current = queue.shift();
      const rxn = reactions[current];
      if (!rxn?.metabolites) continue;

      // Find connected reactions through shared metabolites
      const metaboliteIds = Object.keys(rxn.metabolites);

      for (const [rxnId, r] of Object.entries(reactions)) {
        if (visited.has(rxnId)) continue;

        const rxnMets = Object.keys(r.metabolites || {});
        const shared = metaboliteIds.some(m => rxnMets.includes(m));

        if (shared) {
          visited.add(rxnId);
          queue.push(rxnId);
          suggested.push(rxnId);
        }
      }
    }

    return suggested;
  }, [currentModel]);

  // Render bezier curve for edge
  const renderEdge = (edge, index) => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return null;

    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate control points for bezier curve
    const midX = (fromNode.x + toNode.x) / 2;
    const midY = (fromNode.y + toNode.y) / 2;
    const perpX = -dy / distance * 30;
    const perpY = dx / distance * 30;

    // Offset for multiple edges between same nodes
    const offset = index % 2 === 0 ? 1 : -1;
    const cx = midX + perpX * offset * 0.5;
    const cy = midY + perpY * offset * 0.5;

    // Calculate arrow position
    const angle = Math.atan2(toNode.y - cy, toNode.x - cx);
    const toRadius = NODE_RADIUS[toNode.type] || NODE_RADIUS.metabolite;
    const endX = toNode.x - Math.cos(angle) * (toRadius + 5);
    const endY = toNode.y - Math.sin(angle) * (toRadius + 5);

    const path = `M ${fromNode.x} ${fromNode.y} Q ${cx} ${cy} ${endX} ${endY}`;
    const isSelected = selectedEdges.has(edge.reaction);
    const isHovered = hoveredElement === edge.reaction;

    return (
      <g key={`edge-${index}`} className="edge-group">
        {/* Invisible wider path for easier selection */}
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={20}
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHoveredElement(edge.reaction)}
          onMouseLeave={() => setHoveredElement(null)}
          onClick={() => {
            setSelectedEdges(new Set([edge.reaction]));
            onReactionSelect?.(edge.reaction);
          }}
        />
        {/* Visible path */}
        <path
          d={path}
          fill="none"
          stroke={getEdgeColor(edge.reaction)}
          strokeWidth={getEdgeWidth(edge.reaction)}
          strokeLinecap="round"
          markerEnd={`url(#arrowhead-${fluxes[edge.reaction] > 0 ? 'positive' : fluxes[edge.reaction] < 0 ? 'negative' : 'neutral'})`}
          opacity={selectedEdges.size > 0 && !isSelected ? 0.3 : 1}
          style={{
            ...getAnimationStyle(edge.reaction),
            filter: isHovered || isSelected ? 'drop-shadow(0 0 4px rgba(0,0,0,0.3))' : 'none',
            transition: 'opacity 0.2s'
          }}
        />
        {/* Edge label */}
        {overlaySettings.showLabels && (
          <text
            x={cx}
            y={cy - 8}
            className="fill-[var(--text-secondary)] text-[10px] font-medium pointer-events-none"
            textAnchor="middle"
            style={{
              opacity: isHovered || isSelected ? 1 : 0.7,
              fontWeight: isHovered || isSelected ? 600 : 400
            }}
          >
            {edge.label || edge.reaction}
          </text>
        )}
        {/* Flux value label */}
        {overlaySettings.showFlux && fluxes[edge.reaction] !== undefined && (isHovered || isSelected) && (
          <text
            x={cx}
            y={cy + 12}
            className="fill-[var(--text-primary)] text-[9px] font-mono pointer-events-none"
            textAnchor="middle"
          >
            {fluxes[edge.reaction].toFixed(2)}
          </text>
        )}
      </g>
    );
  };

  // Render node
  const renderNode = (node) => {
    const isSelected = selectedNodes.has(node.id);
    const isHovered = hoveredElement === node.id;
    const baseRadius = NODE_RADIUS[node.type] || NODE_RADIUS.metabolite;

    // Get omics-based styling for metabolites
    const omicsStyle = getNodeOmicsStyle(node.id);
    const sizeMultiplier = omicsStyle.sizeMultiplier || 1;
    const radius = baseRadius * sizeMultiplier;

    // Determine node color (omics data takes precedence)
    let nodeColor = omicsStyle.fill ||
      (node.type === 'exchange' ? accessibleColors.info :
      node.type === 'biomass' ? accessibleColors.success :
      node.type === 'reaction' ? accessibleColors.warning :
      'var(--primary)');

    const nodeOpacity = omicsStyle.opacity || 1;
    const hasOmicsData = omicsStyle.value !== undefined;

    return (
      <g
        key={node.id}
        className="node-group"
        tabIndex={0}
        role="button"
        aria-label={`${node.label} ${node.type}${hasOmicsData ? ` (value: ${omicsStyle.value.toFixed(2)})` : ''}`}
        style={{ cursor: mode === MODES.SELECT ? 'grab' : 'default' }}
        onMouseDown={(e) => handleNodeDragStart(e, node.id)}
        onMouseEnter={() => setHoveredElement(node.id)}
        onMouseLeave={() => setHoveredElement(null)}
        onClick={() => {
          if (mode === MODES.SELECT) {
            setSelectedNodes(new Set([node.id]));
            onNodeSelect?.(node.id);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setSelectedNodes(prev => {
              const next = new Set(prev);
              if (next.has(node.id)) next.delete(node.id);
              else next.add(node.id);
              return next;
            });
          }
        }}
      >
        {/* Glow effect for selected/hovered */}
        {(isSelected || isHovered) && (
          <circle
            cx={node.x}
            cy={node.y}
            r={radius + 6}
            fill="none"
            stroke={isSelected ? accessibleColors.info : 'var(--text-secondary)'}
            strokeWidth={2}
            strokeDasharray={isSelected ? 'none' : '4 2'}
            opacity={0.6}
          />
        )}

        {/* Omics data indicator ring */}
        {hasOmicsData && (
          <circle
            cx={node.x}
            cy={node.y}
            r={radius + 3}
            fill="none"
            stroke={accessibleColors.warning}
            strokeWidth={2}
            strokeDasharray="2 2"
            opacity={0.8}
          />
        )}

        {/* Node circle */}
        <circle
          cx={node.x}
          cy={node.y}
          r={radius}
          fill={nodeColor}
          stroke={isSelected ? 'var(--text-primary)' : 'var(--border-color)'}
          strokeWidth={isSelected ? 2.5 : 1.5}
          opacity={nodeOpacity}
          style={{
            filter: isHovered ? 'brightness(1.1)' : 'none',
            transition: 'all 0.15s ease'
          }}
        />

        {/* Connectivity indicator */}
        {node.connectivity && node.connectivity > 5 && (
          <text
            x={node.x}
            y={node.y + 4}
            className="fill-white text-[10px] font-bold pointer-events-none"
            textAnchor="middle"
          >
            {node.connectivity}
          </text>
        )}

        {/* Node label */}
        {overlaySettings.showLabels && (
          <text
            x={node.x}
            y={node.y + radius + 14}
            className="fill-[var(--text-primary)] text-xs font-medium pointer-events-none"
            textAnchor="middle"
            style={{ fontSize: node.type === 'exchange' || node.type === 'biomass' ? '11px' : '10px' }}
          >
            {node.label}
          </text>
        )}
      </g>
    );
  };

  // Render annotation
  const renderAnnotation = (annotation) => {
    const isEditing = editingAnnotation === annotation.id;

    return (
      <g key={annotation.id}>
        {isEditing ? (
          <foreignObject
            x={annotation.x - 100}
            y={annotation.y - 15}
            width={200}
            height={30}
          >
            <input
              type="text"
              defaultValue={annotation.text}
              autoFocus
              className="w-full px-2 py-1 text-sm bg-[var(--card-bg)] border border-[var(--primary)] rounded"
              onBlur={(e) => {
                setAnnotations(prev => prev.map(a =>
                  a.id === annotation.id ? { ...a, text: e.target.value } : a
                ));
                setEditingAnnotation(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
                if (e.key === 'Escape') setEditingAnnotation(null);
              }}
            />
          </foreignObject>
        ) : (
          <text
            x={annotation.x}
            y={annotation.y}
            fill={annotation.color}
            fontSize={annotation.fontSize}
            textAnchor="middle"
            className="cursor-pointer"
            onDoubleClick={() => setEditingAnnotation(annotation.id)}
          >
            {annotation.text}
          </text>
        )}
      </g>
    );
  };

  return (
    <div ref={containerRef} className="pathway-map-builder space-y-4">
      {/* CSS for animation */}
      <style>{`
        @keyframes flowAnimation {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      {/* Toolbar */}
      {showControls && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
          {/* Template selector */}
          <div className="relative pr-3 border-r border-[var(--border-color)]">
            <button
              onClick={() => setShowTemplateSelector(!showTemplateSelector)}
              className="px-3 py-1.5 text-xs font-medium bg-[var(--info-bg)] text-[var(--info-text)] rounded hover:opacity-90 flex items-center gap-1"
            >
              📋 Templates
              <span className="text-[10px]">▼</span>
            </button>
            {showTemplateSelector && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
                <div className="p-2 border-b border-[var(--border-color)]">
                  <p className="text-xs font-medium text-[var(--text-primary)]">Load Pathway Template</p>
                  <p className="text-[10px] text-[var(--text-muted)]">Pre-built pathway layouts</p>
                </div>
                {templateMetadata.map(template => (
                  <button
                    key={template.id}
                    onClick={() => loadTemplate(template.id)}
                    className={`w-full p-2 text-left hover:bg-[var(--bg-primary)] transition-colors border-b border-[var(--border-color)] last:border-b-0 ${
                      selectedTemplate === template.id ? 'bg-[var(--info-bg)]' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-medium text-[var(--text-primary)]">{template.name}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">{template.organism}</p>
                      </div>
                      <span className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-secondary)] px-1.5 py-0.5 rounded">
                        {template.category}
                      </span>
                    </div>
                    <div className="text-[9px] text-[var(--text-muted)] mt-1">
                      {template.nodeCount} nodes • {template.edgeCount} edges
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => {
                    if (currentModel?.nodes) {
                      setNodes(currentModel.nodes.map(n => ({ ...n })));
                      setEdges(currentModel.edges?.map(e => ({ ...e })) || []);
                      setAnnotations([]);
                      setSelectedTemplate(null);
                    }
                    setShowTemplateSelector(false);
                  }}
                  className="w-full p-2 text-left text-xs text-[var(--primary)] hover:bg-[var(--bg-primary)] font-medium"
                >
                  ↩ Load from Current Model
                </button>
              </div>
            )}
          </div>

          {/* Mode buttons */}
          <div className="flex items-center gap-1 pr-3 border-r border-[var(--border-color)]">
            {Object.entries(MODES).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setMode(value)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  mode === value
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                }`}
                title={key.replace('_', ' ')}
              >
                {key === 'PAN' && '✋'}
                {key === 'SELECT' && '👆'}
                {key === 'ADD_REACTION' && '➕'}
                {key === 'ROTATE' && '🔄'}
                {key === 'TEXT' && '📝'}
              </button>
            ))}
          </div>

          {/* Animation controls */}
          <div className="flex items-center gap-2 px-3 border-r border-[var(--border-color)]">
            <button
              onClick={() => setAnimationEnabled(!animationEnabled)}
              className={`px-2 py-1 text-xs rounded ${
                animationEnabled ? 'bg-[var(--success-bg)] text-[var(--success-text)]' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)]'
              }`}
            >
              {animationEnabled ? '▶ Flow' : '⏸ Flow'}
            </button>
            <input
              type="range"
              min="0.25"
              max="3"
              step="0.25"
              value={animationSpeed}
              onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
              className="w-20"
              title="Animation speed"
            />
          </div>

          {/* Overlay settings */}
          <div className="flex items-center gap-2 px-3 border-r border-[var(--border-color)]">
            <label className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={overlaySettings.showFlux}
                onChange={(e) => setOverlaySettings(prev => ({ ...prev, showFlux: e.target.checked }))}
              />
              Flux
            </label>
            <label className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={overlaySettings.sizeScale}
                onChange={(e) => setOverlaySettings(prev => ({ ...prev, sizeScale: e.target.checked }))}
              />
              Scale
            </label>
            <label className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={overlaySettings.showLabels}
                onChange={(e) => setOverlaySettings(prev => ({ ...prev, showLabels: e.target.checked }))}
              />
              Labels
            </label>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-2 px-3 border-r border-[var(--border-color)]">
            <button
              onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
              className="px-2 py-1 text-xs bg-[var(--bg-primary)] rounded hover:bg-[var(--bg-secondary)]"
            >
              −
            </button>
            <span className="text-xs font-mono text-[var(--text-secondary)] w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.min(4, z + 0.25))}
              className="px-2 py-1 text-xs bg-[var(--bg-primary)] rounded hover:bg-[var(--bg-secondary)]"
            >
              +
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setViewBox({ x: 0, y: 0, width, height });
              }}
              className="px-2 py-1 text-xs bg-[var(--bg-primary)] rounded hover:bg-[var(--bg-secondary)]"
            >
              Reset
            </button>
          </div>

          {/* Undo/Redo */}
          <div className="flex items-center gap-1 px-3 border-r border-[var(--border-color)]">
            <button
              onClick={undo}
              disabled={!canUndo}
              className={`px-2 py-1 text-xs rounded ${canUndo ? 'bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)]' : 'opacity-40 cursor-not-allowed'}`}
              title={`Undo (${getShortcutLabel('undo')})`}
            >
              ↶
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className={`px-2 py-1 text-xs rounded ${canRedo ? 'bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)]' : 'opacity-40 cursor-not-allowed'}`}
              title={`Redo (${getShortcutLabel('redo')})`}
            >
              ↷
            </button>
          </div>

          {/* Delete selected */}
          <div className="flex items-center gap-1 px-3 border-r border-[var(--border-color)]">
            <button
              onClick={deleteSelected}
              disabled={selectedNodes.size === 0 && selectedEdges.size === 0}
              className={`px-2 py-1 text-xs rounded ${
                selectedNodes.size > 0 || selectedEdges.size > 0
                  ? 'bg-[var(--danger-bg)] text-[var(--danger-text)] hover:opacity-90'
                  : 'bg-[var(--bg-primary)] opacity-40 cursor-not-allowed'
              }`}
              title={`Delete (${getShortcutLabel('delete')})`}
            >
              🗑
            </button>
          </div>

          {/* Secondary metabolites toggle */}
          <label className="flex items-center gap-1 text-xs text-[var(--text-secondary)] px-3 border-r border-[var(--border-color)]">
            <input
              type="checkbox"
              checked={overlaySettings.showSecondary}
              onChange={(e) => setOverlaySettings(prev => ({ ...prev, showSecondary: e.target.checked }))}
            />
            ATP/NAD
          </label>

          {/* Search */}
          <div className="flex items-center gap-1 px-3 border-r border-[var(--border-color)]">
            <button
              onClick={() => { setShowSearch(!showSearch); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 100); }}
              className={`px-2 py-1 text-xs rounded ${showSearch ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-primary)]'}`}
              title={`Search (${getShortcutLabel('search')})`}
            >
              🔍
            </button>
          </div>

          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={saveMap}
              className="px-3 py-1.5 text-xs font-medium bg-[var(--success-bg)] text-[var(--success-text)] rounded hover:opacity-90"
              title={`Save (${getShortcutLabel('save')})`}
            >
              💾 Save
            </button>
            <label className="px-3 py-1.5 text-xs font-medium bg-[var(--bg-primary)] text-[var(--text-secondary)] rounded hover:bg-[var(--bg-secondary)] cursor-pointer">
              📂 Load
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => { if (e.target.files[0]) loadMap(e.target.files[0]); }}
              />
            </label>
            <button
              onClick={exportSVG}
              className="px-3 py-1.5 text-xs font-medium bg-[var(--info-bg)] text-[var(--info-text)] rounded hover:opacity-90"
            >
              SVG
            </button>
            <button
              onClick={exportPNG}
              className="px-3 py-1.5 text-xs font-medium bg-[var(--info-bg)] text-[var(--info-text)] rounded hover:opacity-90"
            >
              PNG
            </button>
            <button
              onClick={() => setShowShortcuts(!showShortcuts)}
              className="px-2 py-1.5 text-xs bg-[var(--bg-primary)] rounded hover:bg-[var(--bg-secondary)]"
              title="Keyboard shortcuts"
            >
              ⌨️
            </button>
          </div>
        </div>
      )}

      {/* Search panel */}
      {showSearch && (
        <div className="flex items-center gap-2 p-2 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search metabolites, reactions, genes..."
            value={search.query}
            onChange={(e) => { search.setQuery(e.target.value); search.highlightResults(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const r = search.nextResult();
                if (r) centerOnElement(r.id);
              }
              if (e.key === 'Escape') {
                setShowSearch(false);
                search.clearSearch();
              }
            }}
            className="flex-1 px-3 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-color)] rounded"
          />
          <select
            value={search.searchType}
            onChange={(e) => search.setSearchType(e.target.value)}
            className="px-2 py-1.5 text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] rounded"
          >
            <option value="all">All</option>
            <option value="metabolites">Metabolites</option>
            <option value="reactions">Reactions</option>
            <option value="genes">Genes</option>
          </select>
          <span className="text-xs text-[var(--text-secondary)]">
            {search.resultCount > 0 ? `${search.currentResultIndex + 1}/${search.resultCount}` : '0 results'}
          </span>
          <button onClick={() => { const r = search.prevResult(); if (r) centerOnElement(r.id); }} className="px-2 py-1 text-xs bg-[var(--bg-primary)] rounded">◀</button>
          <button onClick={() => { const r = search.nextResult(); if (r) centerOnElement(r.id); }} className="px-2 py-1 text-xs bg-[var(--bg-primary)] rounded">▶</button>
          <button onClick={() => { setShowSearch(false); search.clearSearch(); }} className="px-2 py-1 text-xs text-[var(--danger-text)]">✕</button>
        </div>
      )}

      {/* Keyboard shortcuts help */}
      {showShortcuts && (
        <div className="p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-sm text-[var(--text-primary)]">Keyboard Shortcuts</h3>
            <button onClick={() => setShowShortcuts(false)} className="text-[var(--text-muted)]">✕</button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-xs">
            {Object.entries(shortcutGroups).map(([group, actions]) => (
              <div key={group}>
                <h4 className="font-medium text-[var(--text-secondary)] mb-1">{group}</h4>
                {actions.map(action => (
                  <div key={action} className="flex justify-between py-0.5">
                    <span className="text-[var(--text-muted)]">{SHORTCUTS[Object.keys(SHORTCUTS).find(k => SHORTCUTS[k].action === action)]?.label || action}</span>
                    <kbd className="px-1 bg-[var(--bg-primary)] rounded font-mono">{getShortcutLabel(action)}</kbd>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main SVG canvas */}
      <div className="relative bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg overflow-hidden shadow-sm">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          className="w-full"
          style={{ cursor: mode === MODES.PAN ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          role="img"
          aria-label="Interactive Metabolic Pathway Map"
        >
          <title>Interactive Metabolic Pathway Visualization</title>
          <desc>A draggable, zoomable metabolic pathway map with flux visualization</desc>

          {/* Background */}
          <rect
            x={viewBox.x - 1000}
            y={viewBox.y - 1000}
            width={viewBox.width + 2000}
            height={viewBox.height + 2000}
            fill={isDark ? '#111827' : '#f9fafb'}
          />

          {/* Grid pattern */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke={isDark ? '#1f2937' : '#e5e7eb'}
                strokeWidth="0.5"
              />
            </pattern>

            {/* Arrowhead markers for different flux directions */}
            <marker id="arrowhead-positive" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill={accessibleColors.success} />
            </marker>
            <marker id="arrowhead-negative" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill={accessibleColors.danger} />
            </marker>
            <marker id="arrowhead-neutral" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--text-secondary)" />
            </marker>
          </defs>

          <rect
            x={viewBox.x - 1000}
            y={viewBox.y - 1000}
            width={viewBox.width + 2000}
            height={viewBox.height + 2000}
            fill="url(#grid)"
          />

          {/* Edges */}
          <g className="edges">
            {visibleEdges.map((edge, i) => renderEdge(edge, i))}
          </g>

          {/* Nodes */}
          <g className="nodes">
            {visibleNodes.map(node => renderNode(node))}
          </g>

          {/* Annotations */}
          <g className="annotations">
            {annotations.map(annotation => renderAnnotation(annotation))}
          </g>
        </svg>

        {/* Color legend */}
        {overlaySettings.showFlux && Object.keys(fluxes).length > 0 && (
          <div className="absolute bottom-3 right-3 p-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-lg text-xs">
            <p className="font-medium text-[var(--text-primary)] mb-2">Flux Legend</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-2 rounded" style={{ backgroundColor: accessibleColors.success }} />
                <span className="text-[var(--text-secondary)]">Positive ({fluxStats.max.toFixed(1)})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-2 rounded" style={{ backgroundColor: accessibleColors.warning }} />
                <span className="text-[var(--text-secondary)]">Zero flux</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-2 rounded" style={{ backgroundColor: accessibleColors.danger }} />
                <span className="text-[var(--text-secondary)]">Negative ({fluxStats.min.toFixed(1)})</span>
              </div>
            </div>
            {overlaySettings.sizeScale && (
              <div className="mt-2 pt-2 border-t border-[var(--border-color)]">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-[1px] bg-[var(--text-secondary)]" />
                  <span className="text-[10px] text-[var(--text-muted)]">→</span>
                  <div className="w-4 h-[4px] bg-[var(--text-secondary)]" />
                  <span className="text-[10px] text-[var(--text-muted)] ml-1">|flux|</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mode indicator */}
        <div className="absolute top-3 left-3 px-2 py-1 bg-[var(--card-bg)] border border-[var(--card-border)] rounded text-xs font-medium text-[var(--text-secondary)]">
          Mode: {mode.replace('_', ' ').toUpperCase()}
        </div>

        {/* Selection info */}
        {(selectedNodes.size > 0 || selectedEdges.size > 0) && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-[var(--info-bg)] border border-[var(--info)] rounded text-xs text-[var(--info-text)]">
            Selected: {selectedNodes.size} nodes, {selectedEdges.size} reactions
          </div>
        )}
      </div>

      {/* Keyboard shortcuts help */}
      {showControls && (
        <div className="text-xs text-[var(--text-muted)] flex flex-wrap gap-4">
          <span><kbd className="px-1 bg-[var(--bg-primary)] rounded">Scroll</kbd> Zoom</span>
          <span><kbd className="px-1 bg-[var(--bg-primary)] rounded">Drag</kbd> Pan (in pan mode)</span>
          <span><kbd className="px-1 bg-[var(--bg-primary)] rounded">Click</kbd> Select</span>
          <span><kbd className="px-1 bg-[var(--bg-primary)] rounded">Double-click</kbd> Edit annotation</span>
        </div>
      )}
    </div>
  );
};

// Helper function
function hexToRgb(hex) {
  if (!hex || !hex.startsWith('#')) return '128, 128, 128';
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '128, 128, 128';
}

export default PathwayMapBuilder;
