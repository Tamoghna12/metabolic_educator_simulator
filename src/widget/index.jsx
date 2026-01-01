/**
 * Jupyter Widget Entry Point
 *
 * This module exports a render function that initializes the
 * PathwayMapWidget component in a Jupyter notebook cell.
 *
 * Used by anywidget to render the widget.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * anywidget render function - main entry point for Jupyter widget.
 *
 * @param {Object} context - anywidget render context
 * @param {Object} context.model - Jupyter widget model with get/set/on methods
 * @param {HTMLElement} context.el - Container element to render into
 */
export function render({ model, el }) {
  const root = createRoot(el);

  const renderWidget = () => {
    root.render(
      <PathwayMapWidget
        modelData={model.get('model_data')}
        fluxes={model.get('fluxes')}
        nodes={model.get('nodes')}
        edges={model.get('edges')}
        omicsData={model.get('omics_data')}
        visSettings={model.get('vis_settings')}
        width={model.get('width')}
        height={model.get('height')}
        showControls={model.get('show_controls')}
        animationEnabled={model.get('animation_enabled')}
        onNodeSelect={(nodeId) => {
          model.set('selected_node', nodeId);
          model.save_changes();
        }}
        onReactionSelect={(rxnId) => {
          model.set('selected_reaction', rxnId);
          model.save_changes();
        }}
      />
    );
  };

  // Initial render
  renderWidget();

  // Re-render on model changes
  model.on('change:fluxes', renderWidget);
  model.on('change:omics_data', renderWidget);
  model.on('change:vis_settings', renderWidget);
  model.on('change:nodes', renderWidget);
  model.on('change:edges', renderWidget);

  // Cleanup on unmount
  return () => root.unmount();
}

