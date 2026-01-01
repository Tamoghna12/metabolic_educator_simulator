/**
 * Pre-built Pathway Templates for Common Organisms
 *
 * These templates provide curated pathway layouts similar to Escher's map library,
 * but with additional educational annotations and optimized layouts.
 *
 * References:
 * - Orth et al. (2011) iML1515 E. coli model
 * - King et al. (2015) Escher pathway maps
 * - KEGG pathway database
 * - BioCyc pathway/genome databases
 */

// Central Carbon Metabolism - E. coli
export const ecoliCentralCarbon = {
  id: 'ecoli_central_carbon',
  name: 'E. coli Central Carbon Metabolism',
  organism: 'Escherichia coli',
  description: 'Core metabolic pathways including glycolysis, TCA cycle, pentose phosphate pathway, and overflow metabolism',
  nodes: [
    // Glycolysis metabolites
    { id: 'glc__D_e', x: 50, y: 100, label: 'Glucose (ext)', type: 'exchange' },
    { id: 'glc__D_c', x: 150, y: 100, label: 'Glucose', type: 'metabolite' },
    { id: 'g6p_c', x: 250, y: 100, label: 'G6P', type: 'metabolite' },
    { id: 'f6p_c', x: 350, y: 100, label: 'F6P', type: 'metabolite' },
    { id: 'fdp_c', x: 450, y: 100, label: 'FBP', type: 'metabolite' },
    { id: 'g3p_c', x: 550, y: 100, label: 'G3P', type: 'metabolite' },
    { id: 'dhap_c', x: 550, y: 180, label: 'DHAP', type: 'metabolite' },
    { id: '13dpg_c', x: 650, y: 100, label: '1,3-BPG', type: 'metabolite' },
    { id: '3pg_c', x: 750, y: 100, label: '3PG', type: 'metabolite' },
    { id: '2pg_c', x: 750, y: 180, label: '2PG', type: 'metabolite' },
    { id: 'pep_c', x: 650, y: 250, label: 'PEP', type: 'metabolite' },
    { id: 'pyr_c', x: 550, y: 320, label: 'Pyruvate', type: 'metabolite' },

    // TCA cycle metabolites
    { id: 'accoa_c', x: 450, y: 400, label: 'Acetyl-CoA', type: 'metabolite' },
    { id: 'cit_c', x: 350, y: 450, label: 'Citrate', type: 'metabolite' },
    { id: 'icit_c', x: 250, y: 500, label: 'Isocitrate', type: 'metabolite' },
    { id: 'akg_c', x: 250, y: 400, label: 'α-KG', type: 'metabolite' },
    { id: 'succoa_c', x: 350, y: 350, label: 'Succinyl-CoA', type: 'metabolite' },
    { id: 'succ_c', x: 450, y: 300, label: 'Succinate', type: 'metabolite' },
    { id: 'fum_c', x: 550, y: 400, label: 'Fumarate', type: 'metabolite' },
    { id: 'mal__L_c', x: 550, y: 500, label: 'Malate', type: 'metabolite' },
    { id: 'oaa_c', x: 450, y: 500, label: 'OAA', type: 'metabolite' },

    // Pentose phosphate pathway
    { id: '6pgl_c', x: 250, y: 200, label: '6PGL', type: 'metabolite' },
    { id: '6pgc_c', x: 250, y: 280, label: '6PGC', type: 'metabolite' },
    { id: 'ru5p__D_c', x: 350, y: 280, label: 'Ru5P', type: 'metabolite' },
    { id: 'r5p_c', x: 350, y: 200, label: 'R5P', type: 'metabolite' },
    { id: 'xu5p__D_c', x: 450, y: 200, label: 'Xu5P', type: 'metabolite' },

    // Overflow metabolism
    { id: 'ac_c', x: 650, y: 400, label: 'Acetate', type: 'metabolite' },
    { id: 'ac_e', x: 750, y: 400, label: 'Acetate (ext)', type: 'exchange' },
    { id: 'etoh_c', x: 650, y: 500, label: 'Ethanol', type: 'metabolite' },
    { id: 'for_c', x: 750, y: 320, label: 'Formate', type: 'metabolite' },
    { id: 'lac__D_c', x: 450, y: 250, label: 'Lactate', type: 'metabolite' },

    // Biomass
    { id: 'biomass', x: 150, y: 450, label: 'BIOMASS', type: 'biomass' },

    // Cofactors (simplified)
    { id: 'atp_c', x: 100, y: 300, label: 'ATP', type: 'metabolite' },
    { id: 'nadh_c', x: 100, y: 380, label: 'NADH', type: 'metabolite' },
  ],
  edges: [
    // Glycolysis
    { from: 'glc__D_e', to: 'glc__D_c', reaction: 'GLCpts', label: 'PTS' },
    { from: 'glc__D_c', to: 'g6p_c', reaction: 'HEX1', label: 'HK' },
    { from: 'g6p_c', to: 'f6p_c', reaction: 'PGI', label: 'PGI' },
    { from: 'f6p_c', to: 'fdp_c', reaction: 'PFK', label: 'PFK' },
    { from: 'fdp_c', to: 'g3p_c', reaction: 'FBA', label: 'Aldolase' },
    { from: 'fdp_c', to: 'dhap_c', reaction: 'FBA', label: '' },
    { from: 'dhap_c', to: 'g3p_c', reaction: 'TPI', label: 'TPI' },
    { from: 'g3p_c', to: '13dpg_c', reaction: 'GAPD', label: 'GAPDH' },
    { from: '13dpg_c', to: '3pg_c', reaction: 'PGK', label: 'PGK' },
    { from: '3pg_c', to: '2pg_c', reaction: 'PGM', label: 'PGM' },
    { from: '2pg_c', to: 'pep_c', reaction: 'ENO', label: 'Enolase' },
    { from: 'pep_c', to: 'pyr_c', reaction: 'PYK', label: 'PK' },

    // TCA cycle
    { from: 'pyr_c', to: 'accoa_c', reaction: 'PDH', label: 'PDH' },
    { from: 'accoa_c', to: 'cit_c', reaction: 'CS', label: 'CS' },
    { from: 'cit_c', to: 'icit_c', reaction: 'ACONTa', label: 'Aconitase' },
    { from: 'icit_c', to: 'akg_c', reaction: 'ICDHyr', label: 'IDH' },
    { from: 'akg_c', to: 'succoa_c', reaction: 'AKGDH', label: 'KGDH' },
    { from: 'succoa_c', to: 'succ_c', reaction: 'SUCOAS', label: 'SCS' },
    { from: 'succ_c', to: 'fum_c', reaction: 'SUCDi', label: 'SDH' },
    { from: 'fum_c', to: 'mal__L_c', reaction: 'FUM', label: 'Fumarase' },
    { from: 'mal__L_c', to: 'oaa_c', reaction: 'MDH', label: 'MDH' },
    { from: 'oaa_c', to: 'cit_c', reaction: 'CS', label: '' },

    // PPP
    { from: 'g6p_c', to: '6pgl_c', reaction: 'G6PDH2r', label: 'G6PDH' },
    { from: '6pgl_c', to: '6pgc_c', reaction: 'PGL', label: 'PGL' },
    { from: '6pgc_c', to: 'ru5p__D_c', reaction: 'GND', label: '6PGDH' },
    { from: 'ru5p__D_c', to: 'r5p_c', reaction: 'RPI', label: 'RPI' },
    { from: 'ru5p__D_c', to: 'xu5p__D_c', reaction: 'RPE', label: 'RPE' },

    // Overflow
    { from: 'accoa_c', to: 'ac_c', reaction: 'PTAr', label: 'PTA/ACK' },
    { from: 'ac_c', to: 'ac_e', reaction: 'EX_ac_e', label: 'Export' },
    { from: 'accoa_c', to: 'etoh_c', reaction: 'ALCD2x', label: 'ADH' },
    { from: 'pyr_c', to: 'lac__D_c', reaction: 'LDH_D', label: 'LDH' },
    { from: 'pyr_c', to: 'for_c', reaction: 'PFL', label: 'PFL' },
  ],
  annotations: [
    { x: 400, y: 50, text: 'GLYCOLYSIS', fontSize: 16, color: 'var(--primary)' },
    { x: 400, y: 420, text: 'TCA CYCLE', fontSize: 16, color: 'var(--primary)' },
    { x: 300, y: 240, text: 'PPP', fontSize: 14, color: 'var(--info)' },
    { x: 700, y: 450, text: 'OVERFLOW', fontSize: 14, color: 'var(--warning)' },
  ]
};

