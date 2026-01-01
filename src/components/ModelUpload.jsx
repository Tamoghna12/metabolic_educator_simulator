import React, { useRef, useState } from 'react';
import { useModel } from '../contexts/ModelContext';
import { isValidModelFile } from '../utils/modelParser';

export const ModelUpload = () => {
  const {
    currentModel,
    loading,
    error,
    availableModels,
    loadModel,
    selectModel,
    resetToDefault,
    removeModel,
    modelStats,
    isDefaultModel
  } = useModel();

  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await loadModel(file);
      } catch (err) {
        // Error is handled in context
      }
    }
    // Reset input to allow re-uploading same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && isValidModelFile(file)) {
      try {
        await loadModel(file);
      } catch (err) {
        // Error is handled in context
      }
    }
  };

  // Get format badge for display
  const getFormatBadge = (model) => {
    const format = model.format || (model.level ? 'SBML' : 'JSON');
    const colors = format === 'SBML'
      ? 'bg-[var(--success-bg)] text-[var(--success-text)] border-[var(--success)]'
      : 'bg-[var(--info-bg)] text-[var(--info-text)] border-[var(--info)]';
    return (
      <span className={`ml-2 px-1.5 py-0.5 text-xs font-mono rounded border ${colors}`}>
        {format}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="section-header">
        <h3 className="section-title">Model Management</h3>
      </div>

      {/* Current Model Info */}
      <div className="p-4 bg-[var(--info-bg)] border border-[var(--info)] rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-[var(--info-text)]">Current Model</p>
          {!isDefaultModel && (
            <button
              onClick={resetToDefault}
              className="text-xs text-[var(--info-text)] hover:underline"
            >
              Reset to Default
            </button>
          )}
        </div>
        <p className="text-lg font-bold text-[var(--text-primary)]">{currentModel.name}</p>
        <p className="text-xs text-[var(--text-secondary)] mb-3">{currentModel.description}</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-[var(--card-bg)] rounded border border-[var(--card-border)]">
            <p className="text-lg font-bold text-[var(--primary)] font-mono">{modelStats.genes}</p>
            <p className="text-xs text-[var(--text-secondary)]">Genes</p>
          </div>
          <div className="p-2 bg-[var(--card-bg)] rounded border border-[var(--card-border)]">
            <p className="text-lg font-bold text-[var(--primary)] font-mono">{modelStats.reactions}</p>
            <p className="text-xs text-[var(--text-secondary)]">Reactions</p>
          </div>
          <div className="p-2 bg-[var(--card-bg)] rounded border border-[var(--card-border)]">
            <p className="text-lg font-bold text-[var(--primary)] font-mono">{modelStats.nodes}</p>
            <p className="text-xs text-[var(--text-secondary)]">Nodes</p>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? 'border-[var(--primary)] bg-[var(--info-bg)]'
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
          accept=".json,.xml,.sbml,application/json,application/xml,text/xml"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload metabolic model file (JSON or SBML)"
        />

        <div className="space-y-3">
          <div className="text-4xl">🧬</div>
          <div>
            <p className="text-sm text-[var(--text-primary)] font-medium">
              Drop a model file here
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Supports JSON (CobraPy/BIGG) and SBML (XML Level 2/3)
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Parsing model...' : 'Select File'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-[var(--danger-bg)] border border-[var(--danger)] rounded-lg">
          <p className="text-sm text-[var(--danger-text)]">{error}</p>
        </div>
      )}

      {/* Model Selector */}
      {availableModels.length > 1 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">Available Models</p>
          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
            {availableModels.map(model => (
              <div
                key={model.id}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                  currentModel.id === model.id
                    ? 'bg-[var(--primary)] border-[var(--primary)]'
                    : 'bg-[var(--card-bg)] border-[var(--card-border)] hover:border-[var(--primary)]'
                }`}
                onClick={() => selectModel(model.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate flex items-center ${
                    currentModel.id === model.id ? 'text-white' : 'text-[var(--text-primary)]'
                  }`}>
                    {model.name}
                    {model.isDefault && (
                      <span className={`ml-2 text-xs ${
                        currentModel.id === model.id ? 'text-white/70' : 'text-[var(--text-secondary)]'
                      }`}>
                        (Default)
                      </span>
                    )}
                    {!model.isDefault && getFormatBadge(model)}
                  </p>
                  <p className={`text-xs truncate ${
                    currentModel.id === model.id ? 'text-white/80' : 'text-[var(--text-secondary)]'
                  }`}>
                    {Object.keys(model.reactions || {}).length} reactions
                    {model.level && ` • SBML L${model.level}`}
                  </p>
                </div>
                {!model.isDefault && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeModel(model.id);
                    }}
                    className={`ml-2 p-1 rounded hover:bg-[var(--danger-bg)] transition-colors ${
                      currentModel.id === model.id ? 'text-white/80 hover:text-white' : 'text-[var(--text-secondary)]'
                    }`}
                    aria-label={`Remove ${model.name}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Format Help */}
      <details className="text-xs text-[var(--text-secondary)]">
        <summary className="cursor-pointer hover:text-[var(--text-primary)] font-medium">
          Supported Formats & Features
        </summary>
        <div className="mt-2 p-3 bg-[var(--bg-primary)] rounded border border-[var(--border-color)] space-y-3">
          <div>
            <p className="font-medium text-[var(--text-primary)] mb-1">JSON (CobraPy/BIGG)</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>CobraPy export: <code className="text-xs bg-[var(--bg-secondary)] px-1 rounded">model.to_json()</code></li>
              <li>BIGG Models database downloads</li>
              <li>Reactions, metabolites, genes, GPR rules</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-[var(--text-primary)] mb-1">SBML (XML)</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>SBML Level 2 and Level 3</li>
              <li>FBC package v1/v2 (flux bounds, gene associations)</li>
              <li>Groups package (subsystems)</li>
              <li>Layout package (visual coordinates)</li>
              <li>Compartments, species, stoichiometry</li>
            </ul>
          </div>
          <div className="pt-2 border-t border-[var(--border-color)]">
            <p className="text-[var(--text-muted)]">
              Common sources: BIGG Models, BioCyc, MetaNetX, KEGG, Escher maps
            </p>
          </div>
        </div>
      </details>
    </div>
  );
};

export default ModelUpload;
