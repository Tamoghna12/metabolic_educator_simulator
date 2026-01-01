"""
Pre-built pathway templates for quick visualization.
"""

from typing import Dict, List, Optional

# Template definitions (mirrors JavaScript templates)
TEMPLATES = {
    'glycolysis': {
        'id': 'glycolysis',
        'name': 'Glycolysis Pathway',
        'organism': 'Universal',
        'description': 'Embden-Meyerhof-Parnas pathway',
        'nodes': [
            {'id': 'glc', 'x': 100, 'y': 50, 'label': 'Glucose', 'type': 'metabolite'},
            {'id': 'g6p', 'x': 100, 'y': 120, 'label': 'Glucose-6-P', 'type': 'metabolite'},
            {'id': 'f6p', 'x': 100, 'y': 190, 'label': 'Fructose-6-P', 'type': 'metabolite'},
            {'id': 'fbp', 'x': 100, 'y': 260, 'label': 'Fructose-1,6-BP', 'type': 'metabolite'},
            {'id': 'g3p', 'x': 50, 'y': 330, 'label': 'G3P', 'type': 'metabolite'},
            {'id': 'dhap', 'x': 150, 'y': 330, 'label': 'DHAP', 'type': 'metabolite'},
            {'id': 'bpg', 'x': 100, 'y': 400, 'label': '1,3-BPG', 'type': 'metabolite'},
            {'id': '3pg', 'x': 100, 'y': 470, 'label': '3-PG', 'type': 'metabolite'},
            {'id': '2pg', 'x': 100, 'y': 540, 'label': '2-PG', 'type': 'metabolite'},
            {'id': 'pep', 'x': 100, 'y': 610, 'label': 'PEP', 'type': 'metabolite'},
            {'id': 'pyr', 'x': 100, 'y': 680, 'label': 'Pyruvate', 'type': 'metabolite'},
        ],
        'edges': [
            {'from': 'glc', 'to': 'g6p', 'reaction': 'HK', 'label': 'Hexokinase'},
            {'from': 'g6p', 'to': 'f6p', 'reaction': 'PGI', 'label': 'PGI'},
            {'from': 'f6p', 'to': 'fbp', 'reaction': 'PFK', 'label': 'PFK'},
            {'from': 'fbp', 'to': 'g3p', 'reaction': 'ALDO', 'label': 'Aldolase'},
            {'from': 'fbp', 'to': 'dhap', 'reaction': 'ALDO', 'label': ''},
            {'from': 'dhap', 'to': 'g3p', 'reaction': 'TPI', 'label': 'TPI'},
            {'from': 'g3p', 'to': 'bpg', 'reaction': 'GAPDH', 'label': 'GAPDH'},
            {'from': 'bpg', 'to': '3pg', 'reaction': 'PGK', 'label': 'PGK'},
            {'from': '3pg', 'to': '2pg', 'reaction': 'PGM', 'label': 'PGM'},
            {'from': '2pg', 'to': 'pep', 'reaction': 'ENO', 'label': 'Enolase'},
            {'from': 'pep', 'to': 'pyr', 'reaction': 'PK', 'label': 'PK'},
        ]
    },
    'tca_cycle': {
        'id': 'tca_cycle',
        'name': 'TCA Cycle',
        'organism': 'Universal',
        'description': 'Tricarboxylic acid cycle',
        'nodes': [
            {'id': 'accoa', 'x': 300, 'y': 100, 'label': 'Acetyl-CoA', 'type': 'metabolite'},
            {'id': 'cit', 'x': 400, 'y': 150, 'label': 'Citrate', 'type': 'metabolite'},
            {'id': 'icit', 'x': 450, 'y': 250, 'label': 'Isocitrate', 'type': 'metabolite'},
            {'id': 'akg', 'x': 430, 'y': 350, 'label': 'a-KG', 'type': 'metabolite'},
            {'id': 'succoa', 'x': 350, 'y': 420, 'label': 'Succinyl-CoA', 'type': 'metabolite'},
            {'id': 'succ', 'x': 250, 'y': 420, 'label': 'Succinate', 'type': 'metabolite'},
            {'id': 'fum', 'x': 170, 'y': 350, 'label': 'Fumarate', 'type': 'metabolite'},
            {'id': 'mal', 'x': 150, 'y': 250, 'label': 'Malate', 'type': 'metabolite'},
            {'id': 'oaa', 'x': 200, 'y': 150, 'label': 'OAA', 'type': 'metabolite'},
        ],
        'edges': [
            {'from': 'accoa', 'to': 'cit', 'reaction': 'CS', 'label': 'Citrate Synthase'},
            {'from': 'oaa', 'to': 'cit', 'reaction': 'CS', 'label': ''},
            {'from': 'cit', 'to': 'icit', 'reaction': 'ACON', 'label': 'Aconitase'},
            {'from': 'icit', 'to': 'akg', 'reaction': 'IDH', 'label': 'Isocitrate DH'},
            {'from': 'akg', 'to': 'succoa', 'reaction': 'KGDH', 'label': 'a-KG DH'},
            {'from': 'succoa', 'to': 'succ', 'reaction': 'SCS', 'label': 'Succinyl-CoA Synth'},
            {'from': 'succ', 'to': 'fum', 'reaction': 'SDH', 'label': 'Succinate DH'},
            {'from': 'fum', 'to': 'mal', 'reaction': 'FUM', 'label': 'Fumarase'},
            {'from': 'mal', 'to': 'oaa', 'reaction': 'MDH', 'label': 'Malate DH'},
        ]
    },
    'ecoli_central_carbon': {
        'id': 'ecoli_central_carbon',
        'name': 'E. coli Central Carbon',
        'organism': 'E. coli',
        'description': 'Core metabolism including glycolysis, TCA, and PPP',
        'nodes': [
            # Glycolysis
            {'id': 'glc__D_e', 'x': 50, 'y': 100, 'label': 'Glucose', 'type': 'exchange'},
            {'id': 'g6p_c', 'x': 150, 'y': 100, 'label': 'G6P', 'type': 'metabolite'},
            {'id': 'f6p_c', 'x': 250, 'y': 100, 'label': 'F6P', 'type': 'metabolite'},
            {'id': 'fdp_c', 'x': 350, 'y': 100, 'label': 'FBP', 'type': 'metabolite'},
            {'id': 'g3p_c', 'x': 450, 'y': 100, 'label': 'G3P', 'type': 'metabolite'},
            {'id': 'pep_c', 'x': 550, 'y': 150, 'label': 'PEP', 'type': 'metabolite'},
            {'id': 'pyr_c', 'x': 550, 'y': 250, 'label': 'Pyruvate', 'type': 'metabolite'},
            # TCA
            {'id': 'accoa_c', 'x': 450, 'y': 350, 'label': 'Acetyl-CoA', 'type': 'metabolite'},
            {'id': 'cit_c', 'x': 350, 'y': 400, 'label': 'Citrate', 'type': 'metabolite'},
            {'id': 'akg_c', 'x': 250, 'y': 400, 'label': 'a-KG', 'type': 'metabolite'},
            {'id': 'succ_c', 'x': 250, 'y': 300, 'label': 'Succinate', 'type': 'metabolite'},
            {'id': 'oaa_c', 'x': 350, 'y': 300, 'label': 'OAA', 'type': 'metabolite'},
            # Outputs
            {'id': 'ac_e', 'x': 650, 'y': 350, 'label': 'Acetate', 'type': 'exchange'},
            {'id': 'biomass', 'x': 150, 'y': 300, 'label': 'BIOMASS', 'type': 'biomass'},
        ],
        'edges': [
            {'from': 'glc__D_e', 'to': 'g6p_c', 'reaction': 'GLCpts', 'label': 'PTS'},
            {'from': 'g6p_c', 'to': 'f6p_c', 'reaction': 'PGI', 'label': 'PGI'},
            {'from': 'f6p_c', 'to': 'fdp_c', 'reaction': 'PFK', 'label': 'PFK'},
            {'from': 'fdp_c', 'to': 'g3p_c', 'reaction': 'FBA', 'label': 'Aldolase'},
            {'from': 'g3p_c', 'to': 'pep_c', 'reaction': 'GAPD', 'label': 'Glycolysis'},
            {'from': 'pep_c', 'to': 'pyr_c', 'reaction': 'PYK', 'label': 'PK'},
            {'from': 'pyr_c', 'to': 'accoa_c', 'reaction': 'PDH', 'label': 'PDH'},
            {'from': 'accoa_c', 'to': 'cit_c', 'reaction': 'CS', 'label': 'CS'},
            {'from': 'cit_c', 'to': 'akg_c', 'reaction': 'ICDH', 'label': 'IDH'},
            {'from': 'akg_c', 'to': 'succ_c', 'reaction': 'AKGDH', 'label': 'a-KG DH'},
            {'from': 'succ_c', 'to': 'oaa_c', 'reaction': 'FUM', 'label': 'Fumarase+MDH'},
            {'from': 'oaa_c', 'to': 'cit_c', 'reaction': 'CS', 'label': ''},
            {'from': 'accoa_c', 'to': 'ac_e', 'reaction': 'PTAr', 'label': 'Overflow'},
        ]
    },
    'ppp': {
        'id': 'ppp',
        'name': 'Pentose Phosphate Pathway',
        'organism': 'Universal',
        'description': 'Oxidative and non-oxidative branches',
        'nodes': [
            {'id': 'g6p', 'x': 100, 'y': 100, 'label': 'G6P', 'type': 'metabolite'},
            {'id': '6pgl', 'x': 100, 'y': 180, 'label': '6-PGL', 'type': 'metabolite'},
            {'id': '6pgc', 'x': 100, 'y': 260, 'label': '6-PGC', 'type': 'metabolite'},
            {'id': 'ru5p', 'x': 100, 'y': 340, 'label': 'Ru5P', 'type': 'metabolite'},
            {'id': 'r5p', 'x': 200, 'y': 400, 'label': 'R5P', 'type': 'metabolite'},
            {'id': 'xu5p', 'x': 300, 'y': 340, 'label': 'Xu5P', 'type': 'metabolite'},
            {'id': 's7p', 'x': 350, 'y': 260, 'label': 'S7P', 'type': 'metabolite'},
            {'id': 'e4p', 'x': 400, 'y': 180, 'label': 'E4P', 'type': 'metabolite'},
            {'id': 'f6p', 'x': 300, 'y': 100, 'label': 'F6P', 'type': 'metabolite'},
            {'id': 'g3p', 'x': 400, 'y': 100, 'label': 'G3P', 'type': 'metabolite'},
        ],
        'edges': [
            {'from': 'g6p', 'to': '6pgl', 'reaction': 'G6PDH', 'label': 'G6P DH'},
            {'from': '6pgl', 'to': '6pgc', 'reaction': 'PGL', 'label': 'Lactonase'},
            {'from': '6pgc', 'to': 'ru5p', 'reaction': '6PGDH', 'label': '6PG DH'},
            {'from': 'ru5p', 'to': 'r5p', 'reaction': 'RPI', 'label': 'RPI'},
            {'from': 'ru5p', 'to': 'xu5p', 'reaction': 'RPE', 'label': 'RPE'},
            {'from': 'r5p', 'to': 's7p', 'reaction': 'TKT1', 'label': 'Transketolase'},
            {'from': 'xu5p', 'to': 'g3p', 'reaction': 'TKT1', 'label': ''},
            {'from': 's7p', 'to': 'f6p', 'reaction': 'TALA', 'label': 'Transaldolase'},
            {'from': 'g3p', 'to': 'e4p', 'reaction': 'TALA', 'label': ''},
        ]
    }
}


def get_template(name: str) -> Dict:
    """
    Get a pre-built pathway template by name.

    Parameters
    ----------
    name : str
        Template name (e.g., 'glycolysis', 'tca_cycle', 'ecoli_central_carbon').

    Returns
    -------
    dict
        Template with nodes and edges.

    Raises
    ------
    ValueError
        If template name is not found.
    """
    if name not in TEMPLATES:
        available = ', '.join(TEMPLATES.keys())
        raise ValueError(f"Template '{name}' not found. Available: {available}")
    return TEMPLATES[name]


def list_templates() -> List[Dict]:
    """
    List all available pathway templates.

    Returns
    -------
    list
        List of template metadata dictionaries.
    """
    return [
        {
            'id': t['id'],
            'name': t['name'],
            'organism': t['organism'],
            'description': t['description'],
            'node_count': len(t['nodes']),
            'edge_count': len(t['edges'])
        }
        for t in TEMPLATES.values()
    ]
