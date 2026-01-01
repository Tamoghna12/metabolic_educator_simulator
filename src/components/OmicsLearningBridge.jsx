/**
 * OmicsLearningBridge - Dual-Mode Learning/Research Interface
 *
 * Bridges educational content with real research tools for multi-omics integration.
 * Implements GIMME, E-Flux, iMAT algorithms with both:
 * - Learning mode: Step-by-step explanations, toy models, guided workflows
 * - Research mode: Full algorithm access, batch processing, raw outputs
 *
 * References:
 * - Becker & Palsson (2008) "Context-specific metabolic networks" PLoS Comput Biol
 * - Colijn et al. (2009) "Interpreting expression data" Mol Syst Biol
 * - Shlomi et al. (2008) "Network-based prediction" Nat Biotechnol
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useModel } from '../contexts/ModelContext';
import * as OmicsIntegration from '../lib/OmicsIntegration';

// Toy model for educational demos
const TOY_MODEL = {
  name: 'Educational Glycolysis Model',
  reactions: {
    'EX_glc': {
      name: 'Glucose uptake',
      metabolites: { 'glc_e': 1 },
      lower_bound: 0,
      upper_bound: 10,
      gpr: ''
    },
    'HEX1': {
      name: 'Hexokinase',
      metabolites: { 'glc_e': -1, 'g6p_c': 1, 'atp_c': -1, 'adp_c': 1 },
      lower_bound: 0,
      upper_bound: 1000,
      gpr: 'hxkA'
    },
    'PGI': {
      name: 'Phosphoglucose isomerase',
      metabolites: { 'g6p_c': -1, 'f6p_c': 1 },
      lower_bound: -1000,
      upper_bound: 1000,
      gpr: 'pgi'
    },
    'PFK': {
      name: 'Phosphofructokinase',
      metabolites: { 'f6p_c': -1, 'fdp_c': 1, 'atp_c': -1, 'adp_c': 1 },
      lower_bound: 0,
      upper_bound: 1000,
      gpr: 'pfkA or pfkB'
    },
    'FBA': {
      name: 'Fructose-bisphosphate aldolase',
      metabolites: { 'fdp_c': -1, 'g3p_c': 1, 'dhap_c': 1 },
      lower_bound: 0,
      upper_bound: 1000,
      gpr: 'fbaA and fbaB'
    },
    'GAPD': {
      name: 'Glyceraldehyde-3-P dehydrogenase',
      metabolites: { 'g3p_c': -1, '13dpg_c': 1, 'nad_c': -1, 'nadh_c': 1 },
      lower_bound: 0,
      upper_bound: 1000,
      gpr: 'gapA'
    },
    'PYK': {
      name: 'Pyruvate kinase',
      metabolites: { 'pep_c': -1, 'pyr_c': 1, 'adp_c': -1, 'atp_c': 1 },
      lower_bound: 0,
      upper_bound: 1000,
      gpr: '(pykA and pykB) or pykF'
    },
    'BIOMASS': {
      name: 'Biomass objective',
      metabolites: { 'pyr_c': -1, 'atp_c': -1 },
      lower_bound: 0,
      upper_bound: 1000,
      gpr: ''
    }
  },
  metabolites: {
    'glc_e': { name: 'Glucose', compartment: 'e' },
    'g6p_c': { name: 'Glucose-6-phosphate', compartment: 'c' },
    'f6p_c': { name: 'Fructose-6-phosphate', compartment: 'c' },
    'fdp_c': { name: 'Fructose-1,6-bisphosphate', compartment: 'c' },
    'g3p_c': { name: 'Glyceraldehyde-3-phosphate', compartment: 'c' },
    'dhap_c': { name: 'Dihydroxyacetone phosphate', compartment: 'c' },
    '13dpg_c': { name: '1,3-Bisphosphoglycerate', compartment: 'c' },
    'pep_c': { name: 'Phosphoenolpyruvate', compartment: 'c' },
    'pyr_c': { name: 'Pyruvate', compartment: 'c' },
    'atp_c': { name: 'ATP', compartment: 'c' },
    'adp_c': { name: 'ADP', compartment: 'c' },
    'nad_c': { name: 'NAD+', compartment: 'c' },
    'nadh_c': { name: 'NADH', compartment: 'c' }
  },
  genes: {
    'hxkA': { name: 'Hexokinase A' },
    'pgi': { name: 'Phosphoglucose isomerase' },
    'pfkA': { name: 'Phosphofructokinase A' },
    'pfkB': { name: 'Phosphofructokinase B' },
    'fbaA': { name: 'Aldolase A' },
    'fbaB': { name: 'Aldolase B' },
    'gapA': { name: 'GAPDH' },
    'pykA': { name: 'Pyruvate kinase A' },
    'pykB': { name: 'Pyruvate kinase B' },
    'pykF': { name: 'Pyruvate kinase F' }
  }
};

// Educational expression datasets
const EXPRESSION_SCENARIOS = {
  normal: {
    name: 'Normal Growth',
    description: 'Balanced expression across glycolytic genes',
    data: new Map([
      ['hxkA', 0.8], ['pgi', 0.9], ['pfkA', 0.85], ['pfkB', 0.3],
      ['fbaA', 0.7], ['fbaB', 0.75], ['gapA', 0.95],
      ['pykA', 0.6], ['pykB', 0.65], ['pykF', 0.4]
    ])
  },
  pfkBottleneck: {
    name: 'PFK Bottleneck',
    description: 'Low PFK expression creates metabolic bottleneck',
    data: new Map([
      ['hxkA', 0.9], ['pgi', 0.85], ['pfkA', 0.1], ['pfkB', 0.05],
      ['fbaA', 0.8], ['fbaB', 0.75], ['gapA', 0.9],
      ['pykA', 0.7], ['pykB', 0.65], ['pykF', 0.6]
    ])
  },
  highFlux: {
    name: 'High Flux State',
    description: 'Upregulated glycolysis (e.g., cancer metabolism)',
    data: new Map([
      ['hxkA', 0.95], ['pgi', 0.92], ['pfkA', 0.98], ['pfkB', 0.85],
      ['fbaA', 0.9], ['fbaB', 0.88], ['gapA', 0.99],
      ['pykA', 0.95], ['pykB', 0.9], ['pykF', 0.8]
    ])
  },
  knockdown: {
    name: 'GAPDH Knockdown',
    description: 'Simulates siRNA knockdown of gapA',
    data: new Map([
      ['hxkA', 0.8], ['pgi', 0.85], ['pfkA', 0.8], ['pfkB', 0.3],
      ['fbaA', 0.75], ['fbaB', 0.7], ['gapA', 0.05],
      ['pykA', 0.6], ['pykB', 0.55], ['pykF', 0.4]
    ])
  }
};

// Algorithm educational content
const ALGORITHM_CONTENT = {
  gimme: {
    name: 'GIMME',
    fullName: 'Gene Inactivity Moderated by Metabolism and Expression',
    reference: 'Becker & Palsson (2008) PLoS Comput Biol 4:e1000082',
    concept: `GIMME minimizes flux through reactions with low expression while
maintaining a required objective value. It answers: "What's the minimal
flux distribution consistent with this expression data?"`,
    steps: [
      {
        title: '1. Set Expression Threshold',
        description: 'Define a cutoff (typically 25th percentile) to classify reactions as "low expression"',
        formula: 'threshold = quantile(expression, 0.25)'
      },
      {
        title: '2. Solve Optimal FBA',
        description: 'Find maximum objective value without expression constraints',
        formula: 'Z* = max c·v subject to S·v = 0'
      },
      {
        title: '3. Constrain Objective',
        description: 'Require at least a fraction of optimal objective',
        formula: 'Z ≥ fraction × Z* (typically 90%)'
      },
      {
        title: '4. Minimize Inconsistency',
        description: 'Minimize flux through low-expression reactions',
        formula: 'min Σ |v_i| × (threshold - expr_i) for low-expression i'
      }
    ],
    keyInsight: `GIMME finds flux distributions that are consistent with expression data
by penalizing flux through reactions whose genes are poorly expressed.
This models the biological intuition that low mRNA → low enzyme → low flux.`
  },
  eflux: {
    name: 'E-Flux',
    fullName: 'Expression-based Flux',
    reference: 'Colijn et al. (2009) Mol Syst Biol 5:263',
    concept: `E-Flux directly scales reaction bounds by gene expression levels.
High expression → high flux capacity. Simple and intuitive, but may
over-constrain the solution space.`,
    steps: [
      {
        title: '1. Normalize Expression',
        description: 'Scale expression values to [0, 1] range',
        formula: 'expr_norm = (expr - min) / (max - min)'
      },
      {
        title: '2. Compute Reaction Expression',
        description: 'Apply GPR logic: AND → MIN, OR → MAX',
        formula: 'rxn_expr = GPR(gene_expressions)'
      },
      {
        title: '3. Scale Bounds',
        description: 'Reduce upper bounds proportionally to expression',
        formula: 'ub_new = ub_original × rxn_expr'
      },
      {
        title: '4. Solve FBA',
        description: 'Standard FBA with modified bounds',
        formula: 'max c·v subject to S·v = 0, lb ≤ v ≤ ub_new'
      }
    ],
    keyInsight: `E-Flux is computationally simple (single LP) but assumes a direct
linear relationship between expression and flux capacity. This may not
hold for post-transcriptional regulation or enzyme kinetics.`
  },
  imat: {
    name: 'iMAT',
    fullName: 'Integrative Metabolic Analysis Tool',
    reference: 'Shlomi et al. (2008) Nat Biotechnol 26:1003',
    concept: `iMAT maximizes consistency between flux activity and expression data.
It tries to activate high-expression reactions and deactivate low-expression
reactions, treating flux prediction as a classification problem.`,
    steps: [
      {
        title: '1. Classify Reactions',
        description: 'Label reactions as high/medium/low based on expression',
        formula: 'High: expr > 0.75, Low: expr < 0.25, Medium: otherwise'
      },
      {
        title: '2. Define Binary Variables',
        description: 'Introduce indicator variables for reaction activity',
        formula: 'y_i = 1 if |v_i| > ε, else 0'
      },
      {
        title: '3. Maximize Consistency',
        description: 'Maximize activation of high-expr and deactivation of low-expr',
        formula: 'max Σ y_i (for high) + Σ (1-y_i) (for low)'
      },
      {
        title: '4. LP Relaxation',
        description: 'Solve continuous relaxation for tractability',
        formula: 'y_i ∈ [0,1] instead of {0,1}'
      }
    ],
    keyInsight: `iMAT frames the problem as: "How can I make flux activity patterns
match expression patterns?" It's more flexible than E-Flux but requires
choosing thresholds for high/low classification.`
  }
};

// Research Wizard Steps
const RESEARCH_WIZARD_STEPS = [
  {
    id: 'load-model',
    title: 'Load Metabolic Model',
    description: 'Upload SBML or JSON model file',
    instruction: 'Use the Model tab to upload your genome-scale model (e.g., iML1515)',
    validation: (context) => !!context.model?.reactions
  },
  {
    id: 'load-omics',
    title: 'Load Expression Data',
    description: 'Upload transcriptomics CSV',
    instruction: 'Upload DESeq2/edgeR output with gene IDs matching your model',
    validation: (context) => !!context.expressionData?.size
  },
  {
    id: 'select-method',
    title: 'Select Integration Method',
    description: 'Choose GIMME, E-Flux, or iMAT',
    instruction: 'Each method has different assumptions - review the theory above',
    validation: (context) => !!context.selectedMethod
  },
  {
    id: 'configure',
    title: 'Configure Parameters',
    description: 'Set method-specific thresholds',
    instruction: 'Adjust parameters based on your data distribution',
    validation: (context) => !!context.parameters
  },
  {
    id: 'run',
    title: 'Run Integration',
    description: 'Execute the algorithm',
    instruction: 'Click Run and wait for the solver',
    validation: (context) => !!context.result
  },
  {
    id: 'interpret',
    title: 'Interpret Results',
    description: 'Analyze flux changes',
    instruction: 'Compare to wild-type FBA, identify key pathway changes',
    validation: () => true
  }
];

// Expression bar visualization
const ExpressionBar = ({ value, label, highlight = false }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-[var(--text-muted)] w-12 text-right font-mono">{label}</span>
    <div className="flex-1 h-4 bg-[var(--bg-secondary)] rounded overflow-hidden">
      <div
        className={`h-full transition-all duration-300 ${
          highlight ? 'bg-[var(--warning)]' : value > 0.5 ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'
        }`}
        style={{ width: `${value * 100}%` }}
      />
    </div>
    <span className="text-xs font-mono w-10">{value.toFixed(2)}</span>
  </div>
);

// Algorithm Step Card
const StepCard = ({ step, index, isActive }) => (
  <div className={`p-3 rounded-lg border transition-all ${
    isActive
      ? 'bg-[var(--primary-bg)] border-[var(--primary)]'
      : 'bg-[var(--card-bg)] border-[var(--card-border)]'
  }`}>
    <div className="flex items-start gap-3">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
        isActive ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
      }`}>
        {index + 1}
      </span>
      <div className="flex-1">
        <h5 className="text-sm font-medium text-[var(--text-primary)]">{step.title}</h5>
        <p className="text-xs text-[var(--text-secondary)] mt-1">{step.description}</p>
        {step.formula && (
          <code className="block text-[10px] font-mono bg-[var(--bg-primary)] p-1.5 rounded mt-2 text-[var(--info-text)]">
            {step.formula}
          </code>
        )}
      </div>
    </div>
  </div>
);

// Interactive Demo Component
const InteractiveDemo = ({ model, expressionData, algorithm, onResult }) => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(0);

  const runDemo = useCallback(async () => {
    setRunning(true);
    setStep(0);

    try {
      // Animate through steps
      for (let i = 0; i < ALGORITHM_CONTENT[algorithm].steps.length; i++) {
        setStep(i);
        await new Promise(r => setTimeout(r, 800));
      }

      // Run actual algorithm
      let res;
      switch (algorithm) {
        case 'gimme':
          res = await OmicsIntegration.solveGIMME(model, expressionData, {
            threshold: 0.25,
            requiredFraction: 0.9
          });
          break;
        case 'eflux':
          res = await OmicsIntegration.solveEFlux(model, expressionData);
          break;
        case 'imat':
          res = await OmicsIntegration.solveIMAT(model, expressionData, {
            highThreshold: 0.75,
            lowThreshold: 0.25
          });
          break;
        default:
          throw new Error('Unknown algorithm');
      }

      setResult(res);
      if (onResult) onResult(res);

    } catch (err) {
      console.error('Demo failed:', err);
    } finally {
      setRunning(false);
    }
  }, [model, expressionData, algorithm, onResult]);

  const content = ALGORITHM_CONTENT[algorithm];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-[var(--text-primary)]">
          Interactive {content.name} Demo
        </h4>
        <button
          onClick={runDemo}
          disabled={running}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            running
              ? 'bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-wait'
              : 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]'
          }`}
        >
          {running ? 'Running...' : 'Run Demo'}
        </button>
      </div>

      {/* Algorithm Steps with Animation */}
      <div className="grid gap-2">
        {content.steps.map((s, i) => (
          <StepCard key={i} step={s} index={i} isActive={running && step === i} />
        ))}
      </div>

      {/* Result */}
      {result && (
        <div className="p-4 bg-[var(--success-bg)] border border-[var(--success)] rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--success-text)]">
              {result.method} Complete
            </span>
            <span className="text-lg font-bold font-mono">
              {(result.objectiveValue || 0).toFixed(4)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-[var(--card-bg)] rounded">
              <p className="text-[var(--text-muted)]">Status</p>
              <p className="font-medium">{result.status}</p>
            </div>
            <div className="p-2 bg-[var(--card-bg)] rounded">
              <p className="text-[var(--text-muted)]">Active Rxns</p>
              <p className="font-medium">
                {Object.values(result.fluxes || {}).filter(v => Math.abs(v) > 0.001).length}
              </p>
            </div>
            <div className="p-2 bg-[var(--card-bg)] rounded">
              <p className="text-[var(--text-muted)]">Solver</p>
              <p className="font-medium">GLPK</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Research Wizard Component
const ResearchWizard = ({ currentStep, context, onStepChange }) => (
  <div className="space-y-3">
    <h4 className="text-sm font-medium text-[var(--text-primary)]">Research Workflow</h4>
    <div className="space-y-2">
      {RESEARCH_WIZARD_STEPS.map((step, i) => {
        const isComplete = step.validation(context);
        const isCurrent = currentStep === i;
        const isAccessible = i <= currentStep || isComplete;

        return (
          <button
            key={step.id}
            onClick={() => isAccessible && onStepChange(i)}
            disabled={!isAccessible}
            className={`w-full p-3 rounded-lg border text-left transition-all ${
              isCurrent
                ? 'bg-[var(--primary-bg)] border-[var(--primary)]'
                : isComplete
                  ? 'bg-[var(--success-bg)] border-[var(--success)]'
                  : 'bg-[var(--card-bg)] border-[var(--card-border)] opacity-60'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                isComplete
                  ? 'bg-[var(--success)] text-white'
                  : isCurrent
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-muted)]'
              }`}>
                {isComplete ? '✓' : i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{step.title}</p>
                <p className="text-xs text-[var(--text-secondary)]">{step.description}</p>
              </div>
            </div>
            {isCurrent && (
              <p className="text-xs text-[var(--info-text)] mt-2 ml-9">
                {step.instruction}
              </p>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

// Main Component
export const OmicsLearningBridge = ({ onIntegrationResult }) => {
  const { currentModel } = useModel();

  // Mode state
  const [mode, setMode] = useState('learning'); // 'learning' | 'research'

  // Learning mode state
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('gimme');
  const [selectedScenario, setSelectedScenario] = useState('normal');

  // Research mode state
  const [wizardStep, setWizardStep] = useState(0);

  // Research context (derived from props and state)
  const researchContextWithModel = useMemo(() => ({
    model: currentModel,
    expressionData: null,
    selectedMethod: null,
    parameters: null,
    result: null
  }), [currentModel]);

  const algorithmContent = ALGORITHM_CONTENT[selectedAlgorithm];
  const scenarioData = EXPRESSION_SCENARIOS[selectedScenario];

  const handleDemoResult = useCallback((result) => {
    if (onIntegrationResult) {
      onIntegrationResult(result);
    }
  }, [onIntegrationResult]);

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex items-center justify-between p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Multi-Omics Integration
          </h3>
          <p className="text-sm text-[var(--text-secondary)]">
            {mode === 'learning'
              ? 'Learn algorithms with interactive demos'
              : 'Full research capabilities with your data'
            }
          </p>
        </div>
        <div className="flex bg-[var(--bg-primary)] rounded-lg p-1">
          <button
            onClick={() => setMode('learning')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'learning'
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Learning Mode
          </button>
          <button
            onClick={() => setMode('research')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'research'
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Research Mode
          </button>
        </div>
      </div>

      {mode === 'learning' ? (
        /* Learning Mode UI */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Algorithm Theory */}
          <div className="space-y-4">
            {/* Algorithm Selection */}
            <div className="p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
                Select Algorithm
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(ALGORITHM_CONTENT).map(([key, alg]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedAlgorithm(key)}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      selectedAlgorithm === key
                        ? 'bg-[var(--primary-bg)] border-[var(--primary)]'
                        : 'bg-[var(--bg-primary)] border-[var(--border-color)] hover:border-[var(--primary)]'
                    }`}
                  >
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {alg.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Algorithm Explanation */}
            <div className="p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-[var(--text-primary)]">
                  {algorithmContent.fullName}
                </h4>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-mono mb-3">
                {algorithmContent.reference}
              </p>

              <div className="p-3 bg-[var(--info-bg)] border border-[var(--info)] rounded-lg mb-4">
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">
                  {algorithmContent.concept}
                </p>
              </div>

              <h5 className="text-sm font-medium text-[var(--text-primary)] mb-2">
                Algorithm Steps
              </h5>
              <div className="space-y-2">
                {algorithmContent.steps.map((step, i) => (
                  <StepCard key={i} step={step} index={i} isActive={false} />
                ))}
              </div>

              <div className="mt-4 p-3 bg-[var(--warning-bg)] border border-[var(--warning)] rounded-lg">
                <h5 className="text-sm font-medium text-[var(--warning-text)] mb-1">
                  Key Insight
                </h5>
                <p className="text-xs text-[var(--text-secondary)] whitespace-pre-line">
                  {algorithmContent.keyInsight}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Interactive Demo */}
          <div className="space-y-4">
            {/* Expression Scenario Selection */}
            <div className="p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
                Expression Scenario
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(EXPRESSION_SCENARIOS).map(([key, scenario]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedScenario(key)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedScenario === key
                        ? 'bg-[var(--primary-bg)] border-[var(--primary)]'
                        : 'bg-[var(--bg-primary)] border-[var(--border-color)] hover:border-[var(--primary)]'
                    }`}
                  >
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {scenario.name}
                    </span>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {scenario.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Expression Data Preview */}
            <div className="p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
                Gene Expression ({scenarioData.name})
              </h4>
              <div className="space-y-1.5">
                {Array.from(scenarioData.data.entries()).map(([gene, expr]) => (
                  <ExpressionBar
                    key={gene}
                    label={gene}
                    value={expr}
                    highlight={expr < 0.25}
                  />
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Red = low expression (&lt;0.25), Green = high expression (&gt;0.5), Orange = highlighted
              </p>
            </div>

            {/* Interactive Demo */}
            <div className="p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
              <InteractiveDemo
                model={TOY_MODEL}
                expressionData={scenarioData.data}
                algorithm={selectedAlgorithm}
                onResult={handleDemoResult}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Research Mode UI */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Research Wizard */}
          <div className="lg:col-span-1">
            <div className="p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
              <ResearchWizard
                currentStep={wizardStep}
                context={researchContextWithModel}
                onStepChange={setWizardStep}
              />
            </div>

            {/* Quick Tips */}
            <div className="mt-4 p-4 bg-[var(--info-bg)] border border-[var(--info)] rounded-lg">
              <h5 className="text-sm font-medium text-[var(--info-text)] mb-2">
                Research Tips
              </h5>
              <ul className="text-xs text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                <li>Normalize expression to [0,1] for best results</li>
                <li>Match gene IDs to your model's gene annotations</li>
                <li>Compare multiple methods to validate findings</li>
                <li>Use FVA to assess flux variability</li>
              </ul>
            </div>
          </div>

          {/* Right: Research Interface */}
          <div className="lg:col-span-2 space-y-4">
            <div className="p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
                Research Mode Interface
              </h4>
              <p className="text-sm text-[var(--text-secondary)]">
                Upload your model and omics data using the tabs above. The OmicsDataUpload
                component provides the full research interface with:
              </p>
              <ul className="mt-3 text-sm text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                <li>Multi-omics data loading (transcriptomics, proteomics, metabolomics)</li>
                <li>GIMME, E-Flux, iMAT, MADE algorithm execution</li>
                <li>Parameter configuration for each method</li>
                <li>Batch processing support</li>
                <li>Export of flux results</li>
              </ul>
              <p className="text-xs text-[var(--text-muted)] mt-4">
                Switch to the Omics tab above for the full data upload interface.
              </p>
            </div>

            {/* Algorithm comparison for research */}
            <div className="p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
                Algorithm Comparison Guide
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      <th className="p-2 text-left text-[var(--text-secondary)]">Method</th>
                      <th className="p-2 text-left text-[var(--text-secondary)]">Approach</th>
                      <th className="p-2 text-left text-[var(--text-secondary)]">Complexity</th>
                      <th className="p-2 text-left text-[var(--text-secondary)]">Best For</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[var(--border-color)]">
                      <td className="p-2 font-medium">E-Flux</td>
                      <td className="p-2">Scale bounds by expression</td>
                      <td className="p-2">O(n) - Single LP</td>
                      <td className="p-2">Quick initial analysis</td>
                    </tr>
                    <tr className="border-b border-[var(--border-color)]">
                      <td className="p-2 font-medium">GIMME</td>
                      <td className="p-2">Minimize low-expr flux</td>
                      <td className="p-2">O(n) - Single LP</td>
                      <td className="p-2">Context-specific models</td>
                    </tr>
                    <tr className="border-b border-[var(--border-color)]">
                      <td className="p-2 font-medium">iMAT</td>
                      <td className="p-2">Max expression consistency</td>
                      <td className="p-2">O(n²) - LP relaxation</td>
                      <td className="p-2">High/low classification</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium">MADE</td>
                      <td className="p-2">Differential comparison</td>
                      <td className="p-2">O(2n) - Two LPs</td>
                      <td className="p-2">Control vs treatment</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OmicsLearningBridge;
