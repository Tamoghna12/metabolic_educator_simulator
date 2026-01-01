import React, { useState, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { nodes, edges } from '../data/metabolicData';

export const NetworkGraph = ({ fluxes, width = 600, height = 400 }) => {
  const [hoveredNode, setHoveredNode] = useState(null);
  const { isDark, accessibleColors } = useTheme();

  const getEdgeColor = (reaction) => {
    if (!fluxes || fluxes[reaction] === undefined) return 'var(--border-color)';
    const flux = fluxes[reaction];
    if (flux === 0) return 'var(--border-color)';
    if (flux > 0) return accessibleColors.success;
    return accessibleColors.danger;
  };

  const handleNodeFocus = (id) => setHoveredNode(id);
  const handleNodeBlur = () => setHoveredNode(null);
  const handleKeyDown = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') {
      setHoveredNode(id === hoveredNode ? null : id);
    }
  };

  const getEdgeWidth = (reaction) => {
    if (!fluxes || fluxes[reaction] === undefined) return 1;
    return Math.max(1, Math.min(Math.abs(fluxes[reaction]) / 2, 6));
  };

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg overflow-hidden shadow-sm">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Metabolic Network Graph">
        <title>Metabolic Network Visualization</title>
        <desc>A directed graph showing metabolic reactions and metabolites. Edges represent reactions and nodes represent metabolites.</desc>
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--text-secondary)" />
          </marker>
        </defs>

        {edges.map((edge, i) => {
          const fromNode = nodes.find(n => n.id === edge.from);
          const toNode = nodes.find(n => n.id === edge.to);
          if (!fromNode || !toNode) return null;

          const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
          const endX = toNode.x - Math.cos(angle) * 20;
          const endY = toNode.y - Math.sin(angle) * 20;

          return (
            <g key={i} className="edge-group">
              <line
                x1={fromNode.x}
                y1={fromNode.y}
                x2={endX}
                y2={endY}
                stroke={getEdgeColor(edge.reaction)}
                strokeWidth={getEdgeWidth(edge.reaction)}
                markerEnd="url(#arrowhead)"
                opacity={hoveredNode && hoveredNode !== edge.reaction ? 0.3 : 1}
                onMouseEnter={() => setHoveredNode(edge.reaction)}
                onMouseLeave={() => setHoveredNode(null)}
              />
              <text
                x={(fromNode.x + endX) / 2}
                y={(fromNode.y + endY) / 2 - 5}
                className="fill-[var(--text-secondary)] text-xs font-medium pointer-events-none"
                textAnchor="middle"
              >
                {edge.reaction}
              </text>
            </g>
          );
        })}

        {nodes.map(node => (
          <g key={node.id} className="node-group" 
             tabIndex="0" 
             role="button"
             aria-label={`${node.label} ${node.type}`}
             onFocus={() => handleNodeFocus(node.id)}
             onBlur={handleNodeBlur}
             onKeyDown={(e) => handleKeyDown(e, node.id)}
             style={{ outline: 'none' }}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={node.type === 'exchange' || node.type === 'biomass' ? 25 : 15}
              fill={
                node.type === 'exchange' ? accessibleColors.info :
                node.type === 'biomass' ? accessibleColors.success :
                node.type === 'metabolite' ? 'var(--primary)' :
                'var(--text-secondary)'
              }
              stroke={hoveredNode === node.id ? 'var(--text-primary)' : 'var(--border-color)'}
              strokeWidth={hoveredNode === node.id ? 2.5 : 1.5}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer transition-all focus:stroke-[var(--primary)] focus:stroke-2"
            />
            <text
              x={node.x}
              y={node.y + (node.type === 'exchange' || node.type === 'biomass' ? 35 : 25)}
              className={`fill-[var(--text-primary)] text-xs font-medium ${node.type === 'exchange' || node.type === 'biomass' ? 'text-xs' : 'text-[10px]'}`}
              textAnchor="middle"
            >
              {node.label}
            </text>
          </g>
        ))}

        {hoveredNode && (
          <foreignObject x={10} y={10} width={220} height={90}>
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded shadow-lg p-3 text-xs">
              <p className="text-[var(--text-primary)] font-semibold mb-1">{hoveredNode}</p>
              {fluxes && fluxes[hoveredNode] !== undefined && (
                <p className="text-[var(--text-secondary)]">Flux: <span className="font-mono font-medium">{fluxes[hoveredNode]?.toFixed(2)}</span> mmol/gDW/h</p>
              )}
            </div>
          </foreignObject>
        )}
      </svg>
    </div>
  );
};