// Glycolysis focused template
export const glycolysisTemplate = {
  id: 'glycolysis',
  name: 'Glycolysis Pathway',
  organism: 'Universal',
  description: 'Embden-Meyerhof-Parnas pathway for glucose catabolism',
  nodes: [
    { id: 'glc', x: 100, y: 50, label: 'Glucose', type: 'metabolite' },
    { id: 'g6p', x: 100, y: 120, label: 'Glucose-6-P', type: 'metabolite' },
    { id: 'f6p', x: 100, y: 190, label: 'Fructose-6-P', type: 'metabolite' },
    { id: 'fbp', x: 100, y: 260, label: 'Fructose-1,6-BP', type: 'metabolite' },
    { id: 'g3p', x: 50, y: 330, label: 'G3P', type: 'metabolite' },
    { id: 'dhap', x: 150, y: 330, label: 'DHAP', type: 'metabolite' },
    { id: 'bpg', x: 100, y: 400, label: '1,3-BPG', type: 'metabolite' },
    { id: '3pg', x: 100, y: 470, label: '3-PG', type: 'metabolite' },
    { id: '2pg', x: 100, y: 540, label: '2-PG', type: 'metabolite' },
    { id: 'pep', x: 100, y: 610, label: 'PEP', type: 'metabolite' },
    { id: 'pyr', x: 100, y: 680, label: 'Pyruvate', type: 'metabolite' },
    // ATP/ADP
    { id: 'atp1', x: 200, y: 120, label: 'ATP', type: 'metabolite' },
    { id: 'atp2', x: 200, y: 260, label: 'ATP', type: 'metabolite' },
    { id: 'atp3', x: 200, y: 470, label: 'ATP', type: 'metabolite' },
    { id: 'atp4', x: 200, y: 680, label: 'ATP', type: 'metabolite' },
    // NAD+/NADH
    { id: 'nad', x: 200, y: 400, label: 'NAD+', type: 'metabolite' },
  ],
  edges: [
    { from: 'glc', to: 'g6p', reaction: 'HK', label: 'Hexokinase (−ATP)' },
    { from: 'g6p', to: 'f6p', reaction: 'PGI', label: 'PGI' },
    { from: 'f6p', to: 'fbp', reaction: 'PFK', label: 'PFK (−ATP)' },
    { from: 'fbp', to: 'g3p', reaction: 'ALDO', label: 'Aldolase' },
    { from: 'fbp', to: 'dhap', reaction: 'ALDO', label: '' },
    { from: 'dhap', to: 'g3p', reaction: 'TPI', label: 'TPI' },
    { from: 'g3p', to: 'bpg', reaction: 'GAPDH', label: 'GAPDH (+NADH)' },
    { from: 'bpg', to: '3pg', reaction: 'PGK', label: 'PGK (+ATP)' },
    { from: '3pg', to: '2pg', reaction: 'PGM', label: 'PGM' },
    { from: '2pg', to: 'pep', reaction: 'ENO', label: 'Enolase' },
    { from: 'pep', to: 'pyr', reaction: 'PK', label: 'PK (+ATP)' },
  ],
  annotations: [
    { x: 100, y: 20, text: 'GLYCOLYSIS', fontSize: 18, color: 'var(--primary)' },
    { x: 280, y: 190, text: 'Investment Phase', fontSize: 12, color: 'var(--danger)' },
    { x: 280, y: 500, text: 'Payoff Phase', fontSize: 12, color: 'var(--success)' },
    { x: 280, y: 730, text: 'Net: 2 ATP + 2 NADH', fontSize: 11, color: 'var(--info)' },
  ]
};

