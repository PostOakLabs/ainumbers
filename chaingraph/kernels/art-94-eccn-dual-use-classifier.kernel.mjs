/**
 * art-94-eccn-dual-use-classifier.kernel.mjs
 * Wave 19 — ECCN / Dual-Use Classifier.
 * Decision-tree from product attributes → ECCN (EAR) + EU Annex I category +
 * controlling regime (Wassenaar/MTCR/AG/NSG) + licence-requirement logic,
 * including 2025 emerging-tech controls (quantum/semiconductor/AM/peptide).
 *
 * Citations (verify before citing):
 *   EAR — Export Administration Regulations (15 CFR Parts 730–774).
 *   EU Dual-Use Regulation 2021/821 + Annex I update in force 15 Nov 2025.
 *   Wassenaar Arrangement on Export Controls for Conventional Arms and Dual-Use Goods.
 *   MTCR — Missile Technology Control Regime.
 *   AG — Australia Group (chemical/bio controls).
 *   NSG — Nuclear Suppliers Group.
 *   BIS Entity List (15 CFR Part 744, Supp. No. 4).
 *   EDUCATIONAL: simplified decision tree — consult export counsel for binding classification.
 */
import { executionHash } from './_hash.mjs';

const TOOL_ID      = 'art-94-eccn-dual-use-classifier';
const TOOL_VERSION = '1.0.0';

export const meta = {
  tool_id:      TOOL_ID,
  tool_version: TOOL_VERSION,
  mcp_name:     'classify_eccn_dual_use',
  mandate_type: 'compliance_mandate',
  gpu:          false,
};

// Simplified ECCN decision tree — high-level categories
// Each entry: { eccn, eu_annex_i, regime, description, licence_triggers[] }
const ECCN_TREE = [
  // Nuclear
  { keywords: ['nuclear', 'uranium', 'plutonium', 'reactor', 'enrichment'],
    eccn: '0A001', eu_annex_i: 'Category 0', regime: 'NSG',
    description: 'Nuclear materials, facilities, and equipment', licence_required: true },
  // Biological / chemical (AG)
  { keywords: ['pathogen', 'biological agent', 'toxin', 'chemical precursor', 'nerve agent', 'sarin', 'vx'],
    eccn: '1C351', eu_annex_i: 'Category 1', regime: 'AG',
    description: 'Biological and chemical agents / precursors', licence_required: true },
  // Advanced materials — peptide synthesis (2025 new)
  { keywords: ['peptide synthesizer', 'benchtop peptide', 'oligonucleotide synthesizer'],
    eccn: '2B352', eu_annex_i: 'Category 2', regime: 'AG',
    description: 'Peptide / oligonucleotide synthesizers (2025 emerging-tech control)', licence_required: true },
  // Additive manufacturing / 3D printing (2025 new)
  { keywords: ['additive manufacturing', '3d printing metal', 'powder bed fusion', 'directed energy deposition'],
    eccn: '2B001', eu_annex_i: 'Category 2', regime: 'Wassenaar',
    description: 'Controlled additive manufacturing / 3D metal printing (2025 Wassenaar update)', licence_required: true },
  // Electronics — semiconductors (2025 new quantum/AI chips)
  { keywords: ['advanced semiconductor', 'quantum chip', 'ai accelerator', 'hbm memory', 'chip on wafer', 'logic chip'],
    eccn: '3A090', eu_annex_i: 'Category 3', regime: 'Wassenaar',
    description: 'Advanced semiconductors / AI accelerators (2025 emerging-tech control)', licence_required: true },
  { keywords: ['semiconductor equipment', 'lithography', 'etch', 'deposition', 'wafer fab'],
    eccn: '3B001', eu_annex_i: 'Category 3', regime: 'Wassenaar',
    description: 'Semiconductor manufacturing equipment', licence_required: true },
  // Quantum computing / sensing
  { keywords: ['quantum computer', 'qubit', 'quantum sensing', 'quantum key distribution', 'qkd'],
    eccn: '3A001.a.5', eu_annex_i: 'Category 3', regime: 'Wassenaar',
    description: 'Quantum computing / sensing systems (2025 Wassenaar update)', licence_required: true },
  // Telecom / encryption
  { keywords: ['encryption', 'cryptographic module', 'vpn appliance', 'hsm'],
    eccn: '5E002', eu_annex_i: 'Category 5 Part 2', regime: 'Wassenaar',
    description: 'Encryption / cryptographic technology', licence_required: true },
  { keywords: ['telecom', 'satellite', 'radio frequency', 'radar', 'sonar'],
    eccn: '5A001', eu_annex_i: 'Category 5 Part 1', regime: 'Wassenaar',
    description: 'Telecommunications equipment', licence_required: false },
  // Sensors / navigation
  { keywords: ['inertial navigation', 'ins', 'gyroscope', 'accelerometer military', 'gps jamming'],
    eccn: '7A001', eu_annex_i: 'Category 7', regime: 'Wassenaar',
    description: 'Inertial navigation systems', licence_required: true },
  // Aerospace / propulsion (MTCR)
  { keywords: ['missile', 'rocket', 'propulsion', 'unmanned aerial vehicle', 'uav', 'drone propulsion'],
    eccn: '9A012', eu_annex_i: 'Category 9', regime: 'MTCR',
    description: 'Missile / aerospace propulsion systems', licence_required: true },
  // Software — controlled
  { keywords: ['intrusion software', 'exploit', 'malware', 'spyware', 'surveillance software'],
    eccn: '4D004', eu_annex_i: 'Category 4', regime: 'Wassenaar',
    description: 'Intrusion / surveillance software', licence_required: true },
];