export const FluxHeatmap = ({ fluxes, width = 400, height = 300 }) => {
  const { accessibleColors } = useTheme();
  if (!fluxes) return null;

  const rxnList = Object.keys(fluxes).slice(0, 20);
  const conditions = ['Wild Type', 'Mutant 1', 'Mutant 2'];

  // Convert hex to rgba for opacity support
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const getColor = (value) => {
    const maxFlux = Math.max(...Object.values(fluxes).map(v => Math.abs(v)));
    const normalized = Math.abs(value) / maxFlux;
    const positiveColor = accessibleColors.success.startsWith('#') ? accessibleColors.success : '#16a34a';
    const negativeColor = accessibleColors.danger.startsWith('#') ? accessibleColors.danger : '#dc2626';
    if (value >= 0) {
      return hexToRgba(positiveColor, normalized * 0.8);
    }
    return hexToRgba(negativeColor, normalized * 0.8);
  };

  const cellSize = Math.min(width / (conditions.length + 1), 16);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-[var(--text-primary)]">Flux Distribution Heatmap</h4>
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-4 overflow-x-auto shadow-sm">
        <div className="inline-block">
          <svg width={Math.max(width, (conditions.length + 1) * cellSize + 100)} height={Math.max(height, rxnList.length * cellSize + 50)}>
            {rxnList.map((rxn, i) => (
              <g key={rxn}>
                <text
                  x={80}
                  y={i * cellSize + cellSize * 0.7}
                  className="fill-[var(--text-secondary)] text-[10px] font-medium"
                  textAnchor="end"
                >
                  {rxn}
                </text>
                {conditions.map((cond, j) => {
                  const flux = Math.random() * 10 - 5;
                  return (
                    <rect
                      key={`${rxn}-${cond}`}
                      x={100 + j * cellSize}
                      y={i * cellSize}
                      width={cellSize - 2}
                      height={cellSize - 2}
                      fill={getColor(flux)}
                      rx={2}
                    />
                  );
                })}
              </g>
            ))}
            {conditions.map((cond, i) => (
              <text
                key={cond}
                x={100 + i * cellSize + cellSize / 2}
                y={rxnList.length * cellSize + 20}
                className="fill-[var(--text-secondary)] text-[10px] font-medium"
                textAnchor="middle"
              >
                {cond}
              </text>
            ))}
            <text x={80} y={rxnList.length * cellSize + 20} className="fill-[var(--text-secondary)] text-[10px]" textAnchor="end">
              Reaction
            </text>
          </svg>
        </div>
        <div className="flex items-center justify-center gap-3 mt-4">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: accessibleColors.danger.startsWith('#') ? accessibleColors.danger : '#dc2626' }} />
          <span className="text-xs text-[var(--text-secondary)]">Negative Flux</span>
          <div className="w-4 h-4 rounded" style={{ backgroundColor: accessibleColors.success.startsWith('#') ? accessibleColors.success : '#16a34a' }} />
          <span className="text-xs text-[var(--text-secondary)]">Positive Flux</span>
        </div>
      </div>
    </div>
  );
};

