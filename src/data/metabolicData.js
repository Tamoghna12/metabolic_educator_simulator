export const modules = [
  {
    id: 'intro', title: 'Introduction to CBM', icon: '📚', difficulty: 'Beginner', duration: '15 min',
    content: `Constraint-based modeling predicts metabolic behavior using:\n\n• Stoichiometry - Balanced reaction equations\n• Thermodynamics - Reaction reversibility\n• Capacity - Maximum enzyme rates\n\nKey equation: S · v = 0 (steady state)`,
    keyPoints: ['No kinetics needed', 'Genome-scale applicable', 'Assumes optimality'],
    quiz: [
      { question: 'What is key assumption of FBA?', options: ['Steady State', 'Rapid Equilibrium', 'Chaos Theory'], correct: 0 },
      { question: 'What data is NOT required for CBM?', options: ['Stoichiometry', 'Kinetic Parameters (Km, Vmax)', 'Gene-Protein associations'], correct: 1 }
    ]
  },
  {
    id: 'fba', title: 'Flux Balance Analysis', icon: '⚖️', difficulty: 'Intermediate', duration: '20 min',
    content: `FBA solves:\n\nmax c^T · v\ns.t. S · v = 0\n    lb ≤ v ≤ ub\n\nObjective: Usually biomass (growth)\nResult: Optimal flux distribution`,
    keyPoints: ['Linear programming', 'Predicts growth rate', 'Identifies essential reactions'],
    quiz: [
      { question: 'What mathematical method does FBA use?', options: ['Differential Equations', 'Linear Programming', 'Monte Carlo'], correct: 1 },
      { question: 'What represents the biological goal?', options: ['Constraint Vector', 'Objective Function', 'Stoichiometric Matrix'], correct: 1 }
    ]
  },
  {
    id: 'gpr', title: 'Gene-Protein-Reaction', icon: '🧬', difficulty: 'Intermediate', duration: '25 min',
    content: `GPR Boolean logic:\n\nOR = Isozymes (redundancy)\n  pfkA OR pfkB\n\nAND = Complex (all required)\n  atpA AND atpB AND atpD\n\nSynthetic lethality: Two non-essential genes that are lethal together`,
    keyPoints: ['Predicts knockout phenotypes', 'Identifies drug targets', 'Reveals redundancy'],
    quiz: [
      { question: 'If genes are connected by OR, they are:', options: ['Subunits of a complex', 'Isozymes', 'Unrelated'], correct: 1 },
      { question: 'Deleting one gene in an AND relationship causes:', options: ['No effect', 'Reaction Blockage', 'Increased Flux'], correct: 1 }
    ]
  },
  {
    id: 'fva', title: 'Flux Variability Analysis', icon: '📊', difficulty: 'Advanced', duration: '20 min',
    content: `FVA finds min/max of each flux while maintaining optimality:\n\nFor each reaction i:\n  min v_i, max v_i\n  s.t. S·v=0, c^T·v ≥ γZ*\n\nReveals flexibility and essential reactions.`,
    keyPoints: ['Identifies blocked reactions', 'Shows flux flexibility', 'Guides experiments'],
    quiz: [
      { question: 'What does FVA reveal?', options: ['Single optimal solution', 'Range of possible fluxes', 'Gene expression levels'], correct: 1 }
    ]
  },
  {
    id: 'pfba', title: 'Parsimonious FBA', icon: '🎯', difficulty: 'Advanced', duration: '20 min',
    content: `pFBA minimizes total flux while maintaining optimal growth:\n\nmin Σ |v_i|\ns.t. S·v = 0\n    c^T·v = Z*\n    lb ≤ v ≤ ub\n\nPrinciple: Cells use minimal enzyme machinery.`,
    keyPoints: ['Alternative optimal solutions', 'Biologically realistic', 'Flux efficiency measure'],
    quiz: [
      { question: 'What does pFBA minimize?', options: ['Growth rate', 'Total flux magnitude', 'ATP production'], correct: 1 }
    ]
  },
  {
    id: 'moma', title: 'MOMA Analysis', icon: '🔄', difficulty: 'Advanced', duration: '25 min',
    content: `MOMA (Minimization of Metabolic Adjustment):\n\nPredicts knockout phenotypes by finding fluxes closest to wild-type:\n\nmin ||v^WT - v^KO||²\n\nUnlike FBA, MOMA doesn't assume optimal growth after knockout.`,
    keyPoints: ['Knockout predictions', 'No optimality assumption', 'Experimental match'],
    quiz: [
      { question: 'MOMA finds fluxes that are:', options: ['Maximally optimal', 'Closest to wild-type', 'Randomly distributed'], correct: 1 }
    ]
  },
];

