import React, { useState, useEffect, createContext, useContext } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ProgressContext = createContext(undefined);

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};

export const ProgressProvider = ({ children }) => {
  const [progress, setProgress] = useState(() => {
    const saved = localStorage.getItem('metabolic_progress');
    return saved ? JSON.parse(saved) : {
      completedModules: [],
      quizScores: {},
      challengesCompleted: [],
      totalXP: 0,
      level: 1,
      badges: [],
      startDate: Date.now()
    };
  });

  useEffect(() => {
    localStorage.setItem('metabolic_progress', JSON.stringify(progress));
  }, [progress]);

  const completeModule = (moduleId) => {
    setProgress(prev => {
      if (prev.completedModules.includes(moduleId)) return prev;
      const newXP = prev.totalXP + 100;
      return {
        ...prev,
        completedModules: [...prev.completedModules, moduleId],
        totalXP: newXP,
        level: Math.floor(newXP / 500) + 1
      };
    });
  };

  const recordQuizScore = (quizId, score) => {
    setProgress(prev => ({
      ...prev,
      quizScores: { ...prev.quizScores, [quizId]: Math.max(prev.quizScores[quizId] || 0, score) },
      totalXP: prev.totalXP + Math.floor(score * 10)
    }));
  };

  const completeChallenge = (challengeId) => {
    setProgress(prev => {
      if (prev.challengesCompleted.includes(challengeId)) return prev;
      return {
        ...prev,
        challengesCompleted: [...prev.challengesCompleted, challengeId],
        totalXP: prev.totalXP + 150
      };
    });
  };

  const earnBadge = (badge) => {
    setProgress(prev => {
      if (prev.badges.includes(badge.id)) return prev;
      return {
        ...prev,
        badges: [...prev.badges, badge.id],
        totalXP: prev.totalXP + (badge.xp || 200)
      };
    });
  };

  const resetProgress = () => {
    localStorage.removeItem('metabolic_progress');
    setProgress({
      completedModules: [],
      quizScores: {},
      challengesCompleted: [],
      totalXP: 0,
      level: 1,
      badges: [],
      startDate: Date.now()
    });
  };

  const value = { progress, completeModule, recordQuizScore, completeChallenge, earnBadge, resetProgress };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
};

const Badge = ({ earned, icon, name, description }) => {
  return (
    <div className={`p-4 rounded-lg border transition-all ${earned ? 'bg-[var(--success)] border-[var(--success)]' : 'bg-[var(--bg-primary)] border-[var(--border-color)] opacity-60'}`}>
      <div className="text-2xl mb-2">{earned ? icon : '🔒'}</div>
      <p className="font-medium text-sm text-[var(--text-primary)]">{name}</p>
      <p className="text-xs text-[var(--text-secondary)] mt-1">{description}</p>
    </div>
  );
};

const BadgesPanel = () => {
  const { progress } = useProgress();
  const badges = [
    { id: 'first_fba', icon: '🎯', name: 'First Simulation', description: 'Complete first FBA simulation', xp: 100 },
    { id: 'knockout_master', icon: '✂️', name: 'Knockout Master', description: 'Complete 5 gene knockouts', xp: 150 },
    { id: 'fva_explorer', icon: '📊', name: 'FVA Explorer', description: 'Run Flux Variability Analysis', xp: 200 },
    { id: 'pioneer', icon: '🎓', name: 'Pioneer', description: 'Complete all learning modules', xp: 300 },
    { id: 'challenge_champion', icon: '🏆', name: 'Challenge Champion', description: 'Complete all challenges', xp: 250 },
    { id: 'efficiency_expert', icon: '⚡', name: 'Efficiency Expert', description: 'Achieve >50% yield', xp: 200 }
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-[var(--text-primary)] uppercase tracking-wide">Achievements & Badges</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {badges.map(badge => (
          <Badge key={badge.id} {...badge} earned={progress.badges.includes(badge.id)} />
        ))}
      </div>
    </div>
  );
};

const XPBar = () => {
  const { progress } = useProgress();
  const xpInLevel = progress.totalXP % 500;
  const progressPercent = (xpInLevel / 500) * 100;

  return (
    <div className="flex items-center gap-3 p-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg shadow-sm">
      <div className="text-xl">🎓</div>
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-[var(--text-secondary)] font-medium">Level {progress.level}</span>
          <span className="text-[var(--primary)] font-semibold">{progress.totalXP} XP</span>
        </div>
        <div className="h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
          <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
    </div>
  );
};

