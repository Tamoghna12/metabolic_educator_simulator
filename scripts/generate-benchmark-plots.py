#!/usr/bin/env python3
"""
Generate Publication-Quality Benchmark Validation Plots

Creates matplotlib figures for the HiGHS vs COBRApy validation data.
Outputs PDF and PNG files suitable for publication.

Usage:
    python scripts/generate-benchmark-plots.py [validation_results.json]
"""

import json
import sys
from pathlib import Path
import numpy as np

try:
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend
    import matplotlib.pyplot as plt
    from matplotlib import rcParams
except ImportError:
    print("matplotlib required: pip install matplotlib")
    sys.exit(1)

# Publication-quality settings
rcParams['font.family'] = 'serif'
rcParams['font.size'] = 10
rcParams['axes.labelsize'] = 11
rcParams['axes.titlesize'] = 12
rcParams['legend.fontsize'] = 9
rcParams['figure.dpi'] = 150
rcParams['savefig.dpi'] = 300
rcParams['savefig.bbox'] = 'tight'


def load_results(filepath):
    """Load validation results JSON"""
    with open(filepath) as f:
        data = json.load(f)

    if 'comparisons' in data:
        return data['comparisons'], data.get('summary', {})
    else:
        return data, {}


def plot_objective_correlation(results, output_dir):
    """Scatter plot: HiGHS vs COBRApy objective values"""
    fig, ax = plt.subplots(figsize=(5, 5))

    highs_objs = []
    cobra_objs = []
    passed = []

    for r in results:
        if r.get('highs_obj') is not None and r.get('cobra_obj') is not None:
            highs_objs.append(abs(r['highs_obj']))
            cobra_objs.append(abs(r['cobra_obj']))
            passed.append(r.get('passed', False))

    if not highs_objs:
        print("No objective data to plot")
        return

    highs_objs = np.array(highs_objs)
    cobra_objs = np.array(cobra_objs)
    passed = np.array(passed)

    # Plot diagonal reference
    max_val = max(max(highs_objs), max(cobra_objs))
    ax.plot([0, max_val], [0, max_val], 'k--', alpha=0.5, label='Perfect agreement')

    # Plot points
    ax.scatter(highs_objs[passed], cobra_objs[passed],
               c='#22c55e', alpha=0.7, s=40, label='Passed', edgecolors='white', linewidth=0.5)
    ax.scatter(highs_objs[~passed], cobra_objs[~passed],
               c='#ef4444', alpha=0.7, s=40, label='Failed', edgecolors='white', linewidth=0.5)

    ax.set_xlabel('HiGHS WASM Objective Value')
    ax.set_ylabel('COBRApy (GLPK) Objective Value')
    ax.set_title('Solver Objective Correlation')
    ax.legend(loc='lower right')

    # Equal aspect ratio
    ax.set_aspect('equal', adjustable='box')

    plt.tight_layout()
    fig.savefig(output_dir / 'objective_correlation.pdf')
    fig.savefig(output_dir / 'objective_correlation.png')
    plt.close(fig)
    print(f"Saved objective correlation plot")


def plot_error_distribution(results, output_dir):
    """Histogram: Distribution of objective differences (log scale)"""
    fig, ax = plt.subplots(figsize=(6, 4))

    obj_diffs = [r['obj_diff'] for r in results if r.get('obj_diff') is not None]

    if not obj_diffs:
        print("No objective diff data to plot")
        return

    # Log-transform (add small epsilon to avoid log(0))
    log_diffs = np.log10(np.array(obj_diffs) + 1e-16)

    # Create histogram
    bins = np.linspace(-16, 0, 17)
    counts, edges, patches = ax.hist(log_diffs, bins=bins, color='#3b82f6',
                                      edgecolor='white', alpha=0.8)

    # Color by tolerance
    for i, (count, patch) in enumerate(zip(counts, patches)):
        bin_center = (edges[i] + edges[i + 1]) / 2
        if bin_center < -6:
            patch.set_facecolor('#22c55e')  # Green - excellent
        elif bin_center < -3:
            patch.set_facecolor('#eab308')  # Yellow - good
        else:
            patch.set_facecolor('#ef4444')  # Red - above tolerance

    # Add tolerance line
    ax.axvline(x=-6, color='#dc2626', linestyle='--', linewidth=2,
               label='Tolerance ($10^{-6}$)')

    ax.set_xlabel(r'$\log_{10}(|\Delta obj|)$')
    ax.set_ylabel('Number of Models')
    ax.set_title('Distribution of Objective Value Differences')
    ax.legend()

    plt.tight_layout()
    fig.savefig(output_dir / 'error_distribution.pdf')
    fig.savefig(output_dir / 'error_distribution.png')
    plt.close(fig)
    print(f"Saved error distribution plot")