// TCA Cycle template
export const tcaCycleTemplate = {
  id: 'tca_cycle',
  name: 'TCA Cycle (Citric Acid Cycle)',
  organism: 'Universal',
  description: 'Tricarboxylic acid cycle for complete oxidation of acetyl-CoA',
  nodes: [
    // Main cycle metabolites arranged in a circle
    { id: 'accoa', x: 400, y: 100, label: 'Acetyl-CoA', type: 'metabolite' },
    { id: 'cit', x: 550, y: 150, label: 'Citrate', type: 'metabolite' },
    { id: 'icit', x: 620, y: 280, label: 'Isocitrate', type: 'metabolite' },
    { id: 'akg', x: 600, y: 420, label: 'α-Ketoglutarate', type: 'metabolite' },
    { id: 'succoa', x: 500, y: 520, label: 'Succinyl-CoA', type: 'metabolite' },
    { id: 'succ', x: 350, y: 520, label: 'Succinate', type: 'metabolite' },
    { id: 'fum', x: 230, y: 420, label: 'Fumarate', type: 'metabolite' },
    { id: 'mal', x: 200, y: 280, label: 'Malate', type: 'metabolite' },
    { id: 'oaa', x: 280, y: 150, label: 'Oxaloacetate', type: 'metabolite' },
    // Inputs/Outputs
    { id: 'pyr', x: 400, y: 30, label: 'Pyruvate', type: 'exchange' },
    { id: 'co2_1', x: 700, y: 280, label: 'CO₂', type: 'exchange' },
    { id: 'co2_2', x: 680, y: 450, label: 'CO₂', type: 'exchange' },
    { id: 'nadh_1', x: 700, y: 350, label: 'NADH', type: 'metabolite' },
    { id: 'nadh_2', x: 580, y: 480, label: 'NADH', type: 'metabolite' },
    { id: 'nadh_3', x: 120, y: 280, label: 'NADH', type: 'metabolite' },
    { id: 'fadh2', x: 180, y: 480, label: 'FADH₂', type: 'metabolite' },
    { id: 'gtp', x: 420, y: 580, label: 'GTP', type: 'metabolite' },
  ],
  edges: [
    { from: 'pyr', to: 'accoa', reaction: 'PDH', label: 'PDH Complex' },
    { from: 'accoa', to: 'cit', reaction: 'CS', label: 'Citrate Synthase' },
    { from: 'oaa', to: 'cit', reaction: 'CS', label: '' },
    { from: 'cit', to: 'icit', reaction: 'ACON', label: 'Aconitase' },
    { from: 'icit', to: 'akg', reaction: 'IDH', label: 'Isocitrate DH' },
    { from: 'icit', to: 'co2_1', reaction: 'IDH', label: '' },
    { from: 'akg', to: 'succoa', reaction: 'KGDH', label: 'α-KG DH' },
    { from: 'akg', to: 'co2_2', reaction: 'KGDH', label: '' },
    { from: 'succoa', to: 'succ', reaction: 'SCS', label: 'Succinyl-CoA Synthetase' },
    { from: 'succoa', to: 'gtp', reaction: 'SCS', label: '' },
    { from: 'succ', to: 'fum', reaction: 'SDH', label: 'Succinate DH' },
    { from: 'succ', to: 'fadh2', reaction: 'SDH', label: '' },
    { from: 'fum', to: 'mal', reaction: 'FUM', label: 'Fumarase' },
    { from: 'mal', to: 'oaa', reaction: 'MDH', label: 'Malate DH' },
    { from: 'mal', to: 'nadh_3', reaction: 'MDH', label: '' },
  ],
  annotations: [
    { x: 400, y: 320, text: 'TCA CYCLE', fontSize: 20, color: 'var(--primary)' },
    { x: 400, y: 350, text: '(Krebs Cycle)', fontSize: 12, color: 'var(--text-secondary)' },
    { x: 750, y: 380, text: 'Per acetyl-CoA:', fontSize: 11, color: 'var(--info)' },
    { x: 750, y: 400, text: '3 NADH', fontSize: 10, color: 'var(--success)' },
    { x: 750, y: 420, text: '1 FADH₂', fontSize: 10, color: 'var(--success)' },
    { x: 750, y: 440, text: '1 GTP', fontSize: 10, color: 'var(--success)' },
    { x: 750, y: 460, text: '2 CO₂', fontSize: 10, color: 'var(--warning)' },
  ]
};

