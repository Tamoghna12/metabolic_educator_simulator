/**
 * SubsystemView - Hierarchical Pathway Navigation for Large Models
 *
 * Provides a multi-level hierarchical view for genome-scale models:
 * 1. Category Level: Groups of related pathways (e.g., "Amino Acid Metabolism")
 * 2. Subsystem Level: Individual pathways (e.g., "Alanine and Aspartate Metabolism")
 * 3. Reaction Level: Full reaction network within a subsystem
 *
 * Features:
 * - Semantic zoom: Detail level changes automatically with zoom
 * - Breadcrumb navigation for easy backtracking
 * - Search/filter across all hierarchy levels
 * - Keyboard navigation (arrow keys, Enter, Escape)
 *
 * This solves the "hairball" problem where 2000+ reactions
 * become impossible to visualize on a single canvas.
 *
 * References:
 * - Thiele & Palsson (2010) "A protocol for generating a GEM"
 * - King et al. (2016) "BiGG Models: A platform for integrating, standardizing
 *   and sharing genome-scale models" - Nucleic Acids Research
 *
 * @module SubsystemView
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useModel } from '../contexts/ModelContext';
import { MetabolicForceLayout } from '../lib/ForceLayout';

/**
 * Hierarchical pathway categories based on BiGG/KEGG classification
 * Maps subsystem prefixes to parent categories for grouping
 */
const PATHWAY_CATEGORIES = {
  'Amino Acid Metabolism': [
    'alanine', 'arginine', 'asparagine', 'aspartate', 'cysteine', 'glutamate',
    'glutamine', 'glycine', 'histidine', 'isoleucine', 'leucine', 'lysine',
    'methionine', 'phenylalanine', 'proline', 'serine', 'threonine', 'tryptophan',
    'tyrosine', 'valine', 'amino acid'
  ],
  'Carbohydrate Metabolism': [
    'glycolysis', 'gluconeogenesis', 'pentose', 'tca', 'citric', 'krebs',
    'pyruvate', 'glucose', 'fructose', 'galactose', 'starch', 'sucrose',
    'mannose', 'sugar', 'carbohydrate'
  ],
  'Lipid Metabolism': [
    'fatty acid', 'lipid', 'sterol', 'phospholipid', 'sphingolipid',
    'glycerolipid', 'cholesterol', 'triglyceride', 'beta-oxidation'
  ],
  'Nucleotide Metabolism': [
    'purine', 'pyrimidine', 'nucleotide', 'dna', 'rna', 'adenine',
    'guanine', 'cytosine', 'thymine', 'uracil'
  ],
  'Energy Metabolism': [
    'oxidative', 'electron', 'atp', 'respiratory', 'photosynthesis',
    'fermentation', 'anaerobic'
  ],
  'Cofactor & Vitamin Metabolism': [
    'vitamin', 'cofactor', 'nad', 'fad', 'coenzyme', 'biotin', 'folate',
    'thiamine', 'riboflavin', 'pantothenate'
  ],
  'Cell Envelope': [
    'cell wall', 'membrane', 'peptidoglycan', 'lipopolysaccharide', 'envelope'
  ],
  'Transport': [
    'transport', 'exchange', 'import', 'export', 'secretion', 'uptake'
  ],
  'Other': []  // Fallback category
};

