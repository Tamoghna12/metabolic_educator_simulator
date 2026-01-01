/**
 * StateSharing - Session State Export/Import UI
 *
 * Enables reproducibility by allowing users to:
 * - Export complete session state to .suite files
 * - Generate shareable URLs (for small states)
 * - Import previously saved sessions
 * - Generate reproducibility citations
 *
 * Critical for publication: answers "How can another scientist
 * see exactly what the author saw?"
 *
 * @module StateSharing
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Share2,
  Download,
  Upload,
  Link,
  Copy,
  Check,
  AlertCircle,
  FileJson,
  Clock,
  FileText,
  X,
} from 'lucide-react';
import { stateManager } from '../lib/StateManager';
import { toEscherFormat } from '../lib/EscherParser';

export default function StateSharing({
  model,
  constraints = {},
  knockouts = [],
  simulation = null,
  mapLayout = null,
  omicsData = null,
  settings = {},
  onStateLoaded,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState('export'); // 'export', 'import', 'share'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [shareUrl, setShareUrl] = useState(null);
  const [citation, setCitation] = useState(null);
  const [metadata, setMetadata] = useState({
    title: model?.name || 'Session',
    description: '',
    author: '',
  });

  const fileInputRef = useRef(null);

  /**
   * Export current session to .suite file
   */
  const handleExportSuite = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const state = stateManager.captureState({
        model,
        constraints,
        knockouts,
        simulation,
        mapLayout,
        omicsData,
        settings,
        metadata,
      });

      const filename = `${metadata.title.replace(/[^a-z0-9]/gi, '_')}_${
        new Date().toISOString().slice(0, 10)
      }.suite`;

      stateManager.exportToFile(state, filename);
      setSuccess('Session exported successfully');

      // Generate citation
      setCitation(stateManager.generateCitation(state));
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [model, constraints, knockouts, simulation, mapLayout, omicsData, settings, metadata]);

  /**
   * Export map to Escher format
   */
  const handleExportEscher = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      if (!mapLayout) {
        throw new Error('No map layout to export');
      }

      const escherData = toEscherFormat({
        id: model?.id || 'exported_map',
        name: metadata.title,
        description: metadata.description,
        nodes: mapLayout.nodes,
        edges: mapLayout.edges,
        canvas: mapLayout.viewport,
      });

      const json = JSON.stringify(escherData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${metadata.title.replace(/[^a-z0-9]/gi, '_')}.escher.json`;
      a.click();

      URL.revokeObjectURL(url);
      setSuccess('Escher map exported successfully');
    } catch (err) {
      setError(`Escher export failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [mapLayout, model, metadata]);

  /**
   * Generate shareable URL
   */
  const handleGenerateUrl = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const state = stateManager.captureState({
        model,
        constraints,
        knockouts,
        simulation,
        mapLayout,
        omicsData,
        settings,
        metadata,
      });

      const url = stateManager.generateShareableUrl(state);

      if (url) {
        setShareUrl(url);
        setSuccess('Shareable URL generated');
      } else {
        setError('State too large for URL. Use file export instead.');
      }
    } catch (err) {
      setError(`URL generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [model, constraints, knockouts, simulation, mapLayout, omicsData, settings, metadata]);

  /**
   * Copy URL to clipboard
   */
  const handleCopyUrl = useCallback(async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setSuccess('URL copied to clipboard');
    } catch (err) {
      setError('Failed to copy URL');
    }
  }, [shareUrl]);

  /**
   * Copy citation to clipboard
   */
  const handleCopyCitation = useCallback(async () => {
    if (!citation) return;

    try {
      await navigator.clipboard.writeText(citation);
      setSuccess('Citation copied to clipboard');
    } catch (err) {
      setError('Failed to copy citation');
    }
  }, [citation]);

  /**
   * Import .suite file
   */
  const handleImportFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const state = await stateManager.importFromFile(file);
      const validation = stateManager.validateState(state);

      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      if (validation.warnings.length > 0) {
        console.warn('State warnings:', validation.warnings);
      }

      const restored = stateManager.restoreState(state);
      onStateLoaded?.(restored);

      setSuccess(`Imported session: ${state.metadata?.title || 'Untitled'}`);
      setCitation(stateManager.generateCitation(state));
    } catch (err) {
      setError(`Import failed: ${err.message}`);
    } finally {
      setLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onStateLoaded]);

  /**
   * Check URL for state on mount
   */
  React.useEffect(() => {
    const urlState = stateManager.parseUrlState(window.location.hash);
    if (urlState) {
      try {
        const restored = stateManager.restoreState(urlState);
        onStateLoaded?.(restored);
        setSuccess('Loaded state from URL');
        // Clear hash
        window.history.replaceState(null, '', window.location.pathname);
      } catch (err) {
        console.error('Failed to load URL state:', err);
      }
    }
  }, [onStateLoaded]);

  // Clear messages after delay
  React.useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[var(--primary)]" />
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Share & Export Session
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Save or share your complete session state
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-color)]">
          {[
            { id: 'export', label: 'Export', icon: Download },
            { id: 'import', label: 'Import', icon: Upload },
            { id: 'share', label: 'Share URL', icon: Link },
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
          {/* Messages */}
          {error && (
            <div className="mb-4 p-3 bg-[var(--danger-bg)] border border-[var(--danger)] rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-[var(--danger-text)] flex-shrink-0" />
              <p className="text-sm text-[var(--danger-text)]">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-[var(--success-bg)] border border-[var(--success)] rounded-lg flex items-start gap-2">
              <Check className="w-5 h-5 text-[var(--success-text)] flex-shrink-0" />
              <p className="text-sm text-[var(--success-text)]">{success}</p>
            </div>
          )}

          {/* Export Tab */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              {/* Metadata */}
              <div className="space-y-4">
                <h3 className="font-medium text-[var(--text-primary)]">Session Metadata</h3>

                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={metadata.title}
                    onChange={(e) => setMetadata(m => ({ ...m, title: e.target.value }))}
                    className="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)]"
                    placeholder="My FBA Session"
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">
                    Description
                  </label>
                  <textarea
                    value={metadata.description}
                    onChange={(e) => setMetadata(m => ({ ...m, description: e.target.value }))}
                    className="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] resize-none"
                    rows={2}
                    placeholder="Describe the simulation setup..."
                  />
                </div>

                <div>
                  <label className="block text-sm text-[var(--text-secondary)] mb-1">
                    Author
                  </label>
                  <input
                    type="text"
                    value={metadata.author}
                    onChange={(e) => setMetadata(m => ({ ...m, author: e.target.value }))}
                    className="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)]"
                    placeholder="Your name"
                  />
                </div>
              </div>

              {/* Export Options */}
              <div className="space-y-3">
                <h3 className="font-medium text-[var(--text-primary)]">Export Format</h3>

                <button
                  onClick={handleExportSuite}
                  disabled={loading}
                  className="w-full p-4 text-left bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--primary)] transition-colors flex items-center gap-3"
                >
                  <FileJson className="w-6 h-6 text-[var(--primary)]" />
                  <div className="flex-1">
                    <p className="font-medium text-[var(--text-primary)]">
                      MetabolicSuite Session (.suite)
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Complete state: model, constraints, knockouts, results, layout
                    </p>
                  </div>
                  <Download className="w-5 h-5 text-[var(--text-secondary)]" />
                </button>

                <button
                  onClick={handleExportEscher}
                  disabled={loading || !mapLayout}
                  className="w-full p-4 text-left bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--primary)] transition-colors flex items-center gap-3 disabled:opacity-50"
                >
                  <FileText className="w-6 h-6 text-[var(--info)]" />
                  <div className="flex-1">
                    <p className="font-medium text-[var(--text-primary)]">
                      Escher Map (.json)
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Compatible with Escher viewer and other tools
                    </p>
                  </div>
                  <Download className="w-5 h-5 text-[var(--text-secondary)]" />
                </button>
              </div>

              {/* Citation */}
              {citation && (
                <div className="space-y-2">
                  <h3 className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                    Reproducibility Citation
                  </h3>
                  <div className="p-3 bg-[var(--bg-secondary)] rounded-lg text-sm text-[var(--text-secondary)] font-mono">
                    {citation}
                  </div>
                  <button
                    onClick={handleCopyCitation}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Citation
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="space-y-6">
              <div
                className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-8 text-center hover:border-[var(--primary)] transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".suite,.json"
                  onChange={handleImportFile}
                  className="hidden"
                />

                <Upload className="w-12 h-12 mx-auto text-[var(--text-secondary)] mb-4" />
                <p className="text-[var(--text-primary)] font-medium mb-2">
                  Drop a .suite file here or click to browse
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  Restore a previously saved session
                </p>
              </div>

              <div className="text-sm text-[var(--text-muted)] space-y-1">
                <p><strong>What gets restored:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Model (reactions, metabolites, genes)</li>
                  <li>Constraints (modified bounds)</li>
                  <li>Knockouts (deleted reactions)</li>
                  <li>Simulation results (fluxes, objective)</li>
                  <li>Map layout (positions, visibility)</li>
                  <li>Omics data (expression values)</li>
                </ul>
              </div>
            </div>
          )}

          {/* Share Tab */}
          {activeTab === 'share' && (
            <div className="space-y-6">
              <div className="p-4 bg-[var(--info-bg)] border border-[var(--info)] rounded-lg">
                <p className="text-sm text-[var(--info-text)]">
                  <strong>Note:</strong> URL sharing works best for small changes (constraints, knockouts).
                  For full sessions with large models, use file export instead.
                </p>
              </div>

              <button
                onClick={handleGenerateUrl}
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Link className="w-5 h-5" />
                Generate Shareable URL
              </button>

              {shareUrl && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--text-primary)]">
                    Shareable URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] text-sm font-mono"
                    />
                    <button
                      onClick={handleCopyUrl}
                      className="btn-secondary flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Anyone with this URL can load your exact session state
                  </p>
                </div>
              )}

              <div className="text-sm text-[var(--text-muted)] space-y-1">
                <p><strong>URL includes:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Constraints (modified bounds)</li>
                  <li>Knockouts (deleted reactions)</li>
                  <li>Simulation method and objective</li>
                  <li>Omics thresholds</li>
                </ul>
                <p className="mt-2">
                  <strong>Not included:</strong> Full model, flux values, map layout
                  (use file export for complete state)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Clock className="w-4 h-4" />
              <span>
                {model ? `${Object.keys(model.reactions || {}).length} reactions` : 'No model loaded'}
              </span>
              {knockouts.length > 0 && (
                <span className="text-[var(--warning)]">
                  {knockouts.length} knockouts
                </span>
              )}
              {Object.keys(constraints).length > 0 && (
                <span className="text-[var(--info)]">
                  {Object.keys(constraints).length} constraints
                </span>
              )}
            </div>

            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