def plot_solve_time_comparison(results, summary, output_dir):
    """Bar chart: Solve time comparison"""
    fig, ax = plt.subplots(figsize=(5, 4))

    if summary and 'highsTime' in summary:
        highs_mean = summary['highsTime'].get('mean', 0)
        cobra_mean = summary['cobraTime'].get('mean', 0)
    else:
        # Calculate from results
        highs_times = [r['highs_time_ms'] for r in results if r.get('highs_time_ms')]
        cobra_times = [r['cobra_time_ms'] for r in results if r.get('cobra_time_ms')]
        highs_mean = np.mean(highs_times) if highs_times else 0
        cobra_mean = np.mean(cobra_times) if cobra_times else 0

    solvers = ['HiGHS\nWASM', 'COBRApy\n(GLPK)']
    times = [highs_mean, cobra_mean]
    colors = ['#3b82f6', '#8b5cf6']

    bars = ax.bar(solvers, times, color=colors, edgecolor='white', width=0.5)

    # Add value labels
    for bar, time in zip(bars, times):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1,
                f'{time:.1f} ms', ha='center', va='bottom', fontsize=10)

    ax.set_ylabel('Mean Solve Time (ms)')
    ax.set_title('Solver Performance Comparison')

    # Add speedup annotation
    if cobra_mean > 0:
        speedup = cobra_mean / highs_mean if highs_mean > 0 else 0
        ax.annotate(f'{speedup:.1f}x faster',
                    xy=(0, highs_mean), xytext=(0.5, (highs_mean + cobra_mean) / 2),
                    fontsize=10, ha='center',
                    arrowprops=dict(arrowstyle='->', color='gray'))

    plt.tight_layout()
    fig.savefig(output_dir / 'solve_time_comparison.pdf')
    fig.savefig(output_dir / 'solve_time_comparison.png')
    plt.close(fig)
    print(f"Saved solve time comparison plot")


def plot_pass_rate_pie(results, output_dir):
    """Pie chart: Pass/fail summary"""
    fig, ax = plt.subplots(figsize=(5, 5))

    passed = sum(1 for r in results if r.get('passed', False))
    failed = len(results) - passed

    sizes = [passed, failed]
    labels = [f'Passed\n({passed})', f'Failed\n({failed})']
    colors = ['#22c55e', '#ef4444']
    explode = (0.02, 0.02)

    wedges, texts, autotexts = ax.pie(sizes, labels=labels, colors=colors,
                                       explode=explode, autopct='%1.1f%%',
                                       startangle=90, textprops={'fontsize': 10})

    # Make percentage text bold
    for autotext in autotexts:
        autotext.set_fontweight('bold')
        autotext.set_color('white')

    ax.set_title('Validation Pass Rate')

    plt.tight_layout()
    fig.savefig(output_dir / 'pass_rate.pdf')
    fig.savefig(output_dir / 'pass_rate.png')
    plt.close(fig)
    print(f"Saved pass rate plot")