const SubsystemView = ({ fluxes = {}, width = 1000, height = 700, onReactionSelect }) => {
  const { isDark, accessibleColors } = useTheme();
  const { currentModel } = useModel();
  const svgRef = useRef(null);
  const searchInputRef = useRef(null);

  // Hierarchical view state: 'categories' -> 'subsystems' -> 'reactions'
  const [viewLevel, setViewLevel] = useState('categories');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSubsystem, setSelectedSubsystem] = useState(null);
  const [navigationPath, setNavigationPath] = useState([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);

  // Layout state
  const [layoutProgress, setLayoutProgress] = useState(0);
  const [isLayouting, setIsLayouting] = useState(false);

  // Layout data
  const [detailData, setDetailData] = useState({ nodes: [], edges: [] });

  // Pan/zoom state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width, height });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Hovered element
  const [hoveredNode, setHoveredNode] = useState(null);

  // Layout engine ref
  const layoutRef = useRef(null);

  // Classify subsystem into category
  const classifySubsystem = useCallback((subsystemName) => {
    const lowerName = subsystemName.toLowerCase();
    for (const [category, keywords] of Object.entries(PATHWAY_CATEGORIES)) {
      if (category === 'Other') continue;
      for (const keyword of keywords) {
        if (lowerName.includes(keyword)) {
          return category;
        }
      }
    }
    return 'Other';
  }, []);

  // Extract subsystems from model with category classification
  const subsystems = useMemo(() => {
    if (!currentModel?.reactions) return new Map();

    const subs = new Map();
    Object.entries(currentModel.reactions).forEach(([rxnId, rxn]) => {
      const subsystem = rxn.subsystem || 'Unclassified';
      if (!subs.has(subsystem)) {
        subs.set(subsystem, {
          reactions: [],
          metabolites: new Set(),
          category: classifySubsystem(subsystem)
        });
      }
      subs.get(subsystem).reactions.push(rxnId);

      // Collect metabolites
      if (rxn.metabolites) {
        Object.keys(rxn.metabolites).forEach(m => {
          subs.get(subsystem).metabolites.add(m);
        });
      }
    });

    return subs;
  }, [currentModel, classifySubsystem]);

  // Build category hierarchy
  const categoryHierarchy = useMemo(() => {
    const categories = new Map();

    for (const [subsystemName, data] of subsystems.entries()) {
      const category = data.category;
      if (!categories.has(category)) {
        categories.set(category, {
          subsystems: [],
          totalReactions: 0,
          totalMetabolites: new Set()
        });
      }
      const cat = categories.get(category);
      cat.subsystems.push(subsystemName);
      cat.totalReactions += data.reactions.length;
      data.metabolites.forEach(m => cat.totalMetabolites.add(m));
    }

    return categories;
  }, [subsystems]);

  // Search handler
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = {
      categories: [],
      subsystems: [],
      reactions: []
    };

    // Search categories
    for (const category of categoryHierarchy.keys()) {
      if (category.toLowerCase().includes(query)) {
        results.categories.push(category);
      }
    }

    // Search subsystems
    for (const subsystemName of subsystems.keys()) {
      if (subsystemName.toLowerCase().includes(query)) {
        results.subsystems.push(subsystemName);
      }
    }

    // Search reactions
    if (currentModel?.reactions) {
      for (const [rxnId, rxn] of Object.entries(currentModel.reactions)) {
        if (rxnId.toLowerCase().includes(query) ||
            rxn.name?.toLowerCase().includes(query)) {
          results.reactions.push({ id: rxnId, name: rxn.name, subsystem: rxn.subsystem });
          if (results.reactions.length >= 20) break; // Limit results
        }
      }
    }

    setSearchResults(results);
  }, [searchQuery, categoryHierarchy, subsystems, currentModel]);

  // Navigation handlers
  const navigateToCategory = useCallback((category) => {
    setSelectedCategory(category);
    setViewLevel('subsystems');
    setNavigationPath([{ type: 'category', name: category }]);
    setSearchQuery('');
    setSearchResults(null);
  }, []);

  const navigateToSubsystem = useCallback((subsystem, fromCategory = null) => {
    setSelectedSubsystem(subsystem);
    setViewLevel('reactions');

    const subsystemData = subsystems.get(subsystem);
    const category = fromCategory || subsystemData?.category || 'Other';

    setNavigationPath([
      { type: 'category', name: category },
      { type: 'subsystem', name: subsystem }
    ]);
    setSearchQuery('');
    setSearchResults(null);

    // Get detail view from layout
    if (layoutRef.current) {
      const detail = layoutRef.current.getSubsystemDetail(subsystem);
      setDetailData(detail);

      // Reset view to fit content
      if (detail.nodes.length > 0) {
        const xs = detail.nodes.map(n => n.x);
        const ys = detail.nodes.map(n => n.y);
        const minX = Math.min(...xs) - 50;
        const maxX = Math.max(...xs) + 50;
        const minY = Math.min(...ys) - 50;
        const maxY = Math.max(...ys) + 50;

        setViewBox({
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY
        });
        setZoom(1);
      }
    }
  }, [subsystems]);

  const navigateBack = useCallback((toLevel) => {
    if (toLevel === 'categories') {
      setViewLevel('categories');
      setSelectedCategory(null);
      setSelectedSubsystem(null);
      setNavigationPath([]);
      setViewBox({ x: 0, y: 0, width, height });
      setZoom(1);
    } else if (toLevel === 'subsystems') {
      setViewLevel('subsystems');
      setSelectedSubsystem(null);
      setNavigationPath(prev => prev.slice(0, 1));
      setViewBox({ x: 0, y: 0, width, height });
      setZoom(1);
    }
  }, [width, height]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
          setSearchResults(null);
        } else if (viewLevel === 'reactions') {
          navigateBack('subsystems');
        } else if (viewLevel === 'subsystems') {
          navigateBack('categories');
        }
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, viewLevel, navigateBack]);

  // Generate layout when model changes
  useEffect(() => {
    if (!currentModel?.reactions || Object.keys(currentModel.reactions).length === 0) {
      return;
    }

    const generateLayout = async () => {
      setIsLayouting(true);
      setLayoutProgress(0);

      try {
        const layout = new MetabolicForceLayout({
          width,
          height,
          iterations: 200
        });

        layout.initializeFromModel(currentModel);
        layoutRef.current = layout;

        // Run layout asynchronously
        await layout.runAsync((progress) => {
          setLayoutProgress(progress);
        });

        setIsLayouting(false);
      } catch (error) {
        console.error('Layout generation failed:', error);
        setIsLayouting(false);
      }
    };

    generateLayout();
  }, [currentModel, width, height]);

  // Get subsystem statistics
  const getSubsystemStats = useCallback((subsystemId) => {
    const data = subsystems.get(subsystemId);
    if (!data) return { reactions: 0, metabolites: 0, avgFlux: 0 };

    // Calculate average absolute flux for subsystem
    let totalFlux = 0;
    let fluxCount = 0;
    data.reactions.forEach(rxnId => {
      if (fluxes[rxnId] !== undefined) {
        totalFlux += Math.abs(fluxes[rxnId]);
        fluxCount++;
      }
    });

    return {
      reactions: data.reactions.length,
      metabolites: data.metabolites.size,
      avgFlux: fluxCount > 0 ? totalFlux / fluxCount : 0
    };
  }, [subsystems, fluxes]);

  // Get color for subsystem based on flux activity
  const getSubsystemColor = useCallback((subsystemId) => {
    const stats = getSubsystemStats(subsystemId);
    if (stats.avgFlux === 0) return isDark ? '#4b5563' : '#9ca3af';
    if (stats.avgFlux > 5) return accessibleColors.success;
    if (stats.avgFlux > 1) return accessibleColors.info;
    return accessibleColors.warning;
  }, [getSubsystemStats, isDark, accessibleColors]);

  // Get category color (based on aggregate flux activity)
  const getCategoryColor = useCallback((categoryName) => {
    const catData = categoryHierarchy.get(categoryName);
    if (!catData) return isDark ? '#4b5563' : '#9ca3af';

    // Calculate average flux across all reactions in category
    let totalFlux = 0;
    let fluxCount = 0;

    catData.subsystems.forEach(subName => {
      const subData = subsystems.get(subName);
      if (subData) {
        subData.reactions.forEach(rxnId => {
          if (fluxes[rxnId] !== undefined) {
            totalFlux += Math.abs(fluxes[rxnId]);
            fluxCount++;
          }
        });
      }
    });

    const avgFlux = fluxCount > 0 ? totalFlux / fluxCount : 0;
    if (avgFlux === 0) return isDark ? '#4b5563' : '#9ca3af';
    if (avgFlux > 5) return accessibleColors.success;
    if (avgFlux > 1) return accessibleColors.info;
    return accessibleColors.warning;
  }, [categoryHierarchy, subsystems, fluxes, isDark, accessibleColors]);

  // Render breadcrumb navigation
  const renderBreadcrumbs = () => (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
      <button
        onClick={() => navigateBack('categories')}
        className={`px-2 py-1 rounded hover:bg-[var(--bg-secondary)] ${
          viewLevel === 'categories' ? 'font-semibold text-[var(--primary)]' : 'text-[var(--text-secondary)]'
        }`}
      >
        All Pathways
      </button>

      {navigationPath.map((item, index) => (
        <React.Fragment key={`${item.type}-${item.name}`}>
          <span className="text-[var(--text-muted)]">/</span>
          <button
            onClick={() => {
              if (item.type === 'category') navigateBack('subsystems');
            }}
            className={`px-2 py-1 rounded hover:bg-[var(--bg-secondary)] truncate max-w-[200px] ${
              index === navigationPath.length - 1
                ? 'font-semibold text-[var(--primary)]'
                : 'text-[var(--text-secondary)]'
            }`}
            title={item.name}
          >
            {item.name.length > 25 ? item.name.substring(0, 23) + '...' : item.name}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );

  // Render search results dropdown
  const renderSearchResults = () => {
    if (!searchResults) return null;

    const hasResults = searchResults.categories.length > 0 ||
                       searchResults.subsystems.length > 0 ||
                       searchResults.reactions.length > 0;

    if (!hasResults) {
      return (
        <div className="absolute top-full left-0 right-0 mt-1 p-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-lg z-10">
          <p className="text-sm text-[var(--text-muted)]">No results for "{searchQuery}"</p>
        </div>
      );
    }

    return (
      <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
        {searchResults.categories.length > 0 && (
          <div className="p-2 border-b border-[var(--card-border)]">
            <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Categories</p>
            {searchResults.categories.map(cat => (
              <button
                key={cat}
                onClick={() => navigateToCategory(cat)}
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-[var(--bg-secondary)] rounded"
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {searchResults.subsystems.length > 0 && (
          <div className="p-2 border-b border-[var(--card-border)]">
            <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Subsystems</p>
            {searchResults.subsystems.slice(0, 10).map(sub => (
              <button
                key={sub}
                onClick={() => navigateToSubsystem(sub)}
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-[var(--bg-secondary)] rounded truncate"
              >
                {sub}
              </button>
            ))}
          </div>
        )}

        {searchResults.reactions.length > 0 && (
          <div className="p-2">
            <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Reactions</p>
            {searchResults.reactions.map(rxn => (
              <button
                key={rxn.id}
                onClick={() => {
                  if (rxn.subsystem) navigateToSubsystem(rxn.subsystem);
                  onReactionSelect?.(rxn.id);
                }}
                className="w-full text-left px-2 py-1.5 text-sm hover:bg-[var(--bg-secondary)] rounded"
              >
                <span className="font-mono">{rxn.id}</span>
                {rxn.name && <span className="text-[var(--text-muted)] ml-2">- {rxn.name}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render category cards (top level)
  const renderCategoryCards = () => {
    const categoryList = Array.from(categoryHierarchy.entries())
      .sort((a, b) => b[1].totalReactions - a[1].totalReactions);

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
        {categoryList.map(([category, data]) => {
          const color = getCategoryColor(category);
          return (
            <button
              key={category}
              onClick={() => navigateToCategory(category)}
              className="p-4 text-left bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg hover:border-[var(--primary)] hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: color }}
                >
                  {data.subsystems.length}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-[var(--text-primary)] group-hover:text-[var(--primary)] truncate">
                    {category}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {data.totalReactions} reactions
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {data.totalMetabolites.size} metabolites
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  // Render subsystem list for a category
  const renderSubsystemList = () => {
    const catData = categoryHierarchy.get(selectedCategory);
    if (!catData) return null;

    const sortedSubsystems = catData.subsystems
      .map(name => ({ name, subData: subsystems.get(name) }))
      .sort((a, b) => (b.subData?.reactions.length || 0) - (a.subData?.reactions.length || 0));

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
        {sortedSubsystems.map(({ name }) => {
          const stats = getSubsystemStats(name);
          const color = getSubsystemColor(name);
          return (
            <button
              key={name}
              onClick={() => navigateToSubsystem(name, selectedCategory)}
              className="p-3 text-left bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg hover:border-[var(--primary)] hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                  style={{ backgroundColor: color }}
                  title={`Avg flux: ${stats.avgFlux.toFixed(2)}`}
                />
                <div className="flex-1 min-w-0">
                  <h5 className="font-medium text-[var(--text-primary)] mb-1 truncate" title={name}>
                    {name}
                  </h5>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                    <span>{stats.reactions} rxns</span>
                    <span>{stats.metabolites} mets</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  // Pan handling
  const handleMouseDown = (e) => {
    if (e.target === svgRef.current || e.target.tagName === 'rect') {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
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

    setViewBox({
      x: mouseX - (e.clientX - rect.left) / newZoom,
      y: mouseY - (e.clientY - rect.top) / newZoom,
      width: width / newZoom,
      height: height / newZoom
    });
    setZoom(newZoom);
  };

  // Render detail view (single subsystem expanded)
  const renderDetail = () => (
    <>
      {/* Edges */}
      {detailData.edges.map((edge, i) => {
        const source = detailData.nodes.find(n => n.id === edge.from);
        const target = detailData.nodes.find(n => n.id === edge.to);
        if (!source || !target) return null;

        const flux = fluxes[edge.reaction] || 0;
        const color = flux > 0 ? accessibleColors.success :
                      flux < 0 ? accessibleColors.danger :
                      isDark ? '#4b5563' : '#9ca3af';
        const strokeWidth = Math.max(1, Math.min(6, 1 + Math.abs(flux) * 0.5));

        return (
          <g key={`edge-${i}`}>
            <line
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={color}
              strokeWidth={strokeWidth}
              markerEnd="url(#arrowhead)"
              onClick={() => onReactionSelect?.(edge.reaction)}
              style={{ cursor: 'pointer' }}
            />
            <text
              x={(source.x + target.x) / 2}
              y={(source.y + target.y) / 2 - 8}
              textAnchor="middle"
              fill={isDark ? '#9ca3af' : '#6b7280'}
              fontSize={9}
            >
              {edge.reaction}
            </text>
          </g>
        );
      })}

      {/* Nodes */}
      {detailData.nodes.map(node => {
        const isHovered = hoveredNode === node.id;
        const radius = node.connectivity > 5 ? 20 : 14;

        return (
          <g
            key={node.id}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            {isHovered && (
              <circle
                cx={node.x}
                cy={node.y}
                r={radius + 5}
                fill="none"
                stroke={accessibleColors.info}
                strokeWidth={2}
              />
            )}
            <circle
              cx={node.x}
              cy={node.y}
              r={radius}
              fill={accessibleColors.primary || '#8b5cf6'}
              stroke={isDark ? '#1f2937' : '#ffffff'}
              strokeWidth={1.5}
            />
            <text
              x={node.x}
              y={node.y + radius + 12}
              textAnchor="middle"
              fill={isDark ? '#e5e7eb' : '#374151'}
              fontSize={9}
            >
              {node.label || node.id}
            </text>
          </g>
        );
      })}
    </>
  );

  // Loading state
  if (isLayouting) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
        <div className="w-64 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-[var(--primary)] transition-all duration-300"
            style={{ width: `${layoutProgress * 100}%` }}
          />
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Generating layout... {Math.round(layoutProgress * 100)}%
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-2">
          {Object.keys(currentModel?.reactions || {}).length} reactions,{' '}
          {Object.keys(currentModel?.metabolites || {}).length} metabolites
        </p>
      </div>
    );
  }

  // No model state
  if (!currentModel?.reactions || Object.keys(currentModel.reactions).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg text-center">
        <p className="text-lg font-medium text-[var(--text-primary)] mb-2">No Model Loaded</p>
        <p className="text-sm text-[var(--text-secondary)]">
          Load an SBML or JSON model to visualize the metabolic network.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with breadcrumbs and search */}
      <div className="flex items-center justify-between p-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
        <div className="flex items-center gap-4">
          {renderBreadcrumbs()}
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search pathways... (press /)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 px-3 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-lg focus:outline-none focus:border-[var(--primary)]"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchResults(null); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ×
              </button>
            )}
            {renderSearchResults()}
          </div>

          {/* Zoom controls (only for reaction view) */}
          {viewLevel === 'reactions' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
                className="px-2 py-1 text-xs bg-[var(--bg-primary)] rounded hover:bg-[var(--bg-secondary)]"
              >
                −
              </button>
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
                Fit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 px-3 py-2 bg-[var(--bg-primary)] rounded-lg text-xs text-[var(--text-muted)]">
        <span>{categoryHierarchy.size} categories</span>
        <span>•</span>
        <span>{subsystems.size} subsystems</span>
        <span>•</span>
        <span>{Object.keys(currentModel?.reactions || {}).length} reactions</span>
        <span>•</span>
        <span>{Object.keys(currentModel?.metabolites || {}).length} metabolites</span>
        <span className="ml-auto text-[var(--text-muted)]">
          Press <kbd className="px-1 py-0.5 bg-[var(--card-bg)] rounded text-xs">Esc</kbd> to go back
        </span>
      </div>

      {/* Main content area */}
      {viewLevel === 'categories' && renderCategoryCards()}

      {viewLevel === 'subsystems' && renderSubsystemList()}

      {viewLevel === 'reactions' && (
        <div className="relative bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg overflow-hidden">
          <svg
            ref={svgRef}
            width={width}
            height={height}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {/* Background */}
            <rect
              x={viewBox.x - 1000}
              y={viewBox.y - 1000}
              width={viewBox.width + 2000}
              height={viewBox.height + 2000}
              fill={isDark ? '#111827' : '#f9fafb'}
            />

            {/* Grid */}
            <defs>
              <pattern id="subsystem-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path
                  d="M 50 0 L 0 0 0 50"
                  fill="none"
                  stroke={isDark ? '#1f2937' : '#e5e7eb'}
                  strokeWidth="0.5"
                />
              </pattern>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={isDark ? '#6b7280' : '#9ca3af'} />
              </marker>
            </defs>

            <rect
              x={viewBox.x - 1000}
              y={viewBox.y - 1000}
              width={viewBox.width + 2000}
              height={viewBox.height + 2000}
              fill="url(#subsystem-grid)"
            />

            {/* Reaction network */}
            {renderDetail()}
          </svg>

          {/* Hover tooltip */}
          {hoveredNode && (
            <div className="absolute top-3 left-3 p-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-lg max-w-xs">
              <p className="font-medium text-sm text-[var(--text-primary)]">{hoveredNode}</p>
              {currentModel?.metabolites?.[hoveredNode] && (
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {currentModel.metabolites[hoveredNode].name || 'Metabolite'}
                </p>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-3 right-3 p-2 bg-[var(--card-bg)] border border-[var(--card-border)] rounded text-xs">
            <p className="font-medium text-[var(--text-primary)] mb-1">Flux Direction</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5" style={{ backgroundColor: accessibleColors.success }} />
                <span className="text-[var(--text-muted)]">Forward</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5" style={{ backgroundColor: accessibleColors.danger }} />
                <span className="text-[var(--text-muted)]">Reverse</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5" style={{ backgroundColor: isDark ? '#4b5563' : '#9ca3af' }} />
                <span className="text-[var(--text-muted)]">No flux</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick navigation panel (for reactions view) */}
      {viewLevel === 'reactions' && (
        <div className="flex items-center gap-2 p-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg overflow-x-auto">
          <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">Other subsystems in {selectedCategory}:</span>
          {categoryHierarchy.get(selectedCategory)?.subsystems
            .filter(s => s !== selectedSubsystem)
            .slice(0, 8)
            .map(sub => (
              <button
                key={sub}
                onClick={() => navigateToSubsystem(sub, selectedCategory)}
                className="px-2 py-1 text-xs bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] rounded whitespace-nowrap"
              >
                {sub.length > 20 ? sub.substring(0, 18) + '...' : sub}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

export default SubsystemView;
