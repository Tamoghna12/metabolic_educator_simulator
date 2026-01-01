import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  BookOpen, Database, Microscope, Zap, BarChart3, Scissors,
  Compass, Share2, Trophy
} from 'lucide-react';
import { ProgressProvider, useProgress, XPBar, BadgesPanel, TutorialTooltip, LearningPath, QuizModule } from './EducationalFeatures';
import { ModelUpload } from './ModelUpload';
import { useModel } from '../contexts/ModelContext';
import { modules } from '../data/metabolicData';
// FBASolver is a pure JS utility class without Recharts - safe to import directly
import { FBASolver } from './EnhancedModeling';
import { largeModelHandler } from '../lib/LargeModelHandler';

// Navigation tab configuration
const NAV_TABS = [
  { id: 'learn', icon: BookOpen, label: 'Learn' },
  { id: 'model', icon: Database, label: 'Model' },
  { id: 'omics', icon: Microscope, label: 'Multi-Omics' },
  { id: 'simulate', icon: Zap, label: 'Simulate' },
  { id: 'visualize', icon: BarChart3, label: 'Visualize' },
  { id: 'knockout', icon: Scissors, label: 'Knockout' },
  { id: 'explore', icon: Compass, label: 'Explore' },
  { id: 'share', icon: Share2, label: 'Share' },
  { id: 'achievements', icon: Trophy, label: 'Achievements' }
];

// Lazy load heavy visualization components (contain SVG rendering)
const NetworkGraph = lazy(() => import('./Visualizations').then(m => ({ default: m.NetworkGraph })));
const FluxHeatmap = lazy(() => import('./Visualizations').then(m => ({ default: m.FluxHeatmap })));
const PathwayDiagram = lazy(() => import('./Visualizations').then(m => ({ default: m.PathwayDiagram })));
const ReactionDetail = lazy(() => import('./Visualizations').then(m => ({ default: m.ReactionDetail })));
const ComparativeAnalysis = lazy(() => import('./Visualizations').then(m => ({ default: m.ComparativeAnalysis })));
const PathwayMapBuilder = lazy(() => import('./PathwayMapBuilder'));
const OmicsDataUpload = lazy(() => import('./OmicsDataUpload'));
const OmicsLearningBridge = lazy(() => import('./OmicsLearningBridge'));
const OmicsVisualization = lazy(() => import('./OmicsVisualization'));
const StateSharing = lazy(() => import('./StateSharing'));
const EscherImport = lazy(() => import('./EscherImport'));

