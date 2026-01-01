/**
 * EscherImport - Escher Map Import Component
 *
 * Allows users to import Escher pathway maps from:
 * - File upload (drag & drop)
 * - BiGG Models gallery
 * - URL import
 *
 * @module EscherImport
 */

import React, { useState, useCallback, useRef } from 'react';
import { Upload, Download, Globe, FileJson, Check, AlertCircle, ExternalLink } from 'lucide-react';
import {
  parseEscherMap,
  validateEscherMap,
  fetchBiGGMap,
  BIGG_MAPS,
} from '../lib/EscherParser';

export default function EscherImport({ onMapImport, onClose }) {
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'gallery', 'url'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [urlInput, setUrlInput] = useState('');

  const fileInputRef = useRef(null);

  /**
   * Handle file upload
   */
  const handleFile = useCallback(async (file) => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setValidationResult(null);

    try {
      const text = await file.text();
      const escherData = JSON.parse(text);

      // Validate the map
      const validation = validateEscherMap(escherData);
      setValidationResult(validation);

      if (!validation.valid) {
        setError(`Invalid Escher map: ${validation.errors.join(', ')}`);
        setLoading(false);
        return;
      }

      // Parse and import
      const mapData = parseEscherMap(escherData);
      onMapImport?.(mapData);
      onClose?.();
    } catch (err) {
      setError(`Failed to parse file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [onMapImport, onClose]);

  /**
   * Handle drag events
   */
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  /**
   * Handle drop
   */
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer?.files?.[0];
    if (file && file.name.endsWith('.json')) {
      handleFile(file);
    } else {
      setError('Please drop an Escher JSON file');
    }
  }, [handleFile]);

  /**
   * Handle file input change
   */
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  /**
   * Import from BiGG gallery
   */
  const importFromBiGG = useCallback(async (mapId) => {
    setLoading(true);
    setError(null);
    setValidationResult(null);

    try {
      const escherData = await fetchBiGGMap(mapId);
      const validation = validateEscherMap(escherData);
      setValidationResult(validation);

      if (!validation.valid) {
        setError(`Invalid map from BiGG: ${validation.errors.join(', ')}`);
        setLoading(false);
        return;
      }

      const mapData = parseEscherMap(escherData);
      onMapImport?.(mapData);
      onClose?.();
    } catch (err) {
      setError(`Failed to fetch BiGG map: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [onMapImport, onClose]);

  /**
   * Import from URL
   */
  const importFromUrl = useCallback(async () => {
    if (!urlInput.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);
    setValidationResult(null);

    try {
      const response = await fetch(urlInput);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const escherData = await response.json();
      const validation = validateEscherMap(escherData);
      setValidationResult(validation);

      if (!validation.valid) {
        setError(`Invalid map: ${validation.errors.join(', ')}`);
        setLoading(false);
        return;
      }

      const mapData = parseEscherMap(escherData);
      onMapImport?.(mapData);
      onClose?.();
    } catch (err) {
      setError(`Failed to fetch URL: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [urlInput, onMapImport, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Import Escher Map</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Import pathway maps from the Escher ecosystem
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors"
          >
            <span className="text-xl">&times;</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-color)]">
          {[
            { id: 'upload', label: 'Upload File', icon: Upload },
            { id: 'gallery', label: 'BiGG Gallery', icon: Globe },
            { id: 'url', label: 'From URL', icon: ExternalLink },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-[var(--primary)] border-b-2 border-[var(--primary)] bg-[var(--bg-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {/* Error display */}
          {error && (
            <div className="mb-4 p-3 bg-[var(--danger-bg)] border border-[var(--danger)] rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-[var(--danger-text)] flex-shrink-0" />
              <p className="text-sm text-[var(--danger-text)]">{error}</p>
            </div>
          )}

          {/* Validation result */}
          {validationResult && !error && (
            <div className="mb-4 p-3 bg-[var(--success-bg)] border border-[var(--success)] rounded-lg flex items-start gap-2">
              <Check className="w-5 h-5 text-[var(--success-text)] flex-shrink-0" />
              <div className="text-sm text-[var(--success-text)]">
                <p className="font-medium">Map validated successfully</p>
                <p>{validationResult.stats.nodes} nodes, {validationResult.stats.reactions} reactions</p>
              </div>
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                  : 'border-[var(--border-color)] hover:border-[var(--primary)]'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />

              <FileJson className="w-12 h-12 mx-auto text-[var(--text-secondary)] mb-4" />
              <p className="text-[var(--text-primary)] font-medium mb-2">
                {dragActive ? 'Drop the file here' : 'Drag & drop an Escher JSON file'}
              </p>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                or click to browse
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Importing...' : 'Select File'}
              </button>
            </div>
          )}

          {/* BiGG Gallery Tab */}
          {activeTab === 'gallery' && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Select a pre-built pathway map from the BiGG Models collection
              </p>
              {BIGG_MAPS.map(map => (
                <button
                  key={map.id}
                  onClick={() => importFromBiGG(map.id)}
                  disabled={loading}
                  className="w-full p-4 text-left bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--primary)] transition-colors flex items-center justify-between group"
                >
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{map.name}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{map.organism}</p>
                  </div>
                  <Download className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--primary)] transition-colors" />
                </button>
              ))}
              <p className="text-xs text-[var(--text-muted)] mt-4">
                Maps from <a href="https://escher.github.io" target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline">escher.github.io</a>
              </p>
            </div>
          )}

          {/* URL Tab */}
          {activeTab === 'url' && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                Enter the URL of an Escher JSON map file
              </p>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/pathway.json"
                className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none"
              />
              <button
                onClick={importFromUrl}
                disabled={loading || !urlInput.trim()}
                className="btn-primary w-full"
              >
                {loading ? 'Importing...' : 'Import from URL'}
              </button>
              <p className="text-xs text-[var(--text-muted)]">
                The URL must point to a valid Escher JSON map and be accessible via CORS.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <p className="text-xs text-[var(--text-muted)] text-center">
            Escher maps by King et al. (2015) PLoS Comp Biol. Compatible with maps from BiGG Models and Escher Builder.
          </p>
        </div>
      </div>
    </div>
  );
}