// Simplified PathwayMap for widget (subset of full PathwayMapBuilder)
const PathwayMapWidget = ({
  modelData,
  fluxes,
  nodes: initialNodes,
  edges: initialEdges,
  omicsData,
  visSettings,
  width,
  height,
  showControls,
  animationEnabled: initialAnimationEnabled,
  onNodeSelect,
  onReactionSelect,
  onExport
}) => {
  const [nodes, setNodes] = useState(initialNodes || []);
  const [edges, setEdges] = useState(initialEdges || []);
  const [animationEnabled, setAnimationEnabled] = useState(initialAnimationEnabled);
  const [hoveredElement, setHoveredElement] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedReaction, setSelectedReaction] = useState(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width, height });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Update from props
  useEffect(() => {
    if (initialNodes) setNodes(initialNodes);
  }, [initialNodes]);

  useEffect(() => {
    if (initialEdges) setEdges(initialEdges);
  }, [initialEdges]);

  // Get flux-based color
  const getEdgeColor = useCallback((reactionId) => {
    if (!fluxes || fluxes[reactionId] === undefined) {
      return '#9ca3af';
    }
    const flux = fluxes[reactionId];
    if (Math.abs(flux) < 1e-6) return '#fbbf24';
    return flux > 0 ? '#22c55e' : '#ef4444';
  }, [fluxes]);

  // Get flux-based width
  const getEdgeWidth = useCallback((reactionId) => {
    if (!fluxes || fluxes[reactionId] === undefined) return 2;
    const maxFlux = Math.max(...Object.values(fluxes).map(Math.abs)) || 1;
    const flux = Math.abs(fluxes[reactionId]);
    return 1 + (flux / maxFlux) * 5;
  }, [fluxes]);

  // Get animation style
  const getAnimationStyle = useCallback((reactionId) => {
    if (!animationEnabled || !fluxes || !fluxes[reactionId]) return {};
    const flux = fluxes[reactionId];
    const maxFlux = Math.max(...Object.values(fluxes).map(Math.abs)) || 1;
    const speed = 3 - (Math.abs(flux) / maxFlux) * 2;

    return {
      strokeDasharray: '8 4',
      animation: `flowAnimation ${speed}s linear infinite`,
      animationDirection: flux < 0 ? 'reverse' : 'normal'
    };
  }, [animationEnabled, fluxes]);

  // Pan handling
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'svg' || e.target.tagName === 'rect') {
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
    setZoom(newZoom);
    setViewBox(prev => ({
      ...prev,
      width: width / newZoom,
      height: height / newZoom
    }));
  };

  // Handle node click
  const handleNodeClick = (nodeId) => {
    setSelectedNode(nodeId);
    onNodeSelect?.(nodeId);
  };

  // Handle reaction click
  const handleReactionClick = (reactionId) => {
    setSelectedReaction(reactionId);
    onReactionSelect?.(reactionId);
  };

  // Get node color (with omics overlay support)
  const getNodeColor = (node) => {
    if (omicsData?.metabolomics?.data?.[node.id]) {
      const value = Object.values(omicsData.metabolomics.data[node.id])[0];
      return value > 0 ? '#22c55e' : '#ef4444';
    }
    if (node.type === 'exchange') return '#3b82f6';
    if (node.type === 'biomass') return '#22c55e';
    return '#8b5cf6';
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes flowAnimation {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      {showControls && (
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '8px',
          background: '#f3f4f6',
          borderRadius: '8px 8px 0 0',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <button
            onClick={() => setAnimationEnabled(!animationEnabled)}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              border: 'none',
              borderRadius: '4px',
              background: animationEnabled ? '#22c55e' : '#9ca3af',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            {animationEnabled ? '▶ Flow' : '⏸ Flow'}
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setViewBox({ x: 0, y: 0, width, height });
            }}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            Reset View
          </button>
          <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: 'auto' }}>
            Zoom: {Math.round(zoom * 100)}%
          </span>
        </div>
      )}

      <svg
        width={width}
        height={height}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        style={{
          background: '#fafafa',
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'block'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
          </pattern>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
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
        {edges.map((edge, i) => {
          const fromNode = nodes.find(n => n.id === edge.from);
          const toNode = nodes.find(n => n.id === edge.to);
          if (!fromNode || !toNode) return null;

          const dx = toNode.x - fromNode.x;
          const dy = toNode.y - fromNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          const endX = toNode.x - Math.cos(angle) * 20;
          const endY = toNode.y - Math.sin(angle) * 20;

          return (
            <g key={i}>
              <line
                x1={fromNode.x}
                y1={fromNode.y}
                x2={endX}
                y2={endY}
                stroke={getEdgeColor(edge.reaction)}
                strokeWidth={getEdgeWidth(edge.reaction)}
                markerEnd="url(#arrowhead)"
                style={getAnimationStyle(edge.reaction)}
                opacity={selectedReaction && selectedReaction !== edge.reaction ? 0.3 : 1}
                onClick={() => handleReactionClick(edge.reaction)}
                cursor="pointer"
              />
              <text
                x={(fromNode.x + endX) / 2}
                y={(fromNode.y + endY) / 2 - 8}
                textAnchor="middle"
                fontSize="10"
                fill="#6b7280"
              >
                {edge.label || edge.reaction}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const radius = node.type === 'biomass' ? 28 : node.type === 'exchange' ? 24 : 18;
          const isSelected = selectedNode === node.id;

          return (
            <g
              key={node.id}
              onClick={() => handleNodeClick(node.id)}
              cursor="pointer"
              onMouseEnter={() => setHoveredElement(node.id)}
              onMouseLeave={() => setHoveredElement(null)}
            >
              {isSelected && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius + 5}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={getNodeColor(node)}
                stroke={isSelected ? '#1d4ed8' : '#d1d5db'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <text
                x={node.x}
                y={node.y + radius + 14}
                textAnchor="middle"
                fontSize="11"
                fill="#374151"
              >
                {node.label}
              </text>
            </g>
          );
        })}

        {/* Hover tooltip */}
        {hoveredElement && (
          <foreignObject x={10} y={10} width={200} height={80}>
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px',
              fontSize: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <strong>{hoveredElement}</strong>
              {fluxes && fluxes[hoveredElement] !== undefined && (
                <div style={{ color: '#6b7280', marginTop: '4px' }}>
                  Flux: {fluxes[hoveredElement].toFixed(3)} mmol/gDW/h
                </div>
              )}
            </div>
          </foreignObject>
        )}
      </svg>

      {/* Legend */}
      {fluxes && Object.keys(fluxes).length > 0 && (
        <div style={{
          display: 'flex',
          gap: '16px',
          padding: '8px',
          background: '#f3f4f6',
          borderRadius: '0 0 8px 8px',
          fontSize: '11px',
          color: '#6b7280'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '12px', height: '12px', background: '#22c55e', borderRadius: '2px' }} />
            Positive flux
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px' }} />
            Negative flux
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '12px', height: '12px', background: '#fbbf24', borderRadius: '2px' }} />
            Zero flux
          </span>
        </div>
      )}
    </div>
  );
};

// Default export for anywidget compatibility
export default { render };