export const PathwayDiagram = ({ pathway, activeReactions = [] }) => {
  const { accessibleColors } = useTheme();
  const pathways = {
    glycolysis: {
      name: 'Glycolysis',
      reactions: ['GLCpts', 'PGI', 'PFK', 'FBA', 'TPI', 'GAPD', 'PGK', 'PGM', 'ENO', 'PYK']
    },
    tca: {
      name: 'TCA Cycle',
      reactions: ['PDH', 'CS', 'PPC']
    },
    overflow: {
      name: 'Overflow Metabolism',
      reactions: ['PTA', 'ACKr']
    }
  };

  const selected = pathways[pathway] || pathways.glycolysis;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-[var(--text-primary)]">{selected.name}</h4>
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-4">
        <div className="flex flex-wrap gap-2" role="list" aria-label={`${selected.name} pathway reactions`}>
          {selected.reactions.map(rxn => {
            const isActive = activeReactions.includes(rxn);
            return (
              <span
                key={rxn}
                role="listitem"
                className={`px-3 py-1.5 rounded text-xs font-mono transition-all border ${
                  isActive
                    ? 'bg-[var(--success-bg)] border-[var(--success)] text-[var(--success-text)]'
                    : 'bg-[var(--bg-primary)] border-[var(--card-border)] text-[var(--text-secondary)]'
                }`}
                style={isActive ? { borderColor: accessibleColors.success } : {}}
                aria-label={`${rxn} reaction${isActive ? ' (active)' : ''}`}
              >
                {rxn}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const ReactionDetail = ({ reaction, genes, blocked }) => {
  const { accessibleColors } = useTheme();
  if (!reaction) return null;

  const isBlocked = blocked?.includes(reaction.id);
  const reactionGenes = reaction.genes || [];

  return (
    <div className="space-y-3 p-5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-sm" role="region" aria-label={`Reaction details for ${reaction.id}`}>
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-sm font-bold text-[var(--primary)] font-mono">{reaction.id}</h4>
          <p className="text-xs text-[var(--text-secondary)]">{reaction.name}</p>
        </div>
        {isBlocked && (
          <span
            className="px-2 py-1 bg-[var(--danger-bg)] text-[var(--danger-text)] text-xs font-semibold rounded border"
            style={{ borderColor: accessibleColors.danger }}
            role="status"
            aria-label="Reaction is blocked"
          >
            Blocked
          </span>
        )}
      </div>

      <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded">
        <p className="text-xs text-[var(--text-primary)] font-serif italic">{reaction.equation}</p>
      </div>

      {reaction.gpr && (
        <div>
          <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1.5">Gene-Protein-Reaction Rule:</p>
          <p
            className="text-xs font-mono bg-[var(--success-bg)] text-[var(--success-text)] inline-block px-2 py-1 rounded border"
            style={{ borderColor: accessibleColors.success }}
          >
            {reaction.gpr}
          </p>
        </div>
      )}

      {reactionGenes.length > 0 && (
        <div>
          <p className="text-xs text-[var(--text-secondary)] font-semibold mb-2">Associated Genes:</p>
          <div className="flex flex-wrap gap-1.5" role="list" aria-label="Associated genes">
            {reactionGenes.map(geneId => {
              const gene = genes[geneId];
              const isKO = geneId.includes('KO');
              return (
                <span
                  key={geneId}
                  role="listitem"
                  className={`px-2 py-1 rounded text-xs font-mono border ${
                    isKO
                      ? 'bg-[var(--danger-bg)] text-[var(--danger-text)]'
                      : 'bg-[var(--bg-primary)] border-[var(--card-border)] text-[var(--text-primary)]'
                  }`}
                  style={isKO ? { borderColor: accessibleColors.danger } : {}}
                  aria-label={`${geneId}${isKO ? ' (knocked out)' : ''}${gene?.essential ? ' (essential)' : ''}`}
                >
                  {geneId}
                  {gene?.essential && (
                    <span
                      className="ml-1 text-xs font-semibold"
                      style={{ color: accessibleColors.warning }}
                      title="Essential gene"
                      aria-hidden="true"
                    >
                      ⚠
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="pt-3 border-t border-[var(--card-border)]">
        <p className="text-xs text-[var(--text-secondary)]">Subsystem: <span className="font-medium text-[var(--text-primary)]">{reaction.subsystem}</span></p>
      </div>
    </div>
  );
};

export const ComparativeAnalysis = ({ results }) => {
  const { accessibleColors } = useTheme();
  if (!results || results.length < 2) return null;

  const metrics = ['Growth Rate', 'Yield', 'Acetate Production', 'CO₂ Production'];
  const data = results.map(r => ({
    name: r.label || 'Condition',
    growth: r.growthRate,
    yield: r.yield * 100,
    acetate: r.acetate,
    co2: r.co2
  }));

  const maxValues = {
    growth: Math.max(...data.map(d => d.growth)) || 1,
    yield: Math.max(...data.map(d => d.yield)) || 1,
    acetate: Math.max(...data.map(d => d.acetate)) || 1,
    co2: Math.max(...data.map(d => d.co2)) || 1
  };

  // Use accessible colors for bar chart - these are distinguishable for colorblind users
  const getBarColors = () => [
    accessibleColors.info,     // Blue/Purple
    accessibleColors.success,  // Green/Blue
    accessibleColors.warning,  // Orange/Gold
    accessibleColors.danger    // Red/Magenta
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-[var(--text-primary)]">Comparative Analysis</h4>
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-4 shadow-sm" role="region" aria-label="Comparative analysis of metabolic conditions">
        <div className="space-y-4">
          {metrics.map(metric => {
            const key = metric.toLowerCase().replace(' production', '').replace('₂', '2').replace(' ', '');
            return (
              <div key={metric} role="group" aria-label={`${metric} comparison`}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--text-secondary)] font-medium">{metric}</span>
                </div>
                <div className="space-y-1.5">
                  {data.map((d, i) => {
                    const barColors = getBarColors();
                    const percentage = (d[key] / maxValues[key]) * 100;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-24 text-xs text-[var(--text-secondary)] truncate font-medium">{d.name}</span>
                        <div
                          className="flex-1 h-3 bg-[var(--bg-primary)] border border-[var(--card-border)] rounded-full overflow-hidden"
                          role="progressbar"
                          aria-valuenow={d[key]?.toFixed(2)}
                          aria-valuemin="0"
                          aria-valuemax={maxValues[key]?.toFixed(2)}
                          aria-label={`${d.name} ${metric}: ${d[key]?.toFixed(2)}`}
                        >
                          <div
                            className="h-full transition-all"
                            style={{ width: `${percentage}%`, backgroundColor: barColors[i % barColors.length] }}
                          />
                        </div>
                        <span className="text-xs text-[var(--text-secondary)] w-14 text-right font-mono">{d[key]?.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