def plot_combined_figure(results, summary, output_dir):
    """Create a combined 2x2 figure for publication"""
    fig, axes = plt.subplots(2, 2, figsize=(10, 9))

    # 1. Objective correlation (top-left)
    ax = axes[0, 0]
    highs_objs = []
    cobra_objs = []
    passed = []

    for r in results:
        if r.get('highs_obj') is not None and r.get('cobra_obj') is not None:
            highs_objs.append(abs(r['highs_obj']))
            cobra_objs.append(abs(r['cobra_obj']))
            passed.append(r.get('passed', False))

    if highs_objs:
        highs_objs = np.array(highs_objs)
        cobra_objs = np.array(cobra_objs)
        passed = np.array(passed)

        max_val = max(max(highs_objs), max(cobra_objs))
        ax.plot([0, max_val], [0, max_val], 'k--', alpha=0.5, label='y=x')
        ax.scatter(highs_objs[passed], cobra_objs[passed], c='#22c55e', alpha=0.6, s=30, label='Passed')
        ax.scatter(highs_objs[~passed], cobra_objs[~passed], c='#ef4444', alpha=0.6, s=30, label='Failed')
        ax.set_xlabel('HiGHS Objective')
        ax.set_ylabel('COBRApy Objective')
        ax.set_title('A. Objective Correlation')
        ax.legend(loc='lower right', fontsize=8)
        ax.set_aspect('equal', adjustable='box')

    # 2. Error distribution (top-right)
    ax = axes[0, 1]
    obj_diffs = [r['obj_diff'] for r in results if r.get('obj_diff') is not None]
    if obj_diffs:
        log_diffs = np.log10(np.array(obj_diffs) + 1e-16)
        bins = np.linspace(-16, 0, 17)
        counts, edges, patches = ax.hist(log_diffs, bins=bins, color='#3b82f6', edgecolor='white', alpha=0.8)
        for i, (count, patch) in enumerate(zip(counts, patches)):
            bin_center = (edges[i] + edges[i + 1]) / 2
            if bin_center < -6:
                patch.set_facecolor('#22c55e')
            elif bin_center < -3:
                patch.set_facecolor('#eab308')
            else:
                patch.set_facecolor('#ef4444')
        ax.axvline(x=-6, color='#dc2626', linestyle='--', linewidth=2, label='Tolerance')
        ax.set_xlabel(r'$\log_{10}(|\Delta obj|)$')
        ax.set_ylabel('Count')
        ax.set_title('B. Error Distribution')
        ax.legend(fontsize=8)

    # 3. Solve time (bottom-left)
    ax = axes[1, 0]
    if summary and 'highsTime' in summary:
        highs_mean = summary['highsTime'].get('mean', 0)
        cobra_mean = summary['cobraTime'].get('mean', 0)
    else:
        highs_times = [r['highs_time_ms'] for r in results if r.get('highs_time_ms')]
        cobra_times = [r['cobra_time_ms'] for r in results if r.get('cobra_time_ms')]
        highs_mean = np.mean(highs_times) if highs_times else 0
        cobra_mean = np.mean(cobra_times) if cobra_times else 0

    bars = ax.bar(['HiGHS', 'COBRApy'], [highs_mean, cobra_mean],
                  color=['#3b82f6', '#8b5cf6'], edgecolor='white', width=0.5)
    for bar, time in zip(bars, [highs_mean, cobra_mean]):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1,
                f'{time:.1f}ms', ha='center', va='bottom', fontsize=9)
    ax.set_ylabel('Mean Solve Time (ms)')
    ax.set_title('C. Performance Comparison')

    # 4. Pass rate (bottom-right)
    ax = axes[1, 1]
    passed_count = sum(1 for r in results if r.get('passed', False))
    failed_count = len(results) - passed_count
    ax.pie([passed_count, failed_count], labels=['Passed', 'Failed'],
           colors=['#22c55e', '#ef4444'], autopct='%1.1f%%', startangle=90,
           textprops={'fontsize': 10})
    ax.set_title('D. Validation Summary')

    plt.tight_layout()
    fig.savefig(output_dir / 'validation_combined.pdf')
    fig.savefig(output_dir / 'validation_combined.png')
    plt.close(fig)
    print(f"Saved combined figure")


def main():
    # Find latest validation results
    results_dir = Path(__file__).parent.parent / 'python' / 'metabolicsuite' / 'benchmark_data' / 'results'

    if len(sys.argv) > 1:
        results_file = Path(sys.argv[1])
    else:
        # Find latest validation file
        validation_files = sorted(results_dir.glob('validation_*.json'), reverse=True)
        if not validation_files:
            print("No validation results found. Run: node scripts/validate-highs.mjs first")
            sys.exit(1)
        results_file = validation_files[0]

    print(f"Loading results from: {results_file}")
    results, summary = load_results(results_file)
    print(f"Loaded {len(results)} comparisons")

    # Create output directory
    output_dir = results_dir / 'plots'
    output_dir.mkdir(exist_ok=True)

    # Generate plots
    plot_objective_correlation(results, output_dir)
    plot_error_distribution(results, output_dir)
    plot_solve_time_comparison(results, summary, output_dir)
    plot_pass_rate_pie(results, output_dir)
    plot_combined_figure(results, summary, output_dir)

    print(f"\nAll plots saved to: {output_dir}")


if __name__ == '__main__':
    main()