// Pentose Phosphate Pathway template
export const pentosePhosphateTemplate = {
  id: 'ppp',
  name: 'Pentose Phosphate Pathway',
  organism: 'Universal',
  description: 'Oxidative and non-oxidative branches for NADPH and ribose-5-phosphate production',
  nodes: [
    // Oxidative branch
    { id: 'g6p', x: 100, y: 100, label: 'G6P', type: 'metabolite' },
    { id: '6pgl', x: 100, y: 180, label: '6-Phosphogluconolactone', type: 'metabolite' },
    { id: '6pgc', x: 100, y: 260, label: '6-Phosphogluconate', type: 'metabolite' },
    { id: 'ru5p', x: 100, y: 340, label: 'Ribulose-5-P', type: 'metabolite' },
    // Non-oxidative branch
    { id: 'r5p', x: 200, y: 420, label: 'Ribose-5-P', type: 'metabolite' },
    { id: 'xu5p', x: 300, y: 340, label: 'Xylulose-5-P', type: 'metabolite' },
    { id: 's7p', x: 400, y: 420, label: 'Sedoheptulose-7-P', type: 'metabolite' },
    { id: 'e4p', x: 500, y: 340, label: 'Erythrose-4-P', type: 'metabolite' },
    { id: 'g3p', x: 400, y: 260, label: 'G3P', type: 'metabolite' },
    { id: 'f6p', x: 300, y: 180, label: 'F6P', type: 'metabolite' },
    // Cofactors
    { id: 'nadph1', x: 200, y: 140, label: 'NADPH', type: 'metabolite' },
    { id: 'nadph2', x: 200, y: 300, label: 'NADPH', type: 'metabolite' },
    { id: 'co2', x: 200, y: 260, label: 'CO₂', type: 'exchange' },
  ],
  edges: [
    // Oxidative branch
    { from: 'g6p', to: '6pgl', reaction: 'G6PDH', label: 'G6P Dehydrogenase' },
    { from: 'g6p', to: 'nadph1', reaction: 'G6PDH', label: '' },
    { from: '6pgl', to: '6pgc', reaction: 'PGL', label: 'Lactonase' },
    { from: '6pgc', to: 'ru5p', reaction: 'GND', label: '6PG Dehydrogenase' },
    { from: '6pgc', to: 'nadph2', reaction: 'GND', label: '' },
    { from: '6pgc', to: 'co2', reaction: 'GND', label: '' },
    // Non-oxidative branch
    { from: 'ru5p', to: 'r5p', reaction: 'RPI', label: 'Ribose-5-P Isomerase' },
    { from: 'ru5p', to: 'xu5p', reaction: 'RPE', label: 'Ribulose-5-P Epimerase' },
    { from: 'r5p', to: 's7p', reaction: 'TKT1', label: 'Transketolase' },
    { from: 'xu5p', to: 'g3p', reaction: 'TKT1', label: '' },
    { from: 's7p', to: 'f6p', reaction: 'TALA', label: 'Transaldolase' },
    { from: 'g3p', to: 'e4p', reaction: 'TALA', label: '' },
    { from: 'xu5p', to: 'f6p', reaction: 'TKT2', label: 'Transketolase' },
    { from: 'e4p', to: 'g3p', reaction: 'TKT2', label: '' },
  ],
  annotations: [
    { x: 100, y: 60, text: 'OXIDATIVE BRANCH', fontSize: 14, color: 'var(--success)' },
    { x: 350, y: 140, text: 'NON-OXIDATIVE BRANCH', fontSize: 14, color: 'var(--info)' },
    { x: 100, y: 500, text: 'Products: NADPH (anabolism, antioxidant)', fontSize: 11, color: 'var(--text-secondary)' },
    { x: 100, y: 520, text: 'Ribose-5-P (nucleotide synthesis)', fontSize: 11, color: 'var(--text-secondary)' },
  ]
};