// Lazy load chart-heavy components (contain Recharts dependencies)
const ProductionEnvelope = lazy(() => import('./EnhancedModeling').then(m => ({ default: m.ProductionEnvelope })));
const FluxComparison = lazy(() => import('./EnhancedModeling').then(m => ({ default: m.FluxComparison })));
const EnhancedResultsPanel = lazy(() => import('./EnhancedModeling').then(m => ({ default: m.EnhancedResultsPanel })));
const SolverSelector = lazy(() => import('./EnhancedModeling').then(m => ({ default: m.SolverSelector })));
const SubsystemView = lazy(() => import('./SubsystemView'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-pulse text-[var(--text-secondary)]">Loading...</div>
  </div>
);

function EnhancedLearningPlatform() {
  const { progress, completeModule } = useProgress();
  const { currentModel, modelStats, subsystems, isDefaultModel } = useModel();

  // Get genes and reactions from current model
  const genes = currentModel.genes || {};
  const reactions = currentModel.reactions || {};

  const [tab, setTab] = useState('learn');
  const [module, setModule] = useState(null);
  const [constraints, setConstraints] = useState({ EX_glc: { lb: -10 }, EX_o2: { lb: -20 } });
  const [knockouts, setKnockouts] = useState([]);
  const [solverMethod, setSolverMethod] = useState('standard');
  const [result, setResult] = useState(null);
  const [wildTypeResult, setWildTypeResult] = useState(null);
  const [fvaResult, setFvaResult] = useState(null);
  const [selectedReaction, setSelectedReaction] = useState(null);
  const [selectedPathway, setSelectedPathway] = useState('glycolysis');
  const [filter, setFilter] = useState('all');
  const [comparisonResults, setComparisonResults] = useState([]);
  const [showQuiz, setShowQuiz] = useState(false);
  const [selectedModuleForQuiz, setSelectedModuleForQuiz] = useState(null);
  const [visualizationMode, setVisualizationMode] = useState('interactive'); // 'basic', 'interactive', 'subsystem'

  const [isSimulating, setIsSimulating] = useState(false);

  // Omics integration results from OmicsDataUpload
  const [omicsIntegrationResult, setOmicsIntegrationResult] = useState(null);

  // Large model analysis
  const [modelAnalysis, setModelAnalysis] = useState(null);

  // Escher map import modal
  const [showEscherImport, setShowEscherImport] = useState(false);
  const [importedMap, setImportedMap] = useState(null);

  // Handler for Escher map import
  const handleEscherMapImport = useCallback((mapData) => {
    setImportedMap(mapData);
    // Could be used to overlay on visualizations or update pathway view
    console.log('Escher map imported:', mapData.name, 'with', mapData.reactions.length, 'reactions');
  }, []);

  // Callback to receive omics integration results
  const handleOmicsIntegrationResult = useCallback((result) => {
    setOmicsIntegrationResult(result);
    // Also update the main result to show integrated FBA
    if (result && result.fluxes) {
      setResult(prev => ({
        ...prev,
        ...result,
        isOmicsIntegrated: true,
        omicsMethod: result.method
      }));
    }
  }, []);

  const runSimulation = useCallback(async () => {
    setIsSimulating(true);

    try {
      let res;
      switch (solverMethod) {
        case 'pfba':
          res = await FBASolver.solvePFBA(currentModel, constraints, knockouts, null);
          break;
        case 'moma':
          res = await FBASolver.solveMOMA(currentModel, constraints, knockouts, null);
          break;
        case 'fva':
          res = await FBASolver.solveFVA(currentModel, constraints, knockouts, null);
          setFvaResult(res);
          break;
        default:
          res = await FBASolver.solveFBA(currentModel, constraints, knockouts, null);
      }

      setResult(res);

      if (knockouts.length > 0 && currentModel?.reactions) {
        const wt = await FBASolver.solveFBA(currentModel, constraints, [], null);
        setWildTypeResult(wt);

        if (!comparisonResults.find(r => r.label === 'Current Mutant')) {
          setComparisonResults(prev => [
            { label: 'Wild Type', ...wt },
            { label: 'Current Mutant', ...res },
            ...prev
          ]);
        }
      } else {
        setWildTypeResult(null);
      }
    } catch (error) {
      console.error('Simulation error:', error);
      setResult({
        status: 'error',
        error: error.message,
        growthRate: 0,
        yield: 0,
        fluxes: {},
        blocked: [],
        phenotype: 'error',
        acetate: 0,
        co2: 0
      });
    } finally {
      setIsSimulating(false);
    }
  }, [currentModel, constraints, knockouts, solverMethod, comparisonResults]);

  // Run simulation when model or parameters change
  useEffect(() => {
    runSimulation();
  }, [currentModel, constraints, knockouts, solverMethod]);

  // Analyze model for performance recommendations
  useEffect(() => {
    if (currentModel) {
      const analysis = largeModelHandler.analyzeModel(currentModel);
      setModelAnalysis(analysis);
    }
  }, [currentModel]);

  const toggleKO = (id) => setKnockouts(p => p.includes(id) ? p.filter(g => g !== id) : [...p, id]);  
  const openModuleWithQuiz = (mod) => {
    setSelectedModuleForQuiz(mod);
    setModule(mod);
    setShowQuiz(false);
  };

  const startQuiz = () => {
    setModule(null);
    setShowQuiz(true);
  };

  const handleModuleComplete = () => {
    if (selectedModuleForQuiz) {
      completeModule(selectedModuleForQuiz.id);
    }
    setModule(null);
    setShowQuiz(false);
    setSelectedModuleForQuiz(null);
  };

  const handleQuizPass = () => {
    if (selectedModuleForQuiz) {
      completeModule(selectedModuleForQuiz.id);
    }
    setShowQuiz(false);
    setSelectedModuleForQuiz(null);
  };

  const filteredGenes = Object.entries(genes).filter(([id, g]) => {
    if (filter === 'essential') return g.essential;
    if (filter === 'knockout') return knockouts.includes(id);
    if (filter !== 'all') return g.subsystem === filter;
    return true;
  });

  const activeReactions = result ? Object.keys(result.fluxes).filter(r => Math.abs(result.fluxes[r]) > 0.1) : [];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans p-4 md:p-6 animate-fadeIn">
      
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-primary)]">
              Constraint-Based Metabolic Modeling
            </h1>
            <p className="text-[var(--text-secondary)] text-sm">Enhanced Learning Platform with Advanced Analytics</p>
          </div>
          <XPBar />
        </header>
        
        <div className="mb-4 paper-container flex items-center justify-between flex-wrap gap-2 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-[var(--text-secondary)] text-sm font-medium">Progress: {progress.completedModules.length}/{modules.length} modules</span>
            <div className="w-32 h-2 bg-[var(--border-color)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${progress.completedModules.length / modules.length * 100}%` }}/>
            </div>
          </div>
          {result && <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            result.phenotype === 'lethal' 
              ? 'bg-[var(--danger-bg)] text-[var(--danger-text)] border border-[var(--danger)]' 
              : 'bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success)]'
          }`}>
            μ = {result.growthRate.toFixed(3)} h⁻¹ • {solverMethod.toUpperCase()}
          </span>}
        </div>
        
        <nav className="flex gap-1 mb-6 overflow-x-auto pb-2 border-b border-[var(--border-color)]" role="tablist" aria-label="Main navigation">
          {NAV_TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all relative ${
                  isActive
                    ? 'text-[var(--primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-primary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)]" />
                )}
              </button>
            );
          })}
        </nav>
        
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-6">
            {tab === 'learn' && (
              <div className="space-y-4">
                <div className="section-header">
                  <h2 className="section-title">Learning Modules</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {modules.map(m => (
                    <div key={m.id} onClick={() => openModuleWithQuiz(m)}
                      className={`p-6 rounded-lg text-left border transition-all hover:shadow-md cursor-pointer ${
                        progress.completedModules.includes(m.id)
                          ? 'bg-[var(--success-bg)] border-[var(--success)]'
                          : 'bg-[var(--card-bg)] border-[var(--card-border)] hover:border-[var(--primary)]'
                      }`}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{m.icon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--text-primary)]">{m.title}</span>
                            {progress.completedModules.includes(m.id) && <span className="text-[var(--success-text)] text-sm font-semibold">✓ Completed</span>}
                          </div>
                          <p className="text-[var(--text-secondary)] text-xs">{m.difficulty} • {m.duration} • 100 XP</p>
                        </div>
                      </div>
                      {m.quiz && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedModuleForQuiz(m); setShowQuiz(true); }}
                          className="text-xs text-[var(--primary)] hover:text-[var(--primary-hover)] font-medium mt-2"
                        >
                          Take Quiz →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'model' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="paper-container">
                    <ModelUpload />
                  </div>
                  <div className="paper-container">
                    <div className="section-header">
                      <h3 className="section-title">Model Information</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg">
                        <p className="text-lg font-bold text-[var(--text-primary)]">{currentModel.name}</p>
                        <p className="text-sm text-[var(--text-secondary)]">{currentModel.description}</p>
                        {!isDefaultModel && currentModel.fileName && (
                          <p className="text-xs text-[var(--text-muted)] mt-2">
                            Source: {currentModel.fileName}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded">
                          <p className="text-xs text-[var(--text-secondary)] font-medium uppercase">Genes</p>
                          <p className="text-2xl font-bold text-[var(--primary)] font-mono">{modelStats.genes}</p>
                        </div>
                        <div className="p-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded">
                          <p className="text-xs text-[var(--text-secondary)] font-medium uppercase">Reactions</p>
                          <p className="text-2xl font-bold text-[var(--primary)] font-mono">{modelStats.reactions}</p>
                        </div>
                      </div>
                      {subsystems.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)] mb-2">Subsystems ({subsystems.length})</p>
                          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto scrollbar-thin">
                            {subsystems.slice(0, 20).map(s => (
                              <span key={s} className="px-2 py-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-secondary)]">
                                {s}
                              </span>
                            ))}
                            {subsystems.length > 20 && (
                              <span className="px-2 py-1 text-xs text-[var(--text-muted)]">
                                +{subsystems.length - 20} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Escher Map Import Section */}
                <div className="paper-container">
                  <div className="section-header">
                    <h3 className="section-title">Pathway Visualization</h3>
                  </div>
                  <div className="space-y-4">
                    <p className="text-sm text-[var(--text-secondary)]">
                      Import Escher pathway maps to visualize metabolic networks with flux overlays.
                      Supports BiGG Models maps and custom JSON files.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setShowEscherImport(true)}
                        className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Import Escher Map
                      </button>
                      {importedMap && (
                        <div className="px-4 py-2 bg-[var(--success-bg)] border border-[var(--success)] rounded-lg flex items-center gap-2">
                          <svg className="w-4 h-4 text-[var(--success-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm text-[var(--success-text)]">
                            {importedMap.name} ({importedMap.reactions.length} reactions)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'omics' && (
              <div className="space-y-6">
                {/* Learning/Research Bridge - Dual Mode Interface */}
                <Suspense fallback={<LoadingFallback />}>
                  <div className="paper-container">
                    <OmicsLearningBridge onIntegrationResult={handleOmicsIntegrationResult} />
                  </div>
                </Suspense>

                {/* Data Upload Interface */}
                <Suspense fallback={<LoadingFallback />}>
                  <div className="paper-container">
                    <OmicsDataUpload onIntegrationResult={handleOmicsIntegrationResult} />
                  </div>
                </Suspense>

                {/* Show omics integration result summary */}
                {omicsIntegrationResult && (
                  <div className="paper-container">
                    <div className="section-header">
                      <h3 className="section-title">Integration Result: {omicsIntegrationResult.method}</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-[var(--success-bg)] border border-[var(--success)] rounded-lg text-center">
                        <p className="text-xs text-[var(--text-muted)]">Status</p>
                        <p className="text-sm font-medium text-[var(--success-text)]">{omicsIntegrationResult.status}</p>
                      </div>
                      <div className="p-3 bg-[var(--info-bg)] border border-[var(--info)] rounded-lg text-center">
                        <p className="text-xs text-[var(--text-muted)]">Objective Value</p>
                        <p className="text-lg font-bold font-mono">{(omicsIntegrationResult.objectiveValue || 0).toFixed(4)}</p>
                      </div>
                      <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-center">
                        <p className="text-xs text-[var(--text-muted)]">Active Reactions</p>
                        <p className="text-lg font-bold font-mono">
                          {Object.values(omicsIntegrationResult.fluxes || {}).filter(v => Math.abs(v) > 0.001).length}
                        </p>
                      </div>
                      <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-center">
                        <p className="text-xs text-[var(--text-muted)]">Reference</p>
                        <p className="text-[10px] font-mono text-[var(--text-secondary)]">{omicsIntegrationResult.reference}</p>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-3">
                      Results available in Simulate tab for visualization and comparison.
                    </p>
                  </div>
                )}

                <div className="paper-container">
                  <div className="section-header">
                    <h3 className="section-title">Integration Guide</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-[var(--info-bg)] border border-[var(--info)] rounded-lg">
                      <h4 className="text-sm font-medium text-[var(--info-text)] mb-2">Transcriptomics + Proteomics</h4>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Gene expression data colors reaction arrows based on GPR rules.
                        Protein abundance affects arrow width. Upload DESeq2/MaxQuant output.
                      </p>
                    </div>
                    <div className="p-4 bg-[var(--success-bg)] border border-[var(--success)] rounded-lg">
                      <h4 className="text-sm font-medium text-[var(--success-text)] mb-2">Metabolomics</h4>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Metabolite concentrations affect node size and color.
                        Use BiGG IDs for best matching. Upload MetaboAnalyst export.
                      </p>
                    </div>
                    <div className="p-4 bg-[var(--warning-bg)] border border-[var(--warning)] rounded-lg">
                      <h4 className="text-sm font-medium text-[var(--warning-text)] mb-2">Fluxomics</h4>
                      <p className="text-xs text-[var(--text-secondary)]">
                        13C-MFA measured fluxes overlay on predicted FBA fluxes.
                        Animation speed reflects flux magnitude.
                      </p>
                    </div>
                    <div className="p-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg">
                      <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">Multi-layer Visualization</h4>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Combine all data types: expression colors arrows, abundance sets width,
                        metabolites scale nodes, fluxes animate flow.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'simulate' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="paper-container">
                    <div className="section-header">
                      <h3 className="section-title">Solver Configuration</h3>
                    </div>
                    <Suspense fallback={<LoadingFallback />}>
                      <SolverSelector method={solverMethod} onChange={setSolverMethod} />
                    </Suspense>
                    <TutorialTooltip content="Adjust nutrient uptake rates to simulate different growth conditions">
                      <div className="space-y-3 mt-4">
                        <h4 className="text-sm font-medium text-[var(--text-primary)]">Environmental Constraints</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-[var(--text-secondary)] font-medium">Glucose Uptake (mmol/gDW/h)</label>
                            <input
                              type="number"
                              value={Math.abs(constraints.EX_glc?.lb ?? 10)}
                              onChange={(e) => setConstraints({ ...constraints, EX_glc: { lb: -Number(e.target.value) } })}
                              className="w-full p-2 border border-[var(--input-border)] bg-[var(--input-bg)] rounded text-[var(--text-primary)] text-sm focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-[var(--text-secondary)] font-medium">Oxygen Uptake (mmol/gDW/h)</label>
                            <input
                              type="number"
                              value={Math.abs(constraints.EX_o2?.lb ?? 20)}
                              onChange={(e) => setConstraints({ ...constraints, EX_o2: { lb: -Number(e.target.value) } })}
                              className="w-full p-2 border border-[var(--input-border)] bg-[var(--input-bg)] rounded text-[var(--text-primary)] text-sm focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </TutorialTooltip>
                    {solverMethod === 'fva' && (
                      <Suspense fallback={<LoadingFallback />}>
                        <ProductionEnvelope constraints={constraints} knockouts={knockouts} objective="BIOMASS" />
                      </Suspense>
                    )}
                  </div>
                  <div className="paper-container">
                    <div className="section-header">
                      <h3 className="section-title">Simulation Results</h3>
                    </div>
                    <Suspense fallback={<LoadingFallback />}>
                      <EnhancedResultsPanel result={result} wildTypeResult={wildTypeResult} fvaResult={fvaResult} isSimulating={isSimulating} />
                    </Suspense>
                  </div>
                </div>

                {/* Integrated Omics Visualization - MVP Priority 1 */}
                <div className="paper-container">
                  <div className="section-header">
                    <h3 className="section-title">
                      Flux & Expression Network
                      {result?.isOmicsIntegrated && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success)] rounded">
                          {result.omicsMethod} integrated
                        </span>
                      )}
                    </h3>
                  </div>
                  <Suspense fallback={<LoadingFallback />}>
                    <OmicsVisualization
                      fluxes={result?.fluxes || {}}
                      width={850}
                      height={450}
                      showValidation={true}
                      showLegend={true}
                      showExport={true}
                    />
                  </Suspense>
                </div>
              </div>
            )}
            
            {tab === 'visualize' && (
              <div className="space-y-6">
                <div className="paper-container">
                  <div className="section-header flex items-center justify-between">
                    <h3 className="section-title">Metabolic Network Visualization</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--text-secondary)]">View:</span>
                      {[
                        { id: 'basic', label: 'Basic' },
                        { id: 'interactive', label: 'Interactive' },
                        { id: 'subsystem', label: 'Subsystems' }
                      ].map(mode => (
                        <button
                          key={mode.id}
                          onClick={() => setVisualizationMode(mode.id)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            visualizationMode === mode.id
                              ? 'bg-[var(--primary)] text-white'
                              : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Suspense fallback={<LoadingFallback />}>
                    {visualizationMode === 'subsystem' ? (
                      <SubsystemView
                        fluxes={result?.fluxes || {}}
                        width={850}
                        height={550}
                        onReactionSelect={(id) => setSelectedReaction(id)}
                      />
                    ) : visualizationMode === 'interactive' ? (
                      <PathwayMapBuilder
                        fluxes={result?.fluxes || {}}
                        width={850}
                        height={500}
                        onNodeSelect={(id) => console.log('Selected node:', id)}
                        onReactionSelect={(id) => setSelectedReaction(id)}
                      />
                    ) : (
                      <NetworkGraph reactions={reactions} fluxes={result?.fluxes} width={800} height={400} />
                    )}
                  </Suspense>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="paper-container">
                    <div className="section-header">
                      <h3 className="section-title">Pathway Analysis</h3>
                    </div>
                    <Suspense fallback={<LoadingFallback />}>
                      <PathwayDiagram pathway={selectedPathway} activeReactions={activeReactions} />
                    </Suspense>
                    <div className="flex gap-2 mt-4">
                      {['glycolysis', 'tca', 'overflow'].map(p => (
                        <button key={p} onClick={() => setSelectedPathway(p)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium capitalize border transition-all ${
                            selectedPathway === p
                              ? 'bg-[var(--primary)] text-white'
                              : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--card-border)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
                          }`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="paper-container">
                    <div className="section-header">
                      <h3 className="section-title">Reaction Details</h3>
                    </div>
                    <Suspense fallback={<LoadingFallback />}>
                      {selectedReaction ? (
                        <ReactionDetail reaction={reactions[selectedReaction]} genes={genes} blocked={result?.blocked} />
                      ) : (
                        <p className="text-[var(--text-secondary)] text-center py-8 italic">Select a reaction in the network</p>
                      )}
                    </Suspense>
                  </div>
                </div>
                {comparisonResults.length > 1 && (
                  <div className="paper-container">
                    <div className="section-header">
                      <h3 className="section-title">Comparative Analysis</h3>
                    </div>
                    <Suspense fallback={<LoadingFallback />}>
                      <ComparativeAnalysis results={comparisonResults} />
                    </Suspense>
                  </div>
                )}
              </div>
            )}
            
            {tab === 'knockout' && (
              <div className="space-y-4">
                <div className="section-header">
                  <h2 className="section-title">Gene Knockout Experiments</h2>
                </div>
                <p className="text-[var(--text-secondary)] text-sm">Select genes to knockout. Observe how GPR logic affects metabolic phenotypes.</p>
                <div className="flex flex-wrap gap-2">
                  {['all', 'essential', 'knockout', ...subsystems.slice(0, 6)].map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                        filter === f
                          ? 'bg-[var(--primary)] text-white'
                          : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--card-border)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
                      }`}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-96 overflow-y-auto scrollbar-thin bg-[var(--card-bg)] border border-[var(--card-border)] rounded p-2">
                  {filteredGenes.map(([id, g]) => {
                    const isKO = knockouts.includes(id);
                    return (
                      <button key={id} onClick={() => toggleKO(id)}
                        className={`p-2.5 rounded-lg text-left border transition-all ${
                          isKO 
                            ? 'bg-[var(--danger-bg)] border-[var(--danger)] hover:bg-[var(--danger-bg)]' 
                            : 'bg-[var(--card-bg)] border-[var(--card-border)] hover:border-[var(--primary)]'
                        }`}>
                        <div className="flex items-center justify-between">
                          <span className={`font-mono text-xs ${isKO ? 'text-[var(--danger-text)]' : 'text-[var(--primary)]'}`}>{id}</span>
                          {g.essential && <span className="text-[var(--warning)] text-xs font-semibold" title="Essential gene">⚠</span>}
                        </div>
                        <p className="text-[var(--text-secondary)] text-xs truncate mt-0.5">{g.product}</p>
                      </button>
                    );
                  })}
                </div>
                {knockouts.length > 0 && (
                  <button onClick={() => setKnockouts([])} className="w-full py-2.5 bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-lg text-sm font-medium transition-colors border border-[var(--border-color)]">
                    Clear All ({knockouts.length} gene{knockouts.length > 1 ? 's' : ''})
                  </button>
                )}
              </div>
            )}
            
            {tab === 'explore' && (
              <div className="space-y-4">
                <div className="section-header flex items-center justify-between">
                  <h2 className="section-title">Model Explorer</h2>
                  <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-primary)] px-2 py-1 rounded">
                    {currentModel.name}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { l: 'Genes', v: modelStats.genes },
                    { l: 'Reactions', v: modelStats.reactions },
                    { l: 'Subsystems', v: subsystems.length },
                    { l: 'Network Nodes', v: modelStats.nodes }
                  ].map(s => (
                    <div key={s.l} className="p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded shadow-sm">
                      <p className="text-[var(--text-secondary)] text-xs font-medium uppercase tracking-wide">{s.l}</p>
                      <p className="text-xl font-bold text-[var(--text-primary)] font-mono">{s.v}</p>
                    </div>
                  ))}
                </div>
                <div className="max-h-80 overflow-y-auto scrollbar-thin space-y-2 bg-[var(--card-bg)] border border-[var(--card-border)] rounded p-2">
                  {Object.entries(reactions).map(([id, r]) => (
                    <button key={id} onClick={() => setSelectedReaction(id)}
                      className={`w-full p-2.5 rounded-lg text-left border transition-all ${
                        selectedReaction === id
                          ? 'bg-[var(--info-bg)] border-[var(--info)]'
                          : 'hover:bg-[var(--bg-primary)] border-[var(--card-border)]'
                      }`}>
                      <div className="flex justify-between">
                        <span className="font-mono text-xs text-[var(--primary)] font-medium">{id}</span>
                        <span className="text-xs text-[var(--text-secondary)]">{r.subsystem}</span>
                      </div>
                      <p className="text-[var(--text-primary)] text-sm">{r.name}</p>
                      {r.gpr && <p className="text-[var(--success-text)] text-xs font-mono mt-1">GPR: {r.gpr}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === 'share' && (
              <div className="space-y-6">
                {/* Model Size Analysis Warning */}
                {modelAnalysis && modelAnalysis.recommendations.length > 0 && (
                  <div className="paper-container">
                    <div className="section-header">
                      <h3 className="section-title">Model Analysis</h3>
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                        modelAnalysis.sizeCategory === 'genome-scale'
                          ? 'bg-[var(--danger-bg)] text-[var(--danger-text)] border border-[var(--danger)]'
                          : modelAnalysis.sizeCategory === 'large'
                          ? 'bg-[var(--warning-bg)] text-[var(--warning-text)] border border-[var(--warning)]'
                          : 'bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success)]'
                      }`}>
                        {modelAnalysis.sizeCategory.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded">
                        <p className="text-xs text-[var(--text-secondary)]">Reactions</p>
                        <p className="text-lg font-bold font-mono">{modelAnalysis.numReactions}</p>
                      </div>
                      <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded">
                        <p className="text-xs text-[var(--text-secondary)]">Metabolites</p>
                        <p className="text-lg font-bold font-mono">{modelAnalysis.numMetabolites}</p>
                      </div>
                      <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded">
                        <p className="text-xs text-[var(--text-secondary)]">Est. FVA Time</p>
                        <p className="text-sm font-mono">{modelAnalysis.estimatedFvaTime}</p>
                      </div>
                      <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded">
                        <p className="text-xs text-[var(--text-secondary)]">Memory</p>
                        <p className="text-sm font-mono">{modelAnalysis.memoryEstimate}</p>
                      </div>
                    </div>
                    {modelAnalysis.recommendations.map((rec, i) => (
                      <div key={i} className={`p-3 rounded mb-2 ${
                        rec.type === 'critical'
                          ? 'bg-[var(--danger-bg)] border-l-4 border-[var(--danger)]'
                          : rec.type === 'warning'
                          ? 'bg-[var(--warning-bg)] border-l-4 border-[var(--warning)]'
                          : 'bg-[var(--info-bg)] border-l-4 border-[var(--info)]'
                      }`}>
                        <p className="text-sm text-[var(--text-primary)]">{rec.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* State Sharing Component */}
                <Suspense fallback={<LoadingFallback />}>
                  <StateSharing
                    model={currentModel}
                    constraints={constraints}
                    knockouts={knockouts}
                    simulation={result}
                  />
                </Suspense>
              </div>
            )}

            {tab === 'achievements' && (
              <div className="paper-container space-y-6 h-fit">
                <LearningPath modules={modules} />
                <div className="mt-6 pt-6 border-t border-[var(--border-color)]">
                  <h3 className="section-title mb-4">Achievements & Badges</h3>
                  <BadgesPanel />
                </div>
              </div>
            )}
          </div>

          <div className="xl:col-span-1 space-y-6 h-fit">
            <div className="space-y-6 h-fit">
              <div className="paper-container">
                <div className="section-header">
                  <h3 className="section-title">Flux Comparison</h3>
                </div>
                <Suspense fallback={<LoadingFallback />}>
                  <FluxComparison wildType={wildTypeResult} mutant={result} />
                </Suspense>
              </div>
              <div className="paper-container">
                <div className="section-header">
                  <h3 className="section-title">Flux Distribution Heatmap</h3>
                </div>
                <Suspense fallback={<LoadingFallback />}>
                  <FluxHeatmap fluxes={result?.fluxes} reactions={reactions} />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
        
        <footer className="mt-8 py-4 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] text-center text-[var(--text-secondary)] text-sm">
          <p>Enhanced Constraint-Based Metabolic Modeling Platform</p>
          <p className="text-xs">Based on E. coli iML1515 model • Designed for Academic Research</p>
        </footer>
      </div>
      
      {module && !showQuiz && (
        <div className="fixed inset-0 bg-[var(--bg-primary)]/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setModule(null)}>
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] shadow-2xl max-w-3xl w-full animate-fadeIn max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] sticky top-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{module.icon}</span>
                  <div>
                    <h2 className="text-xl font-semibold text-[var(--text-primary)]">{module.title}</h2>
                    <p className="text-[var(--text-secondary)] text-sm">{module.difficulty} • {module.duration} • 100 XP</p>
                  </div>
                </div>
                <button onClick={() => setModule(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl p-2">✕</button>
              </div>
            </div>
            <div className="p-6">
              <div className="math-block mb-6">
                <pre className="text-[var(--text-primary)] text-sm whitespace-pre-wrap font-serif">{module.content}</pre>
              </div>
              <div className="p-5 bg-[var(--bg-primary)] border-l-4 border-[var(--primary)] rounded">
                <p className="text-[var(--text-primary)] text-sm font-medium mb-3">Key Learning Points:</p>
                <ul className="space-y-2">
                  {module.keyPoints.map((pt, i) => (
                    <li key={i} className="flex items-start gap-2 text-[var(--text-primary)] text-sm">
                      <span className="text-[var(--primary)] font-bold mt-0.5">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {module.quiz && (
                <button onClick={startQuiz} className="w-full mt-6 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded font-medium transition-colors">
                  Take Quiz
                </button>
              )}
            </div>
            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] flex justify-end sticky bottom-0">
              <button onClick={handleModuleComplete} className="px-6 py-2.5 bg-[var(--success)] hover:bg-[var(--success-hover)] text-white rounded font-medium transition-colors">
                Mark as Complete ✓
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showQuiz && selectedModuleForQuiz?.quiz && (
        <div className="fixed inset-0 bg-[var(--bg-primary)]/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--card-border)] shadow-2xl max-w-2xl w-full p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-6 border-b border-[var(--border-color)] pb-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Knowledge Check: {selectedModuleForQuiz.title}</h2>
              <button onClick={() => setShowQuiz(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-2xl p-2">✕</button>
            </div>
            <QuizModule moduleId={selectedModuleForQuiz.id} quiz={selectedModuleForQuiz.quiz} onPass={handleQuizPass} />
          </div>
        </div>
      )}

      {/* Escher Map Import Modal */}
      {showEscherImport && (
        <Suspense fallback={<LoadingFallback />}>
          <EscherImport
            onMapImport={handleEscherMapImport}
            onClose={() => setShowEscherImport(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

export default function EnhancedLearningPlatformWrapper() {
  return (
    <ProgressProvider>
      <EnhancedLearningPlatform />
    </ProgressProvider>
  );
}