export const genes = {
  ptsG: { product: 'PTS glucose EIICB', essential: false, subsystem: 'Transport' },
  pgi: { product: 'Phosphoglucose isomerase', essential: false, subsystem: 'Glycolysis' },
  pfkA: { product: 'Phosphofructokinase I', essential: false, subsystem: 'Glycolysis' },
  pfkB: { product: 'Phosphofructokinase II', essential: false, subsystem: 'Glycolysis' },
  fbaA: { product: 'Aldolase class II', essential: false, subsystem: 'Glycolysis' },
  fbaB: { product: 'Aldolase class I', essential: false, subsystem: 'Glycolysis' },
  tpiA: { product: 'Triose-phosphate isomerase', essential: true, subsystem: 'Glycolysis' },
  gapA: { product: 'G3P dehydrogenase', essential: true, subsystem: 'Glycolysis' },
  pgk: { product: 'Phosphoglycerate kinase', essential: true, subsystem: 'Glycolysis' },
  eno: { product: 'Enolase', essential: true, subsystem: 'Glycolysis' },
  pykF: { product: 'Pyruvate kinase I', essential: false, subsystem: 'Glycolysis' },
  pykA: { product: 'Pyruvate kinase II', essential: false, subsystem: 'Glycolysis' },
  aceE: { product: 'PDH E1 component', essential: false, subsystem: 'Pyruvate' },
  aceF: { product: 'PDH E2 component', essential: false, subsystem: 'Pyruvate' },
  lpd: { product: 'Lipoamide dehydrogenase', essential: false, subsystem: 'Pyruvate' },
  gltA: { product: 'Citrate synthase', essential: false, subsystem: 'TCA' },
  acnA: { product: 'Aconitase A', essential: false, subsystem: 'TCA' },
  acnB: { product: 'Aconitase B', essential: false, subsystem: 'TCA' },
  icd: { product: 'Isocitrate dehydrogenase', essential: false, subsystem: 'TCA' },
  sucA: { product: 'α-KG dehydrogenase E1', essential: false, subsystem: 'TCA' },
  sucB: { product: 'α-KG dehydrogenase E2', essential: false, subsystem: 'TCA' },
  mdh: { product: 'Malate dehydrogenase', essential: false, subsystem: 'TCA' },
  atpA: { product: 'ATP synthase F1 α', essential: true, subsystem: 'OxPhos' },
  atpB: { product: 'ATP synthase F0 a', essential: true, subsystem: 'OxPhos' },
  atpD: { product: 'ATP synthase F1 β', essential: true, subsystem: 'OxPhos' },
  ackA: { product: 'Acetate kinase', essential: false, subsystem: 'Overflow' },
  pta: { product: 'Phosphotransacetylase', essential: false, subsystem: 'Overflow' },
  ldhA: { product: 'Lactate dehydrogenase', essential: false, subsystem: 'Fermentation' },
  adhE: { product: 'Alcohol dehydrogenase', essential: false, subsystem: 'Fermentation' },
  zwf: { product: 'G6P dehydrogenase', essential: false, subsystem: 'PPP' },
  ppc: { product: 'PEP carboxylase', essential: false, subsystem: 'Anaplerotic' },
};

export const reactions = {
  EX_glc: { name: 'Glucose exchange', equation: 'glc[e] ↔', subsystem: 'Exchange', genes: [], gpr: '' },
  EX_o2: { name: 'Oxygen exchange', equation: 'o2[e] ↔', subsystem: 'Exchange', genes: [], gpr: '' },
  GLCpts: { name: 'Glucose PTS', equation: 'glc[e] + pep → g6p + pyr', subsystem: 'Transport', genes: ['ptsG'], gpr: 'ptsG' },
  PGI: { name: 'Phosphoglucose isomerase', equation: 'g6p ↔ f6p', subsystem: 'Glycolysis', genes: ['pgi'], gpr: 'pgi' },
  PFK: { name: 'Phosphofructokinase', equation: 'f6p + atp → fbp + adp', subsystem: 'Glycolysis', genes: ['pfkA', 'pfkB'], gpr: 'pfkA OR pfkB' },
  FBA: { name: 'Aldolase', equation: 'fbp ↔ dhap + g3p', subsystem: 'Glycolysis', genes: ['fbaA', 'fbaB'], gpr: 'fbaA OR fbaB' },
  GAPD: { name: 'G3P dehydrogenase', equation: 'g3p + nad ↔ 13dpg + nadh', subsystem: 'Glycolysis', genes: ['gapA'], gpr: 'gapA' },
  PYK: { name: 'Pyruvate kinase', equation: 'pep + adp → pyr + atp', subsystem: 'Glycolysis', genes: ['pykF', 'pykA'], gpr: 'pykF OR pykA' },
  PDH: { name: 'Pyruvate dehydrogenase', equation: 'pyr + coa + nad → accoa + co2 + nadh', subsystem: 'Pyruvate', genes: ['aceE', 'aceF', 'lpd'], gpr: '(aceE AND aceF) AND lpd' },
  CS: { name: 'Citrate synthase', equation: 'accoa + oaa → cit', subsystem: 'TCA', genes: ['gltA'], gpr: 'gltA' },
  AKGDH: { name: 'α-KG dehydrogenase', equation: 'akg + nad → succoa + nadh', subsystem: 'TCA', genes: ['sucA', 'sucB', 'lpd'], gpr: '(sucA AND sucB) AND lpd' },
  ATPS4r: { name: 'ATP synthase', equation: 'adp + pi + h[p] → atp', subsystem: 'OxPhos', genes: ['atpA', 'atpB', 'atpD'], gpr: 'atpA AND atpB AND atpD' },
  ACKr: { name: 'Acetate kinase', equation: 'actp + adp ↔ ac + atp', subsystem: 'Overflow', genes: ['ackA'], gpr: 'ackA' },
  LDH: { name: 'Lactate dehydrogenase', equation: 'pyr + nadh → lac + nad', subsystem: 'Fermentation', genes: ['ldhA'], gpr: 'ldhA' },
  BIOMASS: { name: 'Biomass reaction', equation: 'precursors → biomass', subsystem: 'Biomass', genes: [], gpr: '' },
};