// Yeast Ethanol Fermentation
export const yeastFermentation = {
  id: 'yeast_fermentation',
  name: 'Saccharomyces cerevisiae Ethanol Fermentation',
  organism: 'Saccharomyces cerevisiae',
  description: 'Alcoholic fermentation pathway in yeast',
  nodes: [
    { id: 'glc_e', x: 100, y: 50, label: 'Glucose (ext)', type: 'exchange' },
    { id: 'glc_c', x: 200, y: 50, label: 'Glucose', type: 'metabolite' },
    { id: 'g6p', x: 300, y: 100, label: 'G6P', type: 'metabolite' },
    { id: 'f6p', x: 400, y: 100, label: 'F6P', type: 'metabolite' },
    { id: 'fbp', x: 500, y: 100, label: 'FBP', type: 'metabolite' },
    { id: 'g3p', x: 550, y: 180, label: 'G3P (×2)', type: 'metabolite' },
    { id: 'pyr', x: 550, y: 280, label: 'Pyruvate (×2)', type: 'metabolite' },
    { id: 'acald', x: 450, y: 350, label: 'Acetaldehyde', type: 'metabolite' },
    { id: 'etoh', x: 350, y: 350, label: 'Ethanol', type: 'metabolite' },
    { id: 'etoh_e', x: 250, y: 350, label: 'Ethanol (ext)', type: 'exchange' },
    { id: 'co2', x: 550, y: 350, label: 'CO₂', type: 'exchange' },
    { id: 'atp', x: 400, y: 250, label: 'ATP (×2 net)', type: 'metabolite' },
  ],
  edges: [
    { from: 'glc_e', to: 'glc_c', reaction: 'GLCt', label: 'Glucose Transport' },
    { from: 'glc_c', to: 'g6p', reaction: 'HXK', label: 'Hexokinase' },
    { from: 'g6p', to: 'f6p', reaction: 'PGI', label: 'PGI' },
    { from: 'f6p', to: 'fbp', reaction: 'PFK', label: 'PFK' },
    { from: 'fbp', to: 'g3p', reaction: 'FBA', label: 'Aldolase' },
    { from: 'g3p', to: 'pyr', reaction: 'GLYC', label: 'Glycolysis' },
    { from: 'pyr', to: 'acald', reaction: 'PDC', label: 'Pyruvate Decarboxylase' },
    { from: 'pyr', to: 'co2', reaction: 'PDC', label: '' },
    { from: 'acald', to: 'etoh', reaction: 'ADH', label: 'Alcohol DH' },
    { from: 'etoh', to: 'etoh_e', reaction: 'ETOHt', label: 'Export' },
  ],
  annotations: [
    { x: 400, y: 20, text: 'ALCOHOLIC FERMENTATION', fontSize: 16, color: 'var(--primary)' },
    { x: 550, y: 400, text: 'C₆H₁₂O₆ → 2 C₂H₅OH + 2 CO₂', fontSize: 12, color: 'var(--info)' },
    { x: 550, y: 420, text: 'Net: 2 ATP per glucose', fontSize: 11, color: 'var(--success)' },
  ]
};