// Red-flag end uses
const RED_FLAG_END_USES = ['weapons_of_mass_destruction', 'military_end_use', 'listed_entity', 'nuclear_use', 'rocket_propulsion'];
const RED_FLAG_END_USERS = ['military', 'government_restricted', 'entity_list'];
// Countries requiring heightened scrutiny (not a complete list — verify current)
const HEIGHTENED_COUNTRIES = ['ru', 'by', 'ir', 'kp', 'cu', 'sy', 'cn_military', 've'];

export function compute(pp) {
  const {
    product = {},
  } = pp;

  const {
    technical_attributes = [],
    end_use              = '',
    end_user_type        = 'commercial',
    destination_country  = '',
  } = product;

  const attrs_lower = technical_attributes.map(a => (a || '').toLowerCase());
  const eu_lower    = end_use.toLowerCase();

  // Walk decision tree
  let match = null;
  for (const entry of ECCN_TREE) {
    const hit = entry.keywords.some(kw => attrs_lower.some(a => a.includes(kw)) || eu_lower.includes(kw));
    if (hit) { match = entry; break; }
  }

  const eccn            = match ? match.eccn           : 'EAR99';
  const eu_annex_i      = match ? match.eu_annex_i     : 'Not listed';
  const controlling_regime = match ? match.regime       : 'None';
  const base_licence    = match ? match.licence_required : false;

  // Elevated licence triggers
  const dest_lower = (destination_country || '').toLowerCase();
  const is_heightened_dest = HEIGHTENED_COUNTRIES.some(c => dest_lower.includes(c));
  const is_red_flag_use    = RED_FLAG_END_USES.some(r => eu_lower.includes(r));
  const is_red_flag_user   = RED_FLAG_END_USERS.some(r => end_user_type.toLowerCase().includes(r));

  const licence_required = base_licence || is_heightened_dest || is_red_flag_use || is_red_flag_user;

  const red_flags = [];
  if (is_red_flag_use)    red_flags.push('End use flagged as controlled / WMD-related');
  if (is_red_flag_user)   red_flags.push('End user type is government-restricted or entity-listed');
  if (is_heightened_dest) red_flags.push('Destination country under heightened EAR/EU scrutiny');

  const compliance_flags = [];
  if (licence_required)         compliance_flags.push('LICENCE_REQUIRED');
  const emerging_tech_eccs = ['3A090', '3A001.a.5', '2B352', '2B001'];
  if (match && emerging_tech_eccs.includes(match.eccn)) compliance_flags.push('EMERGING_TECH_CONTROL');
  if (red_flags.length > 0)     compliance_flags.push('RED_FLAG_END_USE');

  const output_payload = {
    eccn,
    eu_annex_i_category:  eu_annex_i,
    controlling_regime,
    licence_required,
    red_flags,
    classification_basis: match ? match.description : 'No controlled item attributes matched — defaulting to EAR99',
    emerging_tech_note:   'EU Annex I updated 15 Nov 2025 for quantum/semiconductor/AM/peptide controls. BIS emerging-tech rules in force. Verify current ECCN against 15 CFR Part 774 and EU Reg. 2021/821 Annex I.',
    key_dates: {
      eu_dual_use_annex_update: '2025-11-15',
      bis_affiliates_rule:      '2025-09-29',
    },
    reference_version: '2026-06',
    note: 'SIMPLIFIED DECISION TREE — decision-support draft only. Classification may be incomplete. Consult export counsel and the current EAR (15 CFR Parts 730–774) and EU Reg. 2021/821 Annex I for binding classification.',
  };

  return { output_payload, compliance_flags };
}

export async function buildArtifact(pp, { now, parent_hashes = [], parent_tool_ids = [], chain_depth = 0 } = {}) {
  const { output_payload, compliance_flags } = compute(pp);
  const hash = await executionHash(pp, output_payload);
  return {
    '@context':         'https://ainumbers.co/chaingraph/context/v0.3/context.jsonld',
    chaingraph_version: '0.4.0',
    compute_mode:       'server',
    mandate_type:       meta.mandate_type,
    tool_id:            TOOL_ID,
    tool_version:       TOOL_VERSION,
    generated_at:       now ?? null,
    execution_hash:     hash,
    chain:              { parent_hashes, parent_tool_ids, chain_depth },
    policy_parameters:  pp,
    output_payload,
    compliance_flags,
    audit_signature:    { payloadType: 'application/vnd.openchain.graph+json;version=0.4', payload: '', signatures: [] },
  };
}
