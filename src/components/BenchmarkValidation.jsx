/**
 * BenchmarkValidation - Solver Accuracy Validation UI
 *
 * Provides interface for running and viewing benchmark validation
 * between HiGHS WASM and COBRApy solvers.
 *
 * Features:
 * - BiGG model catalog browser
 * - Parallel solver execution
 * - Real-time progress tracking
 * - Statistical summary display
 * - LaTeX report generation
 *
 * @module BenchmarkValidation
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Play,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  FileText,
  BarChart3,
  Clock,
  Database,
} from 'lucide-react';
import { BenchmarkRunner } from '../lib/BenchmarkRunner';

export default function BenchmarkValidation() {
  const [status, setStatus] = useState('idle'); // idle, running, complete, error
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [latex, setLatex] = useState('');
  const [config, setConfig] = useState({
    numModels: 20,
    methods: ['fba', 'pfba'],
    useBackend: false, // Default to offline mode (HiGHS-only validation)
  });

  const runnerRef = useRef(null);

  useEffect(() => {
    runnerRef.current = new BenchmarkRunner();
    runnerRef.current.setProgressCallback(setProgress);
    return () => {
      runnerRef.current = null;
    };
  }, []);

  const runBenchmark = useCallback(async () => {
    if (!runnerRef.current) return;

    setStatus('running');
    setResults(null);
    setSummary(null);
    setLatex('');

    try {
      const result = await runnerRef.current.run({
        numModels: config.numModels,
        methods: config.methods,
        useBackend: config.useBackend,
      });

      setResults(result.results);
      setSummary(result.summary);
      setLatex(result.latex);
      setStatus('complete');
    } catch (error) {
      console.error('Benchmark failed:', error);
      setStatus('error');
    }
  }, [config]);

  const downloadLatex = useCallback(() => {
    if (!latex) return;

    const blob = new Blob([latex], { type: 'text/x-latex' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solver_validation_${new Date().toISOString().slice(0, 10)}.tex`;
    a.click();
    URL.revokeObjectURL(url);
  }, [latex]);

  const downloadJSON = useCallback(() => {
    if (!results) return;

    const data = { results, summary };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmark_results_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, summary]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Solver Validation Suite
        </h1>
        <p className="text-[var(--text-secondary)]">
          Numerical validation of HiGHS WASM against COBRApy gold standard.
          Required for publication: |Δobj| &lt; 10<sup>-6</sup>
        </p>
      </div>

      {/* Configuration */}
      <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Number of models */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Number of Models
            </label>
            <select
              value={config.numModels}
              onChange={(e) => setConfig(prev => ({ ...prev, numModels: parseInt(e.target.value) }))}
              disabled={status === 'running'}
              className="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)]"
            >
              <option value={10}>10 (Quick test)</option>
              <option value={20}>20 (Standard)</option>
              <option value={50}>50 (Thorough)</option>
              <option value={100}>100 (Publication)</option>
            </select>
          </div>

          {/* Methods */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Methods
            </label>
            <div className="space-y-2">
              {['fba', 'pfba'].map(method => (
                <label key={method} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.methods.includes(method)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setConfig(prev => ({ ...prev, methods: [...prev.methods, method] }));
                      } else {
                        setConfig(prev => ({ ...prev, methods: prev.methods.filter(m => m !== method) }));
                      }
                    }}
                    disabled={status === 'running'}
                    className="rounded"
                  />
                  <span className="text-[var(--text-primary)] uppercase">{method}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Backend toggle */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              Reference Solver
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.useBackend}
                onChange={(e) => setConfig(prev => ({ ...prev, useBackend: e.target.checked }))}
                disabled={status === 'running'}
                className="rounded"
              />
              <span className="text-[var(--text-primary)]">Use COBRApy backend</span>
            </label>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {config.useBackend
                ? 'Will compare against COBRApy (requires backend running)'
                : 'Self-validation mode (HiGHS consistency check)'}
            </p>
          </div>
        </div>

        {/* Run button */}
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={runBenchmark}
            disabled={status === 'running' || config.methods.length === 0}
            className="btn-primary flex items-center gap-2"
          >
            {status === 'running' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Benchmark
              </>
            )}
          </button>

          {status === 'complete' && (
            <>
              <button
                onClick={downloadLatex}
                className="btn-secondary flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Download LaTeX
              </button>
              <button
                onClick={downloadJSON}
                className="btn-secondary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download JSON
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress */}
      {status === 'running' && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[var(--text-primary)] font-medium">Progress</span>
            <span className="text-[var(--text-secondary)]">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2 mb-2">
            <div
              className="bg-[var(--primary)] h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / Math.max(progress.total, 1)) * 100}%` }}
            />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{progress.status}</p>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Validation Summary
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {/* Pass Rate */}
            <div className="bg-[var(--bg-primary)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                {summary.passRate >= 0.99 ? (
                  <CheckCircle className="w-5 h-5 text-[var(--success)]" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-[var(--warning)]" />
                )}
                <span className="text-sm text-[var(--text-secondary)]">Pass Rate</span>
              </div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {(summary.passRate * 100).toFixed(1)}%
              </p>
            </div>

            {/* Total Tests */}
            <div className="bg-[var(--bg-primary)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-5 h-5 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">Total Tests</span>
              </div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">
                {summary.totalComparisons}
              </p>
            </div>

            {/* Mean Objective Diff */}
            <div className="bg-[var(--bg-primary)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-[var(--text-secondary)]">Mean |Δobj|</span>
              </div>
              <p className="text-xl font-bold text-[var(--text-primary)] font-mono">
                {summary.objectiveDiff?.mean?.toExponential(2) || '--'}
              </p>
            </div>

            {/* Mean Solve Time */}
            <div className="bg-[var(--bg-primary)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-5 h-5 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-secondary)]">Mean Time</span>
              </div>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {summary.solveTime?.highs?.mean?.toFixed(1) || '--'} ms
              </p>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left py-2 text-[var(--text-secondary)]">Metric</th>
                  <th className="text-right py-2 text-[var(--text-secondary)]">Value</th>
                  <th className="text-right py-2 text-[var(--text-secondary)]">Criterion</th>
                  <th className="text-center py-2 text-[var(--text-secondary)]">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--border-color)]">
                  <td className="py-2 text-[var(--text-primary)]">Max |Δobj|</td>
                  <td className="py-2 text-right font-mono text-[var(--text-primary)]">
                    {summary.objectiveDiff?.max?.toExponential(2) || '--'}
                  </td>
                  <td className="py-2 text-right text-[var(--text-secondary)]">&lt; 10⁻⁶</td>
                  <td className="py-2 text-center">
                    {summary.objectiveDiff?.max < 1e-6 ? (
                      <CheckCircle className="w-4 h-4 text-[var(--success)] inline" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[var(--danger)] inline" />
                    )}
                  </td>
                </tr>
                <tr className="border-b border-[var(--border-color)]">
                  <td className="py-2 text-[var(--text-primary)]">Mean ||Δv||₂</td>
                  <td className="py-2 text-right font-mono text-[var(--text-primary)]">
                    {summary.fluxL2Norm?.mean?.toExponential(2) || '--'}
                  </td>
                  <td className="py-2 text-right text-[var(--text-secondary)]">--</td>
                  <td className="py-2 text-center">--</td>
                </tr>
                <tr className="border-b border-[var(--border-color)]">
                  <td className="py-2 text-[var(--text-primary)]">Failed Tests</td>
                  <td className="py-2 text-right font-mono text-[var(--text-primary)]">
                    {summary.failed}
                  </td>
                  <td className="py-2 text-right text-[var(--text-secondary)]">0</td>
                  <td className="py-2 text-center">
                    {summary.failed === 0 ? (
                      <CheckCircle className="w-4 h-4 text-[var(--success)] inline" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[var(--danger)] inline" />
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Visualization Charts */}
      {results && results.length > 0 && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Validation Plots
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Objective Correlation Scatter Plot */}
            <div className="bg-[var(--bg-primary)] rounded-lg p-4">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                Objective Value Correlation
              </h3>
              <svg viewBox="0 0 300 250" className="w-full h-64">
                {/* Axes */}
                <line x1="40" y1="210" x2="290" y2="210" stroke="var(--text-muted)" strokeWidth="1" />
                <line x1="40" y1="10" x2="40" y2="210" stroke="var(--text-muted)" strokeWidth="1" />

                {/* Diagonal reference line (perfect correlation) */}
                <line x1="40" y1="210" x2="260" y2="30" stroke="var(--primary)" strokeWidth="1" strokeDasharray="4" opacity="0.5" />

                {/* Data points */}
                {(() => {
                  const validResults = results.filter(r => r.objA != null && r.objB != null);
                  if (validResults.length === 0) return null;

                  const maxObj = Math.max(...validResults.map(r => Math.max(Math.abs(r.objA || 0), Math.abs(r.objB || 0))), 1);
                  const scale = 180 / maxObj;

                  return validResults.slice(0, 100).map((r, i) => {
                    const x = 40 + (Math.abs(r.objA || 0) / maxObj) * 220;
                    const y = 210 - (Math.abs(r.objB || 0) / maxObj) * 180;
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="4"
                        fill={r.passed ? 'var(--success)' : 'var(--danger)'}
                        opacity="0.7"
                      >
                        <title>{`${r.modelId}: HiGHS=${r.objA?.toFixed(4)}, COBRApy=${r.objB?.toFixed(4)}`}</title>
                      </circle>
                    );
                  });
                })()}

                {/* Labels */}
                <text x="165" y="240" textAnchor="middle" fill="var(--text-secondary)" fontSize="11">HiGHS Objective</text>
                <text x="15" y="110" textAnchor="middle" fill="var(--text-secondary)" fontSize="11" transform="rotate(-90, 15, 110)">COBRApy Objective</text>
              </svg>
              <p className="text-xs text-[var(--text-muted)] text-center mt-2">
                Points on diagonal = perfect agreement
              </p>
            </div>

            {/* Solve Time Comparison */}
            <div className="bg-[var(--bg-primary)] rounded-lg p-4">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                Solve Time Comparison
              </h3>
              <svg viewBox="0 0 300 250" className="w-full h-64">
                {/* Axes */}
                <line x1="60" y1="200" x2="280" y2="200" stroke="var(--text-muted)" strokeWidth="1" />
                <line x1="60" y1="20" x2="60" y2="200" stroke="var(--text-muted)" strokeWidth="1" />

                {/* Bars */}
                {(() => {
                  const highsAvg = summary?.solveTime?.highs?.mean || 0;
                  const cobrapyAvg = summary?.solveTime?.cobrapy?.mean || 0;
                  const maxTime = Math.max(highsAvg, cobrapyAvg, 1);
                  const scale = 160 / maxTime;

                  return (
                    <>
                      {/* HiGHS bar */}
                      <rect x="90" y={200 - highsAvg * scale} width="60" height={highsAvg * scale}
                        fill="var(--primary)" rx="4" />
                      <text x="120" y="220" textAnchor="middle" fill="var(--text-secondary)" fontSize="10">HiGHS</text>
                      <text x="120" y={190 - highsAvg * scale} textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="600">
                        {highsAvg.toFixed(1)}ms
                      </text>

                      {/* COBRApy bar */}
                      <rect x="180" y={200 - cobrapyAvg * scale} width="60" height={cobrapyAvg * scale}
                        fill="var(--accent)" rx="4" />
                      <text x="210" y="220" textAnchor="middle" fill="var(--text-secondary)" fontSize="10">COBRApy</text>
                      <text x="210" y={190 - cobrapyAvg * scale} textAnchor="middle" fill="var(--text-primary)" fontSize="11" fontWeight="600">
                        {cobrapyAvg.toFixed(1)}ms
                      </text>
                    </>
                  );
                })()}

                {/* Y-axis label */}
                <text x="25" y="110" textAnchor="middle" fill="var(--text-secondary)" fontSize="11" transform="rotate(-90, 25, 110)">Time (ms)</text>
              </svg>
              <p className="text-xs text-[var(--text-muted)] text-center mt-2">
                Average solve time per model
              </p>
            </div>

            {/* Error Distribution Histogram */}
            <div className="bg-[var(--bg-primary)] rounded-lg p-4">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                Objective Difference Distribution
              </h3>
              <svg viewBox="0 0 300 250" className="w-full h-64">
                {/* Axes */}
                <line x1="40" y1="200" x2="280" y2="200" stroke="var(--text-muted)" strokeWidth="1" />
                <line x1="40" y1="20" x2="40" y2="200" stroke="var(--text-muted)" strokeWidth="1" />

                {/* Histogram bars */}
                {(() => {
                  const diffs = results.filter(r => r.objDiff != null).map(r => Math.log10(r.objDiff + 1e-16));
                  if (diffs.length === 0) return null;

                  // Create bins from -16 to 0 (log scale)
                  const numBins = 8;
                  const binWidth = 16 / numBins;
                  const bins = new Array(numBins).fill(0);

                  diffs.forEach(d => {
                    const binIdx = Math.min(Math.floor((d + 16) / binWidth), numBins - 1);
                    if (binIdx >= 0) bins[binIdx]++;
                  });

                  const maxCount = Math.max(...bins, 1);
                  const barWidth = 220 / numBins;

                  return bins.map((count, i) => {
                    const height = (count / maxCount) * 160;
                    const x = 50 + i * barWidth;
                    const color = i < 5 ? 'var(--success)' : i < 7 ? 'var(--warning)' : 'var(--danger)';
                    return (
                      <g key={i}>
                        <rect x={x} y={200 - height} width={barWidth - 4} height={height}
                          fill={color} rx="2" opacity="0.8" />
                        {count > 0 && (
                          <text x={x + barWidth / 2 - 2} y={195 - height} textAnchor="middle"
                            fill="var(--text-primary)" fontSize="9">{count}</text>
                        )}
                      </g>
                    );
                  });
                })()}

                {/* X-axis labels */}
                <text x="60" y="215" textAnchor="middle" fill="var(--text-muted)" fontSize="8">10⁻¹⁶</text>
                <text x="165" y="215" textAnchor="middle" fill="var(--text-muted)" fontSize="8">10⁻⁸</text>
                <text x="265" y="215" textAnchor="middle" fill="var(--text-muted)" fontSize="8">10⁰</text>

                {/* Tolerance line */}
                <line x1="222" y1="30" x2="222" y2="200" stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="4" />
                <text x="227" y="45" fill="var(--danger)" fontSize="9">Tolerance</text>

                {/* Labels */}
                <text x="165" y="235" textAnchor="middle" fill="var(--text-secondary)" fontSize="10">|Δobj| (log scale)</text>
              </svg>
              <p className="text-xs text-[var(--text-muted)] text-center mt-2">
                Green = excellent, Yellow = good, Red = above tolerance
              </p>
            </div>

            {/* Model Size vs Solve Time */}
            <div className="bg-[var(--bg-primary)] rounded-lg p-4">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                Pass/Fail Summary
              </h3>
              <svg viewBox="0 0 300 250" className="w-full h-64">
                {(() => {
                  const passed = results.filter(r => r.passed).length;
                  const failed = results.length - passed;
                  const total = results.length;

                  // Pie chart
                  const passAngle = (passed / total) * 360;
                  const passRadians = (passAngle * Math.PI) / 180;

                  const centerX = 150;
                  const centerY = 100;
                  const radius = 70;

                  // SVG arc path
                  const passX = centerX + radius * Math.sin(passRadians);
                  const passY = centerY - radius * Math.cos(passRadians);
                  const largeArc = passAngle > 180 ? 1 : 0;

                  return (
                    <>
                      {/* Pass slice */}
                      {passed === total ? (
                        <circle cx={centerX} cy={centerY} r={radius} fill="var(--success)" />
                      ) : failed === total ? (
                        <circle cx={centerX} cy={centerY} r={radius} fill="var(--danger)" />
                      ) : (
                        <>
                          <path
                            d={`M ${centerX} ${centerY} L ${centerX} ${centerY - radius} A ${radius} ${radius} 0 ${largeArc} 1 ${passX} ${passY} Z`}
                            fill="var(--success)"
                          />
                          <path
                            d={`M ${centerX} ${centerY} L ${passX} ${passY} A ${radius} ${radius} 0 ${1 - largeArc} 1 ${centerX} ${centerY - radius} Z`}
                            fill="var(--danger)"
                          />
                        </>
                      )}

                      {/* Center circle (donut) */}
                      <circle cx={centerX} cy={centerY} r="40" fill="var(--bg-primary)" />

                      {/* Center text */}
                      <text x={centerX} y={centerY - 5} textAnchor="middle" fill="var(--text-primary)" fontSize="20" fontWeight="bold">
                        {((passed / total) * 100).toFixed(0)}%
                      </text>
                      <text x={centerX} y={centerY + 12} textAnchor="middle" fill="var(--text-secondary)" fontSize="10">
                        Pass Rate
                      </text>

                      {/* Legend */}
                      <rect x="80" y="195" width="12" height="12" fill="var(--success)" rx="2" />
                      <text x="97" y="205" fill="var(--text-primary)" fontSize="11">Passed: {passed}</text>

                      <rect x="170" y="195" width="12" height="12" fill="var(--danger)" rx="2" />
                      <text x="187" y="205" fill="var(--text-primary)" fontSize="11">Failed: {failed}</text>
                    </>
                  );
                })()}
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Results Table */}
      {results && results.length > 0 && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] p-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Detailed Results ({results.length} tests)
          </h2>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--card-bg)]">
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left py-2 px-2 text-[var(--text-secondary)]">Model</th>
                  <th className="text-left py-2 px-2 text-[var(--text-secondary)]">Method</th>
                  <th className="text-right py-2 px-2 text-[var(--text-secondary)]">|Δobj|</th>
                  <th className="text-right py-2 px-2 text-[var(--text-secondary)]">||Δv||₂</th>
                  <th className="text-right py-2 px-2 text-[var(--text-secondary)]">t (ms)</th>
                  <th className="text-center py-2 px-2 text-[var(--text-secondary)]">Pass</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-primary)]">
                    <td className="py-2 px-2 font-mono text-[var(--text-primary)]">{r.modelId}</td>
                    <td className="py-2 px-2 uppercase text-[var(--text-secondary)]">{r.method}</td>
                    <td className="py-2 px-2 text-right font-mono text-[var(--text-primary)]">
                      {r.objDiff?.toExponential(2) || '--'}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-[var(--text-primary)]">
                      {r.fluxL2Norm?.toExponential(2) || '--'}
                    </td>
                    <td className="py-2 px-2 text-right text-[var(--text-secondary)]">
                      {r.timeAMs?.toFixed(1) || '--'}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {r.passed ? (
                        <CheckCircle className="w-4 h-4 text-[var(--success)] inline" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[var(--danger)] inline" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LaTeX Preview */}
      {latex && (
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] p-6 mt-6">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            LaTeX Report Preview
          </h2>
          <pre className="bg-[var(--bg-secondary)] p-4 rounded-lg overflow-x-auto text-xs font-mono text-[var(--text-secondary)] max-h-64">
            {latex}
          </pre>
        </div>
      )}
    </div>
  );
}