// Export all templates
export const pathwayTemplates = {
  ecoli_central_carbon: ecoliCentralCarbon,
  glycolysis: glycolysisTemplate,
  tca_cycle: tcaCycleTemplate,
  ppp: pentosePhosphateTemplate,
  yeast_fermentation: yeastFermentation
};

// Template metadata for UI
export const templateMetadata = [
  {
    id: 'ecoli_central_carbon',
    name: 'E. coli Central Carbon',
    organism: 'E. coli',
    category: 'Central Metabolism',
    nodeCount: 33,
    edgeCount: 28
  },
  {
    id: 'glycolysis',
    name: 'Glycolysis',
    organism: 'Universal',
    category: 'Carbohydrate Metabolism',
    nodeCount: 16,
    edgeCount: 11
  },
  {
    id: 'tca_cycle',
    name: 'TCA Cycle',
    organism: 'Universal',
    category: 'Central Metabolism',
    nodeCount: 17,
    edgeCount: 15
  },
  {
    id: 'ppp',
    name: 'Pentose Phosphate',
    organism: 'Universal',
    category: 'Carbohydrate Metabolism',
    nodeCount: 13,
    edgeCount: 14
  },
  {
    id: 'yeast_fermentation',
    name: 'Yeast Fermentation',
    organism: 'S. cerevisiae',
    category: 'Fermentation',
    nodeCount: 12,
    edgeCount: 10
  }
];

export default pathwayTemplates;
