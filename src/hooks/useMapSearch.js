/**
 * useMapSearch - Search Hook for PathwayMapBuilder
 *
 * Provides search functionality for nodes and reactions with
 * highlighting and navigation support.
 */

import { useState, useCallback, useMemo } from 'react';

export function useMapSearch(nodes, edges, model = null) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('all'); // 'all', 'metabolites', 'reactions', 'genes'
  const [highlightedIds, setHighlightedIds] = useState(new Set());
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  // Build searchable index
  const searchIndex = useMemo(() => {
    const index = {
      metabolites: [],
      reactions: [],
      genes: []
    };

    // Index nodes (metabolites)
    nodes.forEach(node => {
      index.metabolites.push({
        id: node.id,
        label: node.label || node.id,
        type: node.type,
        searchText: `${node.id} ${node.label || ''}`.toLowerCase()
      });
    });

    // Index edges (reactions)
    edges.forEach(edge => {
      const rxn = model?.reactions?.[edge.reaction];
      index.reactions.push({
        id: edge.reaction,
        label: edge.label || edge.reaction,
        equation: rxn?.equation || '',
        subsystem: rxn?.subsystem || '',
        genes: rxn?.genes || [],
        searchText: `${edge.reaction} ${edge.label || ''} ${rxn?.equation || ''} ${rxn?.subsystem || ''}`.toLowerCase()
      });

      // Index genes
      if (rxn?.genes) {
        rxn.genes.forEach(gene => {
          if (!index.genes.find(g => g.id === gene)) {
            const geneInfo = model?.genes?.[gene];
            index.genes.push({
              id: gene,
              label: geneInfo?.name || gene,
              product: geneInfo?.product || '',
              reactions: [edge.reaction],
              searchText: `${gene} ${geneInfo?.name || ''} ${geneInfo?.product || ''}`.toLowerCase()
            });
          } else {
            const existing = index.genes.find(g => g.id === gene);
            if (!existing.reactions.includes(edge.reaction)) {
              existing.reactions.push(edge.reaction);
            }
          }
        });
      }
    });

    return index;
  }, [nodes, edges, model]);

  // Search results
  const results = useMemo(() => {
    if (!query || query.length < 2) return [];

    const q = query.toLowerCase();
    const matches = [];

    if (searchType === 'all' || searchType === 'metabolites') {
      searchIndex.metabolites.forEach(item => {
        if (item.searchText.includes(q)) {
          matches.push({ ...item, category: 'metabolite' });
        }
      });
    }

    if (searchType === 'all' || searchType === 'reactions') {
      searchIndex.reactions.forEach(item => {
        if (item.searchText.includes(q)) {
          matches.push({ ...item, category: 'reaction' });
        }
      });
    }

    if (searchType === 'all' || searchType === 'genes') {
      searchIndex.genes.forEach(item => {
        if (item.searchText.includes(q)) {
          matches.push({ ...item, category: 'gene' });
        }
      });
    }

    return matches.slice(0, 50); // Limit results
  }, [query, searchType, searchIndex]);

  // Highlight search results
  const highlightResults = useCallback(() => {
    const ids = new Set();
    results.forEach(result => {
      if (result.category === 'metabolite') {
        ids.add(result.id);
      } else if (result.category === 'reaction') {
        ids.add(result.id);
      } else if (result.category === 'gene') {
        // Highlight reactions that use this gene
        result.reactions?.forEach(rxn => ids.add(rxn));
      }
    });
    setHighlightedIds(ids);
  }, [results]);

  // Navigate to next/previous result
  const nextResult = useCallback(() => {
    if (results.length === 0) return null;
    const newIndex = (currentResultIndex + 1) % results.length;
    setCurrentResultIndex(newIndex);
    return results[newIndex];
  }, [results, currentResultIndex]);

  const prevResult = useCallback(() => {
    if (results.length === 0) return null;
    const newIndex = (currentResultIndex - 1 + results.length) % results.length;
    setCurrentResultIndex(newIndex);
    return results[newIndex];
  }, [results, currentResultIndex]);

  // Get current result for centering
  const currentResult = useMemo(() => {
    return results[currentResultIndex] || null;
  }, [results, currentResultIndex]);

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('');
    setHighlightedIds(new Set());
    setCurrentResultIndex(0);
  }, []);

  // Check if element is highlighted
  const isHighlighted = useCallback((id) => {
    return highlightedIds.has(id);
  }, [highlightedIds]);

  return {
    query,
    setQuery,
    searchType,
    setSearchType,
    results,
    currentResult,
    currentResultIndex,
    highlightedIds,
    highlightResults,
    nextResult,
    prevResult,
    clearSearch,
    isHighlighted,
    resultCount: results.length
  };
}

export default useMapSearch;