const Quiz = ({ quizId, questions, onComplete, onRetry }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const { recordQuizScore } = useProgress();

  const handleAnswer = (optionIndex) => {
    setAnswers(prev => ({ ...prev, [currentQuestion]: optionIndex }));
    if (currentQuestion < questions.length - 1) {
      setTimeout(() => setCurrentQuestion(prev => prev + 1), 300);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correct) correct++;
    });
    return Math.round((correct / questions.length) * 100);
  };

  if (showResults) {
    const score = calculateScore();
    return (
      <div className="space-y-4">
        <div className={`p-6 rounded-lg text-center ${
          score >= 70 
            ? 'bg-[var(--success)] border border-[var(--success)]' 
            : 'bg-[var(--warning)] border border-[var(--warning)]'
        }`}>
          <div className="text-4xl mb-2">{score >= 70 ? '✓' : '📝'}</div>
          <p className="text-2xl font-bold text-[var(--text-primary)] mb-1">{score}%</p>
          <p className="text-sm text-[var(--text-secondary)]">
            {score >= 70 ? 'Excellent! You have mastered this concept.' : 'Review the material and try again.'}
          </p>
        </div>
        <button onClick={onComplete} className="w-full py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded font-medium transition-colors">
          Continue
        </button>
        {onRetry && (
          <button onClick={() => { setCurrentQuestion(0); setAnswers({}); setShowResults(false); onRetry(); }}
            className="w-full py-2.5 bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded font-medium transition-colors border border-[var(--border-color)]"
          >
            Retry Quiz
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded p-2">
        <span className="font-medium text-[var(--text-primary)]">Question {currentQuestion + 1} of {questions.length}</span>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${
              i === currentQuestion ? 'bg-[var(--primary)]' : answers[i] !== undefined ? 'bg-[var(--success)]' : 'bg-[var(--text-secondary)]'
            }`} />
          ))}
        </div>
      </div>
      
      <div className="p-5 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
        <p className="text-[var(--text-primary)] font-medium mb-4 text-base">{questions[currentQuestion].question}</p>
        <div className="space-y-2">
          {questions[currentQuestion].options.map((option, i) => (
            <button key={i} onClick={() => handleAnswer(i)}
              className={`w-full p-3 rounded text-left border transition-all ${
                answers[currentQuestion] === i 
                  ? 'bg-[var(--primary)] border-[var(--primary)]' 
                  : 'bg-[var(--bg-primary)] border-[var(--border-color)] hover:border-[var(--primary)] hover:bg-[var(--bg-primary)]'
              }`}>
              <span className="text-[var(--text-secondary)] font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
              <span className="text-[var(--text-primary)]">{option}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const TutorialTooltip = ({ children, content, position = 'top' }) => {
  const [visible, setVisible] = useState(() => {
    return localStorage.getItem(`tooltip_dismissed_${content.slice(0, 20)}`) !== 'true';
  });

  if (!visible) return children;

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(`tooltip_dismissed_${content.slice(0, 20)}`, 'true');
  };

  return (
    <div className="relative inline-block">
      {children}
      {visible && (
        <div className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 -translate-x-1/2 w-72 z-50`}>
          <div className="p-4 bg-[var(--info)] border-l-4 border-[var(--info)] rounded shadow-lg">
            <p className="text-sm text-[var(--text-primary)] mb-3 leading-relaxed">{content}</p>
            <div className="flex gap-2">
              <button onClick={handleDismiss} className="text-xs bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white px-3 py-1 rounded font-medium transition-colors">
                Got it!
              </button>
            </div>
          </div>
          <div className={`absolute ${position === 'top' ? 'top-full' : 'bottom-full'} left-1/2 -translate-x-1/2 border-8 border-transparent ${position === 'top' ? 'border-t-[var(--info)]' : 'border-b-[var(--info)]'}`} />
        </div>
      )}
      <button 
        onClick={() => setVisible(!visible)}
        className="absolute -top-1 -right-1 w-6 h-6 bg-[var(--info)] hover:bg-[var(--info-hover)] text-white rounded-full text-xs flex items-center justify-center font-medium shadow-sm transition-colors"
      >
        ?
      </button>
    </div>
  );
};

const LearningPath = ({ modules }) => {
  const { progress } = useProgress();

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-[var(--text-primary)] uppercase tracking-wide">Learning Progress</h4>
      <div className="relative">
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-[var(--border-color)]" />
        {modules.map((module, i) => {
          const isCompleted = progress.completedModules.includes(module.id);
          const isLocked = i > 0 && !progress.completedModules.includes(modules[i - 1].id);
          
          return (
            <div key={module.id} className="relative flex items-start gap-4 pb-8">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 shadow-sm ${
                isCompleted 
                  ? 'bg-[var(--success)] border-[var(--success)] text-white' 
                  : isLocked 
                    ? 'bg-[var(--text-secondary)] border-[var(--border-color)] text-[var(--text-muted)]' 
                    : 'bg-[var(--info)] border-[var(--info)] text-white'
              }`}>
                {isCompleted ? '✓' : isLocked ? '🔒' : i + 1}
              </div>
              <div className={`flex-1 p-4 rounded-lg border ${
                isCompleted 
                  ? 'bg-[var(--success)] border-[var(--success)]' 
                  : isLocked 
                    ? 'bg-[var(--bg-primary)] border-[var(--border-color)] opacity-60' 
                    : 'bg-[var(--card-bg)] border-[var(--card-border)]'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{module.icon}</span>
                  <span className="font-medium text-[var(--text-primary)]">{module.title}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">{module.difficulty} • {module.duration} • 100 XP</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const QuizModule = ({ moduleId, quiz, onPass }) => {
  const { progress } = useProgress();

  if (progress.quizScores[moduleId] >= 70) {
    return (
      <div className="p-6 bg-[var(--success)] border border-[var(--success)] rounded-lg text-center">
        <div className="text-4xl mb-2">✅</div>
        <p className="text-[var(--success)] font-semibold text-lg">Quiz Completed</p>
        <p className="text-sm text-[var(--text-secondary)]">Your Score: <span className="font-bold text-[var(--success)]">{progress.quizScores[moduleId]}%</span></p>
      </div>
    );
  }

  return <Quiz quizId={moduleId} questions={quiz} onComplete={() => recordQuizScore(moduleId, onPass?.(progress.quizScores[moduleId]))} />;
};

export { XPBar, BadgesPanel, Quiz, TutorialTooltip, LearningPath, QuizModule };
