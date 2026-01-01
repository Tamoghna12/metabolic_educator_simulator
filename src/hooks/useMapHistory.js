/**
 * useMapHistory - Undo/Redo History Hook for PathwayMapBuilder
 *
 * Implements a command-pattern based history system for tracking
 * map state changes and enabling undo/redo operations.
 */

import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY_SIZE = 50;

export function useMapHistory(initialNodes = [], initialEdges = [], initialAnnotations = []) {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [annotations, setAnnotations] = useState(initialAnnotations);

  // History stacks
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Take a snapshot of current state
  const takeSnapshot = useCallback(() => {
    return {
      nodes: nodes.map(n => ({ ...n })),
      edges: edges.map(e => ({ ...e })),
      annotations: annotations.map(a => ({ ...a })),
      timestamp: Date.now()
    };
  }, [nodes, edges, annotations]);

  // Push state to history
  const pushHistory = useCallback((action = 'unknown') => {
    const snapshot = takeSnapshot();
    snapshot.action = action;

    // Clear future when new action is taken
    futureRef.current = [];

    // Add to history
    historyRef.current = [
      ...historyRef.current.slice(-MAX_HISTORY_SIZE + 1),
      snapshot
    ];
    setHistoryIndex(historyRef.current.length - 1);
  }, [takeSnapshot]);

  // Apply a state snapshot
  const applySnapshot = useCallback((snapshot) => {
    setNodes(snapshot.nodes.map(n => ({ ...n })));
    setEdges(snapshot.edges.map(e => ({ ...e })));
    setAnnotations(snapshot.annotations.map(a => ({ ...a })));
  }, []);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex < 0 || historyRef.current.length === 0) return false;

    // Save current state to future
    futureRef.current = [takeSnapshot(), ...futureRef.current];

    // Get previous state
    const prevState = historyRef.current[historyIndex];
    if (prevState) {
      applySnapshot(prevState);
      setHistoryIndex(historyIndex - 1);
      return true;
    }
    return false;
  }, [historyIndex, takeSnapshot, applySnapshot]);

  // Redo
  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return false;

    // Push current to history
    historyRef.current = [...historyRef.current, takeSnapshot()];
    setHistoryIndex(historyRef.current.length - 1);

    // Get future state
    const [nextState, ...rest] = futureRef.current;
    futureRef.current = rest;

    if (nextState) {
      applySnapshot(nextState);
      return true;
    }
    return false;
  }, [takeSnapshot, applySnapshot]);

  // Clear history
  const clearHistory = useCallback(() => {
    historyRef.current = [];
    futureRef.current = [];
    setHistoryIndex(-1);
  }, []);

  // Update nodes with history tracking
  const updateNodes = useCallback((updater, action = 'Update nodes') => {
    pushHistory(action);
    setNodes(typeof updater === 'function' ? updater : () => updater);
  }, [pushHistory]);

  // Update edges with history tracking
  const updateEdges = useCallback((updater, action = 'Update edges') => {
    pushHistory(action);
    setEdges(typeof updater === 'function' ? updater : () => updater);
  }, [pushHistory]);

  // Update annotations with history tracking
  const updateAnnotations = useCallback((updater, action = 'Update annotations') => {
    pushHistory(action);
    setAnnotations(typeof updater === 'function' ? updater : () => updater);
  }, [pushHistory]);

  // Move node (frequent operation, batch history)
  const moveNode = useCallback((nodeId, x, y, final = false) => {
    if (final) {
      pushHistory('Move node');
    }
    setNodes(prev => prev.map(n =>
      n.id === nodeId ? { ...n, x, y } : n
    ));
  }, [pushHistory]);

  // Add node
  const addNode = useCallback((node) => {
    pushHistory('Add node');
    setNodes(prev => [...prev, node]);
    return node.id;
  }, [pushHistory]);

  // Remove node and connected edges
  const removeNode = useCallback((nodeId) => {
    pushHistory('Remove node');
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId));
  }, [pushHistory]);

  // Add edge
  const addEdge = useCallback((edge) => {
    pushHistory('Add edge');
    setEdges(prev => [...prev, edge]);
    return edge.reaction || `edge_${Date.now()}`;
  }, [pushHistory]);

  // Remove edge
  const removeEdge = useCallback((reactionId) => {
    pushHistory('Remove edge');
    setEdges(prev => prev.filter(e => e.reaction !== reactionId));
  }, [pushHistory]);

  // Batch update (multiple changes as one action)
  const batchUpdate = useCallback((updateFn, action = 'Batch update') => {
    pushHistory(action);
    updateFn({ setNodes, setEdges, setAnnotations });
  }, [pushHistory]);

  return {
    // State
    nodes,
    edges,
    annotations,
    setNodes,
    setEdges,
    setAnnotations,

    // History operations
    undo,
    redo,
    clearHistory,
    canUndo: historyIndex >= 0,
    canRedo: futureRef.current.length > 0,
    historyLength: historyRef.current.length,

    // Tracked updates
    updateNodes,
    updateEdges,
    updateAnnotations,
    moveNode,
    addNode,
    removeNode,
    addEdge,
    removeEdge,
    batchUpdate,

    // Raw snapshot
    takeSnapshot
  };
}

export default useMapHistory;
