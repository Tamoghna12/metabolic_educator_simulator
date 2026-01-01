import React, { useState } from 'react';
import { BookOpen, Activity, Home, ArrowRight, Github, FileText, GraduationCap, Sun, Moon, Eye, FlaskConical } from 'lucide-react';
import MetabolicModelingPlatform from './components/MetabolicModelingPlatform';
import DocumentationViewer from './components/DocumentationViewer';
import BenchmarkValidation from './components/BenchmarkValidation';
import { useTheme } from './contexts/ThemeContext';

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const { theme, toggleTheme, isLight, colorBlindMode, toggleColorBlindMode } = useTheme();

  const renderView = () => {
    switch (currentView) {
      case 'learning':
      case 'learning-enhanced':
        return <MetabolicModelingPlatform />;
      case 'documentation':
        return <DocumentationViewer />;
      case 'benchmark':
        return <BenchmarkValidation />;
      default: return <LandingPage onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen font-sans selection:bg-[var(--info-bg)] selection:text-[var(--info-text)] bg-[var(--bg-primary)] transition-colors duration-300">
      <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-200 border-b border-[var(--border-color)] shadow-sm bg-[var(--bg-secondary)]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => setCurrentView('home')}
          >
            <div className="w-8 h-8 rounded bg-[var(--primary)] flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-[var(--text-primary)]">
              Metabolic<span className="text-[var(--primary)]">Suite</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            {currentView !== 'home' && (
              <button 
                onClick={() => setCurrentView('home')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>
            )}
            <button
              onClick={toggleColorBlindMode}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                colorBlindMode 
                  ? 'bg-[var(--info-bg)] text-[var(--info-text)] border-[var(--info)]' 
                  : 'text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]'
              }`}
              aria-label={`Toggle color blind mode ${colorBlindMode ? 'off' : 'on'}`}
              title="Toggle Color Blind Mode"
            >
              <Eye className="w-4 h-4" />
              <span className="sr-only">Color Blind Mode</span>
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
              aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
              title={`Switch to ${isLight ? 'dark' : 'light'} mode`}
            >
              {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <span className="sr-only">Toggle theme</span>
            </button>
            <a href="#" className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </nav>

      <div className={`relative z-10 ${currentView !== 'home' ? 'pt-16' : ''}`}>
        {renderView()}
      </div>
    </div>
  );
}

function LandingPage({ onNavigate }) {
  const { isLight } = useTheme();

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 w-full py-16">
        <div className="text-center max-w-4xl mx-auto mb-16 pt-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--info-bg)] border border-[var(--info)] text-[var(--info-text)] text-sm font-semibold mb-8">
            <GraduationCap className="w-4 h-4" />
            Educational Platform for Systems Biology
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-[var(--text-primary)] mb-6 font-serif">
            Constraint-Based Metabolic Modeling
          </h1>
          
          <p className="text-xl text-[var(--text-secondary)] leading-relaxed mb-10 max-w-3xl mx-auto font-light">
            An interactive learning environment for Flux Balance Analysis, genome-scale metabolic models, 
            and systems biology research methods.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => onNavigate('learning-enhanced')}
              className="btn-primary flex items-center gap-2 text-lg px-8 py-3"
            >
              <GraduationCap className="w-5 h-5" />
              Start Learning
            </button>
            <button
              onClick={() => onNavigate('documentation')}
              className="btn-secondary flex items-center gap-2 text-lg px-8 py-3"
            >
              <FileText className="w-5 h-5" />
              Documentation
            </button>
            <button
              onClick={() => onNavigate('benchmark')}
              className="btn-secondary flex items-center gap-2 text-lg px-8 py-3"
            >
              <FlaskConical className="w-5 h-5" />
              Solver Validation
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          <ToolCard
            title="Learning Platform"
            desc="Master fundamentals of metabolic engineering through interactive modules covering stoichiometry, thermodynamics, and cellular economics."
            icon={<BookOpen className="w-6 h-6 text-[var(--primary)]" />}
            onClick={() => onNavigate('learning')}
            delay="0ms"
            actionLabel="Begin Course"
          />
          <ToolCard
            title="Enhanced Platform"
            desc="Advanced simulation tools including FVA, pFBA, MOMA, interactive quizzes, progress tracking, and network visualizations."
            icon={<Activity className="w-6 h-6 text-[var(--primary)]" />}
            onClick={() => onNavigate('learning-enhanced')}
            delay="100ms"
            actionLabel="Launch Enhanced"
            featured={true}
          />
        </div>

        <section className="mt-16 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6 font-serif">Academic Features</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              title="Research-Grade Tools"
              description="Implement standard methods including FBA, FVA, pFBA, and MOMA used in published research."
              icon="📊"
            />
            <FeatureCard
              title="Interactive Learning"
              description="Hands-on tutorials with quizzes, progress tracking, and immediate feedback on concepts."
              icon="🎓"
            />
            <FeatureCard
              title="Publication Quality"
              description="Generate visualizations suitable for academic presentations and journal figures."
              icon="📄"
            />
          </div>
        </section>

        <section className="mt-16 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6 font-serif">Key Concepts</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <ConceptCard
              title="Flux Balance Analysis (FBA)"
              description="Linear programming-based approach to predict metabolic flux distributions under steady-state assumptions."
              reference="Orth et al., Nat Biotechnol 2010"
            />
            <ConceptCard
              title="Gene-Protein-Reaction (GPR)"
              description="Boolean logic rules relating genes to enzymes and metabolic reactions."
              reference="Thiele & Palsson, Nat Protoc 2010"
            />
            <ConceptCard
              title="Flux Variability Analysis (FVA)"
              description="Identifies range of possible flux values for each reaction."
              reference="Mahadevan & Schilling, Metab Eng 2003"
            />
            <ConceptCard
              title="Parsimonious FBA (pFBA)"
              description="Finds the most efficient flux distribution by minimizing total enzyme use."
              reference="Lewis et al., Mol Syst Biol 2010"
            />
          </div>
        </section>

        <footer className="mt-16 py-8 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] text-center text-[var(--text-secondary)] text-sm">
          <p className="mb-2">Metabolic Modeling Educational Platform • Systems Biology Research Tool</p>
          <p className="text-xs">Based on E. coli iML1515 model • Designed for Academic Use</p>
        </footer>
      </div>
    </div>
  );
}

function ToolCard({ title, desc, icon, onClick, delay, actionLabel, featured = false }) {
  const { isLight } = useTheme();

  return (
    <button 
      onClick={onClick}
      className={`group relative text-left h-full bg-[var(--card-bg)] border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg ${
        featured ? 'border-2 border-[var(--primary)]' : 'border border-[var(--card-border)]'
      }`}
      style={{ animationDelay: delay }}
    >
      {featured && (
        <div className="absolute top-0 right-0 px-3 py-1 bg-[var(--primary)] text-white text-xs font-semibold rounded-bl">
          Enhanced
        </div>
      )}
      <div className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded bg-[var(--bg-primary)] flex items-center justify-center border border-[var(--border-color)]">
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
              {title}
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {featured ? 'Includes all features' : 'Core functionality'}
            </p>
          </div>
        </div>
        <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
          {desc}
        </p>
        <div className="flex items-center text-sm font-semibold text-[var(--primary)] group-hover:text-[var(--primary-hover)] transition-colors">
          {actionLabel} <ArrowRight className="w-4 h-4 ml-2" />
        </div>
      </div>
    </button>
  );
}

function FeatureCard({ title, description, icon }) {
  const { isLight } = useTheme();

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="text-3xl">{icon}</div>
        <div>
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ConceptCard({ title, description, reference }) {
  const { isLight } = useTheme();

  return (
    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-6 shadow-sm">
      <h3 className="font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-[var(--text-secondary)] text-sm leading-relaxed mb-3">{description}</p>
      <p className="text-xs text-[var(--primary)] font-medium citation">
        Reference: {reference}
      </p>
    </div>
  );
}