export const nodes = [
  { id: 'glc_e', x: 50, y: 200, label: 'Glucose[e]', type: 'exchange' },
  { id: 'glc_c', x: 100, y: 200, label: 'Glucose', type: 'metabolite' },
  { id: 'g6p', x: 150, y: 200, label: 'G6P', type: 'metabolite' },
  { id: 'f6p', x: 200, y: 200, label: 'F6P', type: 'metabolite' },
  { id: 'fbp', x: 250, y: 200, label: 'FBP', type: 'metabolite' },
  { id: 'dhap', x: 300, y: 160, label: 'DHAP', type: 'metabolite' },
  { id: 'g3p', x: 300, y: 240, label: 'G3P', type: 'metabolite' },
  { id: '13dpg', x: 350, y: 240, label: '1,3DPG', type: 'metabolite' },
  { id: '3pg', x: 400, y: 240, label: '3PG', type: 'metabolite' },
  { id: '2pg', x: 450, y: 240, label: '2PG', type: 'metabolite' },
  { id: 'pep', x: 500, y: 240, label: 'PEP', type: 'metabolite' },
  { id: 'pyr', x: 550, y: 200, label: 'Pyruvate', type: 'metabolite' },
  { id: 'accoa', x: 600, y: 150, label: 'AcCoA', type: 'metabolite' },
  { id: 'cit', x: 650, y: 120, label: 'Citrate', type: 'metabolite' },
  { id: 'oaa', x: 600, y: 280, label: 'OAA', type: 'metabolite' },
  { id: 'actp', x: 550, y: 300, label: 'AcP', type: 'metabolite' },
  { id: 'ac', x: 550, y: 340, label: 'Acetate[e]', type: 'exchange' },
  { id: 'biomass', x: 650, y: 200, label: 'Biomass', type: 'biomass' },
];

export const edges = [
  { from: 'glc_e', to: 'glc_c', reaction: 'GLCpts', label: 'GLCpts' },
  { from: 'glc_c', to: 'g6p', reaction: 'PGI', label: 'PGI' },
  { from: 'g6p', to: 'f6p', reaction: 'PGI', label: 'PGI' },
  { from: 'f6p', to: 'fbp', reaction: 'PFK', label: 'PFK' },
  { from: 'fbp', to: 'dhap', reaction: 'FBA', label: 'FBA' },
  { from: 'fbp', to: 'g3p', reaction: 'FBA', label: 'FBA' },
  { from: 'dhap', to: 'g3p', reaction: 'TPI', label: 'TPI' },
  { from: 'g3p', to: '13dpg', reaction: 'GAPD', label: 'GAPD' },
  { from: '13dpg', to: '3pg', reaction: 'PGK', label: 'PGK' },
  { from: '3pg', to: '2pg', reaction: 'PGM', label: 'PGM' },
  { from: '2pg', to: 'pep', reaction: 'ENO', label: 'ENO' },
  { from: 'pep', to: 'pyr', reaction: 'PYK', label: 'PYK' },
  { from: 'pyr', to: 'accoa', reaction: 'PDH', label: 'PDH' },
  { from: 'accoa', to: 'cit', reaction: 'CS', label: 'CS' },
  { from: 'pep', to: 'oaa', reaction: 'PPC', label: 'PPC' },
  { from: 'oaa', to: 'cit', reaction: 'CS', label: 'CS' },
  { from: 'pyr', to: 'actp', reaction: 'PTA', label: 'PTA' },
  { from: 'actp', to: 'ac', reaction: 'ACK', label: 'ACKr' },
];
